-- Vela 2.9.1: compressed profile photos. Run once in the Supabase SQL Editor.
-- Safe to rerun. Existing profiles, collections and shared links are preserved.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vela-avatars', 'vela-avatars', true, 65536, array['image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The public image endpoint serves an avatar by its unguessable URL. Object listing and writes remain owner-only.
-- Supabase owns storage.objects and already enables RLS. Do not ALTER this managed table.
drop policy if exists "Vela avatars: read own objects" on storage.objects;
create policy "Vela avatars: read own objects" on storage.objects for select to authenticated
using (bucket_id = 'vela-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
drop policy if exists "Vela avatars: upload own photo" on storage.objects;
create policy "Vela avatars: upload own photo" on storage.objects for insert to authenticated
with check (bucket_id = 'vela-avatars' and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
drop policy if exists "Vela avatars: remove own photo" on storage.objects;
create policy "Vela avatars: remove own photo" on storage.objects for delete to authenticated
using (bucket_id = 'vela-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

-- Extend public snapshots with an optional image URL; no base64 image or private upload is copied there.
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

notify pgrst, 'reload schema';
commit;
