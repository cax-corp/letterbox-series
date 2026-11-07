-- Vela: private settings and implicit taste signals. Run once in the existing project SQL Editor.
-- Re-runnable. Existing libraries, profiles and public links are preserved.
begin;
create or replace function public.vela_private_payload_valid(k text, p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare d jsonb;
begin
 if length(k) > 80 or jsonb_typeof(p) is distinct from 'object' or octet_length(p::text) > 12000 then return false; end if;
 if k in ('palette','theme','backupFrequency') then
  if p - 'value' <> '{}'::jsonb or jsonb_typeof(p->'value') is distinct from 'string' then return false; end if;
  return case k
   when 'palette' then p->>'value' in ('blue','champagne','iris','slate','emerald','coral','ruby','copper','silver')
   when 'theme' then p->>'value' in ('dark','light','system')
   when 'backupFrequency' then p->>'value' in ('daily','weekly','manual') end;
 elsif k = 'notifications' then
  d := p->'value';
  if p - 'value' <> '{}'::jsonb or jsonb_typeof(d) is distinct from 'object' or d - array['enabled','hour','minute','days'] <> '{}'::jsonb
   or jsonb_typeof(d->'enabled') is distinct from 'boolean' or jsonb_typeof(d->'hour') is distinct from 'number' or jsonb_typeof(d->'minute') is distinct from 'number'
   or (d->>'hour')::numeric not between 0 and 23 or (d->>'hour')::numeric <> trunc((d->>'hour')::numeric)
   or (d->>'minute')::numeric not between 0 and 59 or (d->>'minute')::numeric <> trunc((d->>'minute')::numeric)
   or jsonb_typeof(d->'days') is distinct from 'array' or jsonb_array_length(d->'days') not between 1 and 7 then return false; end if;
  if (select count(distinct value) from jsonb_array_elements(d->'days')) <> jsonb_array_length(d->'days') then return false; end if;
  for d in select value from jsonb_array_elements(d->'days') loop
   if jsonb_typeof(d) <> 'number' or d::text::numeric not between 0 and 6 or d::text::numeric <> trunc(d::text::numeric) then return false; end if;
  end loop;
  return true;
 elsif k ~ '^skip:(tmdb-)?movie-[0-9]+$' then
  d := p->'title';
  return coalesce(p - array['title','at','dwell'] = '{}'::jsonb
   and jsonb_typeof(d) = 'object' and d->>'id' = substring(k from 6) and d->>'kind' = 'movie'
   and jsonb_typeof(d->'name') = 'string' and length(d->>'name') <= 200
   and jsonb_typeof(d->'year') = 'string' and length(d->>'year') <= 10
   and d - array['id','kind','name','original','year','image','summary','genres','genreIds','source'] = '{}'::jsonb
   and jsonb_typeof(d->'summary') = 'string' and length(d->>'summary') <= 800
   and d->>'image' = '' and jsonb_typeof(d->'genres') = 'array' and jsonb_array_length(d->'genres') <= 20
   and not exists(select 1 from jsonb_array_elements(d->'genres') g where jsonb_typeof(g) <> 'string')
   and jsonb_typeof(p->'at') = 'number' and jsonb_typeof(p->'dwell') = 'number'
   and (p->>'dwell')::numeric >= 350 and (p->>'dwell')::numeric < 3000, false);
 end if;
 return false;
exception when others then return false;
end;
$$;
create table if not exists public.vela_private_state (
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null,
 payload jsonb not null,
 updated_at timestamptz not null,
 primary key(user_id,key),
 constraint valid_private_state check (public.vela_private_payload_valid(key,payload) is true)
);
alter table public.vela_private_state enable row level security;
revoke all on public.vela_private_state from anon;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.vela_private_state to authenticated;
drop policy if exists "Read own private state" on public.vela_private_state;
create policy "Read own private state" on public.vela_private_state for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own private state" on public.vela_private_state;
create policy "Insert own private state" on public.vela_private_state for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own private state" on public.vela_private_state;
create policy "Update own private state" on public.vela_private_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own private state" on public.vela_private_state;
create policy "Delete own private state" on public.vela_private_state for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.vela_merge_private_state(items jsonb)
returns setof public.vela_private_state language plpgsql security invoker set search_path = '' as $$
declare item jsonb; who uuid := auth.uid(); stamp timestamptz;
begin
 if who is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 128 then raise exception 'Invalid state batch'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if item - array['key','payload','updated_at'] <> '{}'::jsonb or public.vela_private_payload_valid(item->>'key',item->'payload') is distinct from true then raise exception 'Invalid state'; end if;
  stamp := (item->>'updated_at')::timestamptz;
  if stamp is null or stamp > now() + interval '5 minutes' then raise exception 'Invalid state timestamp'; end if;
  if item->>'key' like 'skip:%' and abs(extract(epoch from stamp)*1000 - (item->'payload'->>'at')::numeric) > 1 then raise exception 'Invalid signal timestamp'; end if;
  insert into public.vela_private_state(user_id,key,payload,updated_at)
   values(who,item->>'key',item->'payload',stamp)
   on conflict(user_id,key) do update set payload = excluded.payload, updated_at = excluded.updated_at
   where excluded.updated_at > public.vela_private_state.updated_at;
 end loop;
 delete from public.vela_private_state where user_id = who and key like 'skip:%' and updated_at < now() - interval '30 days';
 delete from public.vela_private_state where user_id = who and key in (
  select key from public.vela_private_state where user_id=who and key like 'skip:%' order by updated_at desc,key offset 120
 );
 return query select * from public.vela_private_state where user_id = who and key in (select value->>'key' from jsonb_array_elements(items));
end;
$$;
revoke all on function public.vela_merge_private_state(jsonb) from public,anon;
grant execute on function public.vela_merge_private_state(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
