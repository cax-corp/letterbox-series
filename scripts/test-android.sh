#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TOOLS_DIR="${LUMA_TOOLS_DIR:-/workspace/.luma-tools}"
export JAVA_HOME="$TOOLS_DIR/jdk"
export ANDROID_HOME="$TOOLS_DIR/android-sdk"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
extra_args=()
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  readarray -t proxy_parts < <(python3 -c 'import os,urllib.parse; u=urllib.parse.urlparse(os.environ["HTTPS_PROXY"]); print(u.hostname); print(u.port or 8080)')
  extra_args+=("-Dhttps.proxyHost=${proxy_parts[0]}" "-Dhttps.proxyPort=${proxy_parts[1]}" "-Dhttp.proxyHost=${proxy_parts[0]}" "-Dhttp.proxyPort=${proxy_parts[1]}")
fi
if [[ -f /etc/ssl/certs/java/cacerts ]]; then extra_args+=("-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"); fi
"$TOOLS_DIR/gradle/bin/gradle" -p android testDebugUnitTest --no-daemon --max-workers=2 "${extra_args[@]}" "$@"
