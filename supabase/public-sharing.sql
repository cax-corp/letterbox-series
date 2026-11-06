-- Vela: public link snapshots. Execute once in the Supabase SQL Editor; safe to rerun.
-- Only explicit shares are published. public.library and auth metadata stay private.
begin;

create or replace function public.vela_shared_title_valid(t jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(t) = 'object'
    and t - array['id','kind','name','year','image','summary','genres','source'] = '{}'::jsonb
    and t->>'id' ~ '^(tmdb-)?(movie|series)-[0-9]+$'
    and t->>'kind' in ('movie','series')
    and (t->>'id' ~ ('^(tmdb-)?' || (t->>'kind') || '-[0-9]+$'))
    and jsonb_typeof(t->'name') = 'string' and length(t->>'name') between 1 and 160
    and jsonb_typeof(t->'year') = 'string' and length(t->>'year') <= 10
    and jsonb_typeof(t->'image') = 'string' and length(t->>'image') <= 1000
    and ((t->>'image') = '' or (t->>'image') ~ '^https://')
    and t->>'summary' = '' and t->'genres' = '[]'::jsonb
    and (not (t ? 'source') or t->>'source' in ('tmdb','itunes','tvmaze')),
    false
  );
$$;

create or replace function public.vela_shared_payload_valid(k text, p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare profile jsonb; item jsonb; stat text;
begin
  if jsonb_typeof(p) is distinct from 'object'
    or p - array['version','profile','stats','review'] <> '{}'::jsonb
    or p->'version' is distinct from '1'::jsonb then return false; end if;
  profile := p->'profile';
  if jsonb_typeof(profile) is distinct from 'object'
    or profile - array['version','displayName','bio','avatar','background','featured','updated'] <> '{}'::jsonb
    or profile->'version' is distinct from '1'::jsonb
    or jsonb_typeof(profile->'displayName') is distinct from 'string'
    or length(profile->>'displayName') not between 1 and 40
    or jsonb_typeof(profile->'bio') is distinct from 'string' or length(profile->>'bio') > 160
    or coalesce(profile->>'avatar','') not in ('initial','astronaut','cat','robot','ghost')
    or coalesce(profile->>'background','') not in ('ocean','violet','amber','coral','mint','slate','rose','midnight')
    or jsonb_typeof(profile->'featured') is distinct from 'array'
    or jsonb_array_length(profile->'featured') > 4
    or jsonb_typeof(profile->'updated') is distinct from 'string'
    or length(profile->>'updated') > 40 then return false; end if;
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
      or item - array['title','rating','text','updated'] <> '{}'::jsonb
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

create table if not exists public.vela_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('profile','review')),
  target text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique (owner_id,kind,target),
  constraint vela_share_content check (public.vela_shared_payload_valid(kind,payload)),
  constraint vela_share_size check (octet_length(payload::text) <= 30000),
  constraint vela_share_target check (
    (kind = 'profile' and target = 'profile') or
    (kind = 'review' and target = payload->'review'->'title'->>'id')
  )
);
alter table public.vela_shares enable row level security;
revoke all on public.vela_shares from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select (id,kind,payload,updated_at) on public.vela_shares to anon;
grant select,insert,update,delete on public.vela_shares to authenticated;
drop policy if exists "Published links are readable" on public.vela_shares;
create policy "Published links are readable" on public.vela_shares for select to anon, authenticated using (true);
drop policy if exists "Publish own links" on public.vela_shares;
create policy "Publish own links" on public.vela_shares for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Update own links" on public.vela_shares;
create policy "Update own links" on public.vela_shares for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "Remove own links" on public.vela_shares;
create policy "Remove own links" on public.vela_shares for delete to authenticated using ((select auth.uid()) = owner_id);

notify pgrst, 'reload schema';
commit;
