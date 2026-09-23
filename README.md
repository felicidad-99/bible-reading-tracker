# Bible Reading Tracker

A production-ready web app for creating a personalized Bible reading plan, tracking progress, reading Scripture in-app, and receiving gentle reminders.

## Features

- Dynamic reading-plan generator (1,189 chapters, no skips or duplicates)
- Once / twice / thrice daily sessions at custom times
- Dashboard, calendar, statistics, streaks
- In-app Bible reader (YouVersion Platform API, Free Use API fallback)
- Missed reading detection with continue / catch-up options
- Plan editing without losing completed history
- Email/password auth with Gmail SMTP password reset
- In-app + browser notification reminders
- PWA install + offline Scripture cache
- Light / dark mode, mobile-first UI

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (Supabase) + Prisma |
| Auth | Auth.js (NextAuth v5) credentials |
| Email | Nodemailer via Gmail SMTP |
| Bible API | [YouVersion Platform](https://platform.youversion.com) primary, [Free Use Bible API](https://bible.helloao.org) fallback |
| Hosting | Vercel |
| Tests | Vitest |

## Scripture providers

- **YouVersion Platform API** (when `YVP_APP_KEY` is set): licensed versions available to your app key, required attribution/copyright in the reader
- **Free Use Bible API** (default/fallback): no key, public-domain-friendly English Bibles (KJV, WEB, Darby, etc.)
- Translation dropdown is a **merged** list of both providers (YouVersion preferred when both have the same version)
- Missing key, rate limits, or YouVersion errors automatically fall back to Free Use
- NKJV / NLT / ESV / CSB are **not** listed unless licensed for your YouVersion app key (they are not on Free Use)

## Local development

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with Supabase DATABASE_URL, AUTH_SECRET, Gmail SMTP, NEXT_PUBLIC_APP_URL

# 3. Push database schema
npx prisma db push

# 4. Run
npm run dev
```

Open http://localhost:3000

### Gmail password reset

1. Enable 2-Step Verification on the Google account
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. Set:
   ```env
   EMAIL_SERVER="smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465"
   EMAIL_FROM="you@gmail.com"
   ```

## Environment variables

See `.env.example`:

- `DATABASE_URL` - Supabase Postgres (use pooler connection string)
- `AUTH_SECRET` - `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL` - e.g. `http://localhost:3000` or Vercel URL
- `EMAIL_SERVER` / `EMAIL_FROM` - Gmail SMTP for password reset
- `BIBLE_API_URL` - Free Use API base; defaults to `https://bible.helloao.org`
- `YVP_APP_KEY` - YouVersion Platform App Key (optional primary provider)

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Plan generator unit tests |
| `npx prisma db push` | Push schema to database |
| `npx prisma migrate deploy` | Run migrations |

## Deploy (Vercel + Supabase)

1. Create a Supabase project → copy **Transaction/pooler** `DATABASE_URL`
2. Locally: `npx prisma db push`
3. Push repo to GitHub → import in Vercel
4. Set env vars listed above (`NEXT_PUBLIC_APP_URL` = Vercel URL)
5. Deploy
6. Add `https://your-app.vercel.app` to allowed origins if needed

## Reading plan algorithm

- Flattens 66 books into 1,189 chapters
- Largest-remainder distribution across days (max-min daily load ≤ 1)
- Same method splits each day into sessions without splitting chapters
- Regeneration only rebuilds incomplete days; progress history is immutable

## Testing

```bash
npm test
```

Covers 7/30/365-day plans, frequencies 1–3, edge cases (1-day, month-end, leap year), streaks, statuses, regeneration.

## Known limitations

- True Web Push while the browser is closed is not included (structured for later; in-app reminders work while open)
- Password reset requires Gmail SMTP to be configured
- Bible text caching is per-server instance (in-memory) + service worker on client

## Recommended improvements

- Web Push + backend scheduler
- Google OAuth
- Verse-weighted chapter balancing
- Multi-device offline conflict UI
- Downloadable plan export (ICS / CSV)
