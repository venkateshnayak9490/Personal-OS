-- Push notifications (docs/proposals/ADAPTIVE_DAY_AND_PUSH.md §2).
-- push_subscriptions: one row per device that turned on notifications.
-- push_queue: reminders to send, written by your devices; the send-due Edge Function sends due rows.
-- Safe to run more than once.

create table if not exists public.push_subscriptions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  -- "Chrome on Windows" etc., so Settings can list your devices.
  device text,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

create table if not exists public.push_queue (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The reminder's key (what + when), so two devices queueing the same reminder write one row.
  id text not null,
  fire_at timestamptz not null,
  title text not null,
  body text not null default '',
  url text not null default '/',
  sent_at timestamptz,
  attempts int not null default 0,
  primary key (user_id, id)
);

create index if not exists push_queue_due on public.push_queue (fire_at) where sent_at is null;

-- Rows always belong to the signed-in user, whatever the client sends.
create or replace function public.push_set_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_user on public.push_subscriptions;
create trigger push_subscriptions_user
  before insert or update on public.push_subscriptions
  for each row execute function public.push_set_user();

drop trigger if exists push_queue_user on public.push_queue;
create trigger push_queue_user
  before insert or update on public.push_queue
  for each row execute function public.push_set_user();

alter table public.push_subscriptions enable row level security;
alter table public.push_queue enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists push_queue_own on public.push_queue;
create policy push_queue_own on public.push_queue
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon;
revoke all on public.push_queue from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_queue to authenticated;
