# Mission Capture — store chats in MongoDB + host on AWS

This backend serves the static site **and** stores the Organizational Frequency
"Mission Capture" chats in MongoDB. Chats are stored **anonymously** — no Google
sign-in required. This guide covers: (1) creating a free MongoDB account, (2)
running it locally, and (3) hosting on AWS.

---

## 0. What's already wired

- **Runtime:** `frequency/index.html` (Mission Capture). The chat is recorded
  turn-by-turn by `frequency/of-chat-store.js` and saved to the backend.
- **API:** `POST /api/runtimes/of/conversations` (save) and
  `GET /api/runtimes/of/conversations/:sessionId` (read one back). No auth.
- **Storage:** collection `of_conversations` in MongoDB. Each chat auto-deletes
  30 days after its last activity (`CONVERSATION_TTL_DAYS`).
- **Dev fallback:** with no `MONGODB_URI`, the server boots a throwaway
  in-memory MongoDB so you can test instantly (data is wiped on restart).

Prove the storage works without any setup:

```bash
cd backend
npm install              # first time only
npm run simulate:of      # 15 checks, uses in-memory MongoDB
```

---

## 1. Create a free MongoDB account (Atlas)

You don't create the "collection" by hand — the app creates `of_conversations`
automatically on the first saved chat. You only need a **connection string**.

1. Go to <https://www.mongodb.com/cloud/atlas/register> and sign up (free).
2. Create a project, then **Build a Database** → choose the **M0 (Free)** tier →
   pick a cloud/region close to you → **Create**.
3. **Database Access** (left menu) → **Add New Database User**:
   - Username + a strong password (save it).
   - Role: *Read and write to any database* (or just the `vinay` db).
4. **Network Access** (left menu) → **Add IP Address**:
   - For local testing: *Allow access from anywhere* (`0.0.0.0/0`).
   - For AWS: add your server's public IP (tighter, recommended for production).
5. **Database** → **Connect** → **Drivers** → copy the connection string. It
   looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/vinay?retryWrites=true&w=majority
   ```
   Replace `USER`/`PASSWORD` with the database user you created, and keep
   `/vinay` as the database name.

---

## 2. Configure the backend

```bash
cd backend
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Edit `backend/.env`:

```ini
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/vinay?retryWrites=true&w=majority
MONGODB_DB=vinay
PORT=4000
# Add your real domain here before launch (comma-separated):
ALLOWED_ORIGINS=http://localhost:4000,http://localhost:8000,https://YOURDOMAIN.com
CONVERSATION_TTL_DAYS=30
# GOOGLE_CLIENT_ID is OPTIONAL — only the older SIV runtime uses sign-in.
```

`.env` is gitignored — never commit it.

Run it:

```bash
npm start
```

Open <http://localhost:4000/frequency/index.html>, complete the 5 questions, and
the chat appears in Atlas under **Collections → vinay → of_conversations**.

> Verify against your real database:
> ```bash
> npm run simulate:of      # now writes to Atlas (auto-cleans up)
> ```

---

## 3. Host on AWS

The backend is one Node service (Node 20+) that **also serves the static site**,
so you deploy *one* thing. Pick whichever fits.

### Option A — EC2 (most direct with the AWS CLI)

```bash
# 1. Launch a small instance (Amazon Linux 2023, t3.micro is fine)
aws ec2 run-instances \
  --image-id ami-xxxxxxxx \
  --instance-type t3.micro \
  --key-name YOUR_KEY \
  --security-group-ids sg-xxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=vinay-site}]'
```

Open ports **80/443** (and **22** for SSH) in the security group. Then SSH in:

```bash
sudo dnf install -y nodejs git          # Node 20+
git clone <your repo>  &&  cd <repo>/backend
npm install --omit=dev
# Create .env with your real MONGODB_URI + ALLOWED_ORIGINS (see step 2)
# Keep it running across reboots/crashes:
sudo npm install -g pm2
pm2 start src/server.js --name vinay-site
pm2 startup && pm2 save
```

Put **HTTPS** in front (Nginx + Certbot, or an AWS ALB with an ACM cert) and
point your domain's DNS at the instance. Add `https://YOURDOMAIN.com` to
`ALLOWED_ORIGINS`. In Atlas → Network Access, add the instance's public IP.

> Tip: set `PORT=80` in `.env`, or run behind Nginx mapping 80/443 → 4000.

### Option B — Elastic Beanstalk (managed, less ops)

```bash
cd backend
eb init --platform "Node.js 20" --region <your-region>
eb create vinay-site-env
# Set secrets (do NOT commit .env):
eb setenv MONGODB_URI="mongodb+srv://..." MONGODB_DB=vinay \
          ALLOWED_ORIGINS="https://YOURDOMAIN.com" CONVERSATION_TTL_DAYS=30
eb deploy
```

Beanstalk reads `PORT` from the environment automatically (the app already uses
`process.env.PORT`).

### Notes for any AWS option

- **Run the backend from the repo root context.** It serves the site from one
  level above `backend/` (`SITE_ROOT`), so deploy the whole repo, then run
  `npm start` inside `backend/`.
- **Don't host the private folders.** `app.js` already blocks `/uploads`,
  `/_brief`, `/_prompts`, `/scraps`, `/_audit`, `/backend`, `/server`, `/.git`.
- **Atlas IP allow-list:** switch from `0.0.0.0/0` to the server's IP for prod.
- **Secrets:** keep `MONGODB_URI` in the environment (EC2 `.env`, Beanstalk
  `eb setenv`, or AWS Secrets Manager) — never in git.

---

## 4. Where the chats live

| Thing            | Value                                                   |
|------------------|---------------------------------------------------------|
| Database         | `vinay` (from `MONGODB_DB`)                              |
| Collection       | `of_conversations`                                       |
| One document     | one Mission Capture chat (keyed by `sessionId`)          |
| Lead fields      | `name`, `email`, `organizationName` (from the chat)      |
| Full transcript  | `messages[]` (role + content + timestamp)               |
| Assembled result | `artefact` (the Mission Spine: org + mission + person)   |
| Auto-delete      | 30 days after last activity (TTL index on `expiresAt`)   |
