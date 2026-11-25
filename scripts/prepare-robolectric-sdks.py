#!/usr/bin/env python3
"""Prefetch the pinned Robolectric 4.14.1 runtimes, verifying Maven SHA-512.

Robolectric's JUnit workers then use these local jars instead of starting their
own concurrent downloads. No checksum or TLS verification is disabled.
"""
import argparse
import hashlib
import re
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

VERSIONS = ('9-robolectric-4913185-2-i7', '14-robolectric-10818077-i7', '15-robolectric-12650502-i7')
BASE = 'https://repo.maven.apache.org/maven2/org/robolectric/android-all-instrumented/'

def request(url, destination=None):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                if destination is None:
                    return response.read(4096)
                with destination.open('wb') as output:
                    shutil.copyfileobj(response, output, 1024 * 1024)
                return None
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            if isinstance(error, urllib.error.HTTPError) and error.code not in (408, 429, 500, 502, 503, 504):
                raise
            if attempt == 4:
                raise
            delay = 2 ** attempt
            if isinstance(error, urllib.error.HTTPError):
                value = error.headers.get('Retry-After', '')
                if value.isdigit(): delay = max(delay, int(value))
            time.sleep(min(delay, 30))

def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha512').hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path.home()/'.cache/vela-robolectric-sdks')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for version in VERSIONS:
        name = 'android-all-instrumented-' + version + '.jar'
        url = BASE + version + '/' + name
        expected = request(url + '.sha512').decode('ascii').split()[0].lower()
        if not re.fullmatch('[0-9a-f]{128}', expected):
            raise RuntimeError('Invalid Maven SHA-512 for ' + name)
        cached = args.cache/version/name
        cached.parent.mkdir(parents=True, exist_ok=True)
        if not cached.is_file() or digest(cached) != expected:
            partial = cached.with_suffix('.jar.partial')
            request(url, partial)
            if digest(partial) != expected:
                partial.unlink(missing_ok=True)
                raise RuntimeError('Maven SHA-512 mismatch for ' + name)
            partial.replace(cached)
        target = args.output/name
        if target.resolve() != cached.resolve():
            shutil.copyfile(cached, target)
        print('Verified Android test runtime: ' + version, flush=True)

if __name__ == '__main__':
    main()
