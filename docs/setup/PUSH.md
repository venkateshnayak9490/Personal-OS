# Turning on notifications when the app is closed (Supabase)

This is a one-time setup, about 5 minutes, all in the Supabase dashboard. It's free on the free plan. Sync must already be on (see `SUPABASE.md`).

How it works: your devices put upcoming reminders in a queue on Supabase. Every minute a small function (`send-due`) sends the ones that are due to every device where you turned notifications on. See `docs/proposals/ADAPTIVE_DAY_AND_PUSH.md` §2.

You need three values: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET`. They were generated for you into a private file outside the repo. Keep the private key and the cron secret out of git and chat. If you lose them, a new key pair can be generated; the public key in `src/core/sync/push.ts` must match.

## 1. Create the tables

SQL Editor → New query → paste the whole of `supabase/migrations/20261125000000_push.sql` → **Run**. It's safe to run twice.

## 2. Switch on two extensions

Database → Extensions → switch on **pg_cron** and **pg_net**.

## 3. Add the secrets

Edge Functions → Secrets (or Project Settings → Edge Functions) → add these three:

| Name                | Value             |
| ------------------- | ----------------- |
| `VAPID_PUBLIC_KEY`  | from the key file |
| `VAPID_PRIVATE_KEY` | from the key file |
| `CRON_SECRET`       | from the key file |

## 4. Create the function

Edge Functions → **Deploy a new function** → **Via Editor**:

- Name: `send-due`.
- Replace the sample code with the whole of `supabase/functions/send-due/index.ts` → **Deploy**.
- In the function's **Details / Settings**, turn **off** "Enforce JWT verification" (also called "Verify JWT"). It checks `CRON_SECRET` itself, so only your cron job can run it.

## 5. Run it every minute

SQL Editor → New query. Replace `PASTE_CRON_SECRET` with the `CRON_SECRET` value, then **Run**:

```sql
select vault.create_secret('PASTE_CRON_SECRET', 'push_cron_secret');

select cron.schedule(
  'push-send-due',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://mqxdfdoufcveydqbkhwe.supabase.co/functions/v1/send-due',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## 6. Turn it on in the app

On each device: Settings → Reminders & privacy → **When the app is closed** → **Turn on for this device** → allow notifications. Then press **Send a test**, switch to another app, and the test arrives within a minute.

- **iPhone/iPad:** add the app to the Home Screen first (Share → Add to Home Screen), open it from there, then turn it on. Needs iOS 16.4 or later.
- **Windows/macOS:** notifications arrive while Chrome or Edge is running, even if the app's window is closed.

## If the test doesn't arrive

- **Supabase → Edge Functions → send-due → Logs.** A `403` means the `CRON_SECRET` in step 3 and step 5 differ. A `500` mentioning VAPID means a key is missing or has a typo.
- **SQL:** `select * from cron.job_run_details order by start_time desc limit 5;` shows whether the job runs.
- **SQL:** `select id, fire_at, sent_at, attempts from push_queue order by fire_at desc limit 5;` shows whether the test was queued and sent.
- Windows: check that notifications for Chrome or Edge are allowed in Windows Settings → System → Notifications.

## Undo

```sql
select cron.unschedule('push-send-due');
```

Then delete the function, and drop the tables `push_queue` and `push_subscriptions`.
