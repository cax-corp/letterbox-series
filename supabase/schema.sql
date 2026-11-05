-- Luma: run in SQL Editor of the project configured in the app. Safe to rerun.
-- No service-role key in the app; collections remain private via RLS.
begin;
create table if not exists public.library (
 user_id uuid not null references auth.users(id) on delete cascade,
 title_id text not null,
 entry jsonb not null,
 primary key (user_id,title_id),
 constraint valid_title check (entry->'title'->>'id' = title_id),
 constraint entry_size check (octet_length(entry::text) < 200000)
);
alter table public.library enable row level security;
grant usage on schema public to authenticated;
revoke all on public.library from anon;
grant select,insert,update,delete on public.library to authenticated;
drop policy if exists "Read own library" on public.library;
create policy "Read own library" on public.library for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own library" on public.library;
create policy "Insert own library" on public.library for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own library" on public.library;
create policy "Update own library" on public.library for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own library" on public.library;
create policy "Delete own library" on public.library for delete to authenticated using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
commit;
