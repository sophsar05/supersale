# Supersale.ph — Full-Stack MVP Setup Guide

## What's included
```
supersale/
├── index.html                          ← The entire frontend (deploy this)
├── sql/
│   └── schema.sql                      ← Run once in Supabase SQL Editor
└── supabase/
    └── functions/
        └── notify-restock/
            └── index.ts                ← Edge Function for SMS notifications
```

---

## Step 1 — Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Pick a name (e.g. `supersale`) and a strong DB password
3. Wait ~2 minutes for provisioning

---

## Step 2 — Run the database schema
1. Dashboard → **SQL Editor** → New query
2. Paste the contents of `sql/schema.sql` → **Run**
3. This creates: `stores`, `deals`, `restock_requests` tables with RLS policies

---

## Step 3 — Create the Storage bucket
1. Dashboard → **Storage** → New bucket
2. Name: `shelf-photos`
3. Toggle **Public bucket** → ON
4. Create the bucket

---

## Step 4 — Wire the frontend
Open `index.html` and replace lines at the top:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';   // ← your project URL
const SUPABASE_ANON = 'YOUR_ANON_KEY';                      // ← your anon/public key
```

Find both values in: Dashboard → **Settings → API**

---

## Step 5 — Deploy the Edge Function (for SMS)
Install the Supabase CLI first:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Then deploy:
```bash
supabase functions deploy notify-restock
```

Add your Semaphore.ph API key as a secret:
```bash
supabase secrets set SEMAPHORE_API_KEY=your_semaphore_key
supabase secrets set SEMAPHORE_SENDER=SUPERSALE
```

Get a Semaphore.ph API key at [semaphore.co](https://semaphore.co) — Philippine SMS, ~₱0.50/SMS.

---

## Step 6 — Deploy the frontend
**Option A — Netlify (recommended, free)**
1. Drag the `supersale/` folder into [netlify.com/drop](https://app.netlify.com/drop)
2. Done. You get a URL like `https://supersale-abc123.netlify.app`

**Option B — Your own domain**
Point your domain's DNS to Netlify and set a custom domain.

---

## Step 7 — Generate QR codes
Each store/aisle gets a unique URL:
```
https://yourdomain.com?store_id=SM-IMUS-001&aisle=3
```

Use any QR generator (e.g. [qr-code-generator.com](https://www.qr-code-generator.com)) to create printable QR stickers for each aisle.

---

## Store IDs (pre-seeded)
| ID | Store |
|---|---|
| `SM-IMUS-001` | SM Hypermarket – Imus |
| `SM-CAVITE-02` | SM Savemore – Bacoor |
| `PUREGOLD-IMUS` | Puregold – Imus |
| `ROBINSONS-CIV` | Robinsons – Dasmariñas |

Add more stores by inserting into the `stores` table via Supabase Dashboard → Table Editor.

---

## How Realtime works
When staff publish a deal via the Upload tab, it instantly appears on all customer devices viewing the same store — no refresh needed. This is powered by Supabase Realtime (Postgres CDC over WebSocket).

---

## Cost estimate (Supabase free tier)
- **Database**: 500MB included → handles ~millions of rows
- **Storage**: 1GB included → hundreds of shelf photos
- **Edge Functions**: 500K invocations/month free
- **Realtime**: 200 concurrent connections free

Supabase free tier is sufficient for a single-store MVP. Upgrade when you need more.
