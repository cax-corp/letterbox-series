-- Vela 2.10.0: lightweight collection reads and spoiler-safe public reviews.
-- Run in Supabase SQL Editor with the postgres role. Safe to rerun.
-- Existing collections, public links and Storage policies are preserved.
begin;
create or replace function public.vela_canonical_json(p jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare kind text := jsonb_typeof(p); result text;
begin
 if kind='object' then
  select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.vela_canonical_json(value),',' order by key collate "C"),'')||'}' into result from jsonb_each(p);
 elsif kind='array' then
  select '['||coalesce(string_agg(public.vela_canonical_json(value),',' order by ordinal),'')||']' into result from jsonb_array_elements(p) with ordinality as parts(value,ordinal);
 else result:=p::text;
 end if;
 return result;
end;
$$;
revoke all on function public.vela_canonical_json(jsonb) from public,anon;
grant execute on function public.vela_canonical_json(jsonb) to authenticated;
create or replace function public.vela_entry_fingerprint(p jsonb)
returns text language sql immutable strict set search_path = '' as $$
 select encode(sha256(convert_to(public.vela_canonical_json(p),'UTF8')),'hex');
$$;
revoke all on function public.vela_entry_fingerprint(jsonb) from public,anon;
grant execute on function public.vela_entry_fingerprint(jsonb) to authenticated;
-- Compute once on writes; manifest reads do not parse every saved synopsis again.
alter table public.library add column if not exists vela_fingerprint text
 generated always as (public.vela_entry_fingerprint(entry)) stored;
create or replace function public.vela_library_fingerprints()
returns table(title_id text, updated text, fingerprint text)
language sql stable security invoker set search_path = '' as $$
 select l.title_id, l.entry->>'updated', l.vela_fingerprint
 from public.library l where l.user_id = (select auth.uid());
$$;
revoke all on function public.vela_library_fingerprints() from public,anon;
grant execute on function public.vela_library_fingerprints() to authenticated;
create or replace function public.vela_shared_payload_valid(k text, p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare profile jsonb; item jsonb; stat text;
begin
  if jsonb_typeof(p) is distinct from 'object'
    or p - array['version','profile','stats','review'] <> '{}'::jsonb
    or p->'version' is distinct from '1'::jsonb then return false; end if;
  profile := p->'profile';
  if jsonb_typeof(profile) is distinct from 'object'
    or profile - array['version','displayName','bio','avatar','background','photo','featured','updated'] <> '{}'::jsonb
    or profile->'version' is distinct from '1'::jsonb
    or jsonb_typeof(profile->'displayName') is distinct from 'string'
    or length(profile->>'displayName') not between 1 and 40
    or jsonb_typeof(profile->'bio') is distinct from 'string' or length(profile->>'bio') > 160
    or coalesce(profile->>'avatar','') not in ('initial','smile','wink','grin','laugh','cool','love','starry','sleepy','surprised','curious','unimpressed','grumpy','shy','mischief','cheeky','zen','teary','monocle','nerd','headphones','stache','cyclops','alien','mask','astronaut','cat','robot','ghost')
    or coalesce(profile->>'background','') not in ('theme','theme-soft','ocean','violet','amber','coral','mint','slate','rose','midnight')
    or jsonb_typeof(profile->'featured') is distinct from 'array'
    or jsonb_array_length(profile->'featured') > 4
    or jsonb_typeof(profile->'updated') is distinct from 'string'
    or length(profile->>'updated') > 40 then return false; end if;
  if profile ? 'photo' and (
    jsonb_typeof(profile->'photo') is distinct from 'string'
    or length(profile->>'photo') > 1000
    or (profile->>'photo') !~ '^https://[^/?#@[:space:]]+/storage/v1/object/public/vela-avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  ) then return false; end if;
  for item in select value from jsonb_array_elements(profile->'featured') loop
    if not public.vela_shared_title_valid(item) then return false; end if;
  end loop;
  if k = 'profile' then
    if p ? 'review' or jsonb_typeof(p->'stats') is distinct from 'object'
      or (p->'stats') - array['watched','favorites','reviews','average'] <> '{}'::jsonb then return false; end if;
    foreach stat in array array['watched','favorites','reviews'] loop
      if jsonb_typeof(p->'stats'->stat) is distinct from 'number'
        or (p->'stats'->>stat)::numeric < 0
        or (p->'stats'->>stat)::numeric > 10000000
        or trunc((p->'stats'->>stat)::numeric) <> (p->'stats'->>stat)::numeric then return false; end if;
    end loop;
    if not (p->'stats' ? 'average') then return false; end if;
    if p->'stats'->'average' <> 'null'::jsonb and
      (jsonb_typeof(p->'stats'->'average') <> 'number'
       or (p->'stats'->>'average')::numeric not between 0 and 5) then return false; end if;
  elsif k = 'review' then
    item := p->'review';
    if p ? 'stats' or jsonb_typeof(item) is distinct from 'object'
      or item - array['title','rating','text','updated','spoiler'] <> '{}'::jsonb
      or (item ? 'spoiler' and jsonb_typeof(item->'spoiler') is distinct from 'boolean')
      or not public.vela_shared_title_valid(item->'title')
      or jsonb_typeof(item->'text') is distinct from 'string'
      or length(btrim(item->>'text')) not between 1 and 5000
      or jsonb_typeof(item->'rating') is distinct from 'number'
      or (item->>'rating')::numeric not between 0 and 5
      or jsonb_typeof(item->'updated') is distinct from 'string'
      or length(item->>'updated') > 40 then return false; end if;
  else return false;
  end if;
  return true;
exception when others then return false;
end;
$$;

notify pgrst,'reload schema';
commit;
