-- Personal OS: sync storage (build.md §9.2).
-- One row per record, as JSON. Private journal entries and the Vault arrive already encrypted.
-- Run once in your Supabase project: Dashboard → SQL Editor → paste this file → Run.

create table if not exists public.sync_rows (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl text not null,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  -- Server-assigned on every write; devices pull "everything after seq N".
  seq bigint not null default 0,
  primary key (user_id, tbl, id)
);

create sequence if not exists public.sync_seq;

-- Sets the sequence number, and the owner from the signed-in user (never from the client).
create or replace function public.sync_rows_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.seq := nextval('public.sync_seq');
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists sync_rows_stamp on public.sync_rows;
create trigger sync_rows_stamp
  before insert or update on public.sync_rows
  for each row execute function public.sync_rows_stamp();

create index if not exists sync_rows_user_seq on public.sync_rows (user_id, seq);

-- Row-level security: each account sees and changes only its own rows.
alter table public.sync_rows enable row level security;

drop policy if exists sync_rows_select_own on public.sync_rows;
create policy sync_rows_select_own on public.sync_rows
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists sync_rows_insert_own on public.sync_rows;
create policy sync_rows_insert_own on public.sync_rows
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists sync_rows_update_own on public.sync_rows;
create policy sync_rows_update_own on public.sync_rows
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists sync_rows_delete_own on public.sync_rows;
create policy sync_rows_delete_own on public.sync_rows
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-out visitors get nothing at all.
revoke all on public.sync_rows from anon;
grant select, insert, update, delete on public.sync_rows to authenticated;
