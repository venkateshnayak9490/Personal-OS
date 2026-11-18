# Turning on sync (Supabase)

Sync needs a free Supabase project that **you** create (it's your account and your data). About 10 minutes.
Do not paste any keys into a chat; they go only into the two places in steps 6 and 7.

## 1. Create the project

1. Go to supabase.com and sign in (GitHub or email).
2. **New project**. Name: `personal-os`. Database password: generate one and keep it in your password manager (the app never needs it). Region: the closest to you (for India: Mumbai). Plan: Free.
3. Wait a minute while it starts.

## 2. Create the sync table

1. In the project: **SQL Editor → New query**.
2. Open `supabase/migrations/20261118000000_sync.sql` from this repository, copy all of it, paste it, and press **Run**.
3. It should say "Success. No rows returned". This creates one table, `sync_rows`, with row-level security: each account can only ever read or change its own rows.

## 3. Sign-in links

1. **Authentication → URL Configuration**.
2. **Site URL**: `https://personal-os-ruby-xi.vercel.app`
3. **Redirect URLs**, add both:
   - `https://personal-os-ruby-xi.vercel.app/**`
   - `http://localhost:5173/**`
4. **Authentication → Sign In / Providers → Email** should be on (it is by default). Sign-in uses an emailed link; there's no password.

## 4. Copy the two public values

**Project Settings → API Keys** (or the **Connect** button at the top):

- the **Project URL** (`https://xxxx.supabase.co`)
- the **publishable** key (`sb_publishable_…`). If you only see "anon public", that one works too.

Never use the **secret** / **service_role** key anywhere in this app.

## 5. Put them in the app

**On this computer:** in the project folder, copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env.local` is ignored by git, so it's never committed. Restart `npm run dev`.

**On Vercel:** Project → **Settings → Environment Variables** → add the same two names and values (Production and Preview) → **Deployments → Redeploy** the latest one.

## 6. Sign in

Open the app → **Settings → Account & sync** → enter your email → open the link in the email **on the same device**.
Your data uploads and merges. On your phone: the welcome screen has **"Already use Personal OS on another device? Sign in"** (use it instead of the starter questions, so you don't get duplicate sections).

## 7. Close the door behind you (recommended)

The app's address is public, so anyone could create an account on your project (they'd see nothing of yours, but they'd use your free quota). After you and any other devices have signed in once:
**Authentication → Sign In / Providers → turn off "Allow new users to sign up"**.

## Good to know

- The Vault and private journal entries reach the server already encrypted. Supabase only ever sees ciphertext for them.
- Attached files (and Vault files) stay on the device that added them for now; only their names sync.
- The free plan pauses a project after a week with no activity; opening the app regularly keeps it awake (or press **Restore** in the dashboard).
- Supabase's built-in email sender allows only a few sign-in emails per hour, which is plenty for one person.
