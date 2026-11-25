// Edge Function "send-due": called every minute by pg_cron. Sends each due push_queue row once to
// every device of its owner, then stamps sent_at. Expired subscriptions (404/410) are deleted.
// Secrets (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';

const MAX_TRIES = 3;
/** Older than this and never sent (server was down): drop it rather than nag hours late. */
const STALE_MS = 60 * 60 * 1000;

webpush.setVapidDetails(
  'https://personal-os-ruby-xi.vercel.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface Row {
  user_id: string;
  id: string;
  fire_at: string;
  title: string;
  body: string;
  url: string;
  attempts: number;
}
interface Sub {
  user_id: string;
  device: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`)
    return new Response('forbidden', { status: 403 });

  const now = Date.now();
  const { data: due, error } = await db
    .from('push_queue')
    .select('user_id,id,fire_at,title,body,url,attempts')
    .is('sent_at', null)
    .lte('fire_at', new Date(now).toISOString())
    .lt('attempts', MAX_TRIES)
    .limit(500);
  if (error) return new Response(error.message, { status: 500 });
  if (!due?.length) return Response.json({ sent: 0 });

  const users = [...new Set(due.map((r) => r.user_id))];
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id,device,endpoint,p256dh,auth')
    .in('user_id', users);

  let sent = 0;
  const failures: { device: string | null; status: number | string }[] = [];
  for (const row of due as Row[]) {
    // Claim the row first: it's marked sent before anything goes out, so a failed write or an
    // overlapping run can only ever skip a notification, never repeat it.
    const { data: claimed, error: claimError } = await db
      .from('push_queue')
      .update({ sent_at: new Date().toISOString() })
      .match({ user_id: row.user_id, id: row.id })
      .is('sent_at', null)
      .select('id');
    if (claimError) {
      console.error('claim failed', row.id, claimError.message);
      continue;
    }
    if (!claimed?.length) continue; // another run took it
    if (now - Date.parse(row.fire_at) > STALE_MS) continue; // too late to be useful: dropped

    const payload = JSON.stringify({ title: row.title, body: row.body, url: row.url, tag: row.id });
    const mine = (subs ?? []).filter((x: Sub) => x.user_id === row.user_id) as Sub[];
    let ok = false;
    for (const s of mine) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 3600, urgency: 'high' },
        );
        ok = true;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        failures.push({ device: s.device, status: code ?? String(e) });
        console.error('push failed', s.device, code, String(e));
        if (code === 404 || code === 410)
          await db.from('push_subscriptions').delete().match({ user_id: s.user_id, endpoint: s.endpoint });
      }
    }
    // Every device failed (and some exist): release the row for another try, up to MAX_TRIES.
    if (!ok && mine.length)
      await db
        .from('push_queue')
        .update({ sent_at: null, attempts: row.attempts + 1 })
        .match({ user_id: row.user_id, id: row.id });
    if (ok) sent++;
  }
  return Response.json({ sent, failures });
});
