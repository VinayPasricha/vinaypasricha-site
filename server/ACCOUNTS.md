# Opening the three accounts — plain, click-by-click

You are renting three small utilities. **All three are free until you have real users.** You do not need to understand them — just create them and paste a few values into one file (`.env`, copied from `.env.example`).

Think of it as three keys on a keyring. When all three are in `.env`, the server can run.

---

## Utility 1 — the memory store (a database: Postgres)

This holds recent raw conversation and the fast "projections." Recommended: **Neon** (neon.tech) — free, no card.

1. Go to **neon.tech** → **Sign up** (use your Google account).
2. Click **Create project**. Name it `vinay-runtime`. Region: closest to your users. Click **Create**.
3. On the project page, find **Connection string** (a line starting `postgresql://…`). Click **copy**.
4. Paste it into `.env` as `DATABASE_URL=…`.

Done. (Supabase works too — same idea, copy its Postgres connection string.)

---

## Utility 2 — the file vault (object storage: the permanent, sacred files)

This holds the Essence Log forever. Recommended: **Cloudflare R2** (or Backblaze B2). No egress fees.

1. Go to **dash.cloudflare.com** → sign up → left menu **R2**.
2. Click **Create bucket**. Name it `runtime-essence`. **Create**.
3. Go to **R2 → Manage API Tokens → Create API Token** (read & write). It shows an **Access Key ID** and **Secret Access Key** **once** — copy both now.
4. Note your account's **S3 API endpoint** (shown on the R2 overview, looks like `https://<id>.r2.cloudflarestorage.com`).
5. Paste into `.env`: `S3_ENDPOINT`, `S3_BUCKET=runtime-essence`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

---

## Utility 3 — "Sign in with Google"

This lets visitors sign in. Free.

1. Go to **console.cloud.google.com** → create a project `vinay-runtime`.
2. **APIs & Services → OAuth consent screen** → External → fill app name + your email → Save.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Web application**.
4. Under **Authorized JavaScript origins** add your site (e.g. `https://vinaypasricha.com`) and `http://localhost:3000` for testing.
5. It shows a **Client ID** and **Client secret** — copy both.
6. Paste into `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

---

## The one decision only you can make — the three keepers

Every user's memories are locked with a master key. If every copy of that key is lost, the memories are unreadable **forever**. So the emergency backup of the master key is split into **three pieces**, given to **three keepers** — **any two pieces together** can restore it; **one piece alone is useless.**

**You choose the three keepers.** Each should be a trusted person or a secure place:

- Keeper 1: ________________  (e.g. you — a bank locker / safe)
- Keeper 2: ________________  (e.g. a co-founder / lawyer)
- Keeper 3: ________________  (e.g. a second secure location)

When the server is first set up, it will generate the master key and print the three pieces **once**. Give one piece to each keeper. Write nothing else down. (The day-to-day key lives in a managed KMS; these three pieces are only the break-glass backup.)

> You don't act on this yet — just decide the three names/places now, so they're ready when the server is switched on.

---

## When all three are done

Your `.env` has: `DATABASE_URL`, the five `S3_*` values, and the two `GOOGLE_*` values. That's the keyring complete. Next: hand `server/` to a developer for a few days, or sit with Claude Design and run `server/README.md`'s checklist step by step.
