# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, equally:

- **Individual daily readers** — a believer (often on mobile, typically morning devotions) who wants to read the whole Bible on a schedule and keep a daily streak.
- **Small groups / church members** — the same habit done together, using shared plans, progress matrices, and nudges for mutual accountability.

## Product Purpose

Create a personalized Bible reading plan, track progress, read Scripture in-app, and receive gentle reminders. Success means users finish their plan — every chapter, no gaps — and sustain a daily reading habit over months, not weeks.

## Positioning

A habit + reminders engine for Scripture reading: timezone-aware gentle reminders (email, browser push, in-app), streaks, and missed-reading detection with continue/catch-up recovery. Neighboring Bible apps offer plans or reading text; the mechanism this product owns is the reminder-and-recovery loop that keeps a plan from silently dying in week two.

## Operating Context

- Personal devotional time, usually on a phone; sessions scheduled at user-chosen times (once/twice/thrice daily).
- Group use happens in church/small-group settings, asynchronous, via nudges rather than chat.
- Reminders run server-side on a 10-minute cron with per-user IANA timezones; delivery is email (Gmail SMTP), web push (VAPID), and in-app toasts.
- Deployed as a public web app on Vercel; Supabase PostgreSQL for data.
- PWA install with offline Scripture cache; reading and audio work without a connection once cached.

## Capabilities and Constraints

- Dynamic reading-plan generator covering all 1,189 Bible chapters — no skips, no duplicates; plan edits preserve completed history.
- In-app reader and audio Bible (marks chapters read on play completion); miss detection with continue/catch-up options.
- Dashboard, calendar, statistics, streaks; groups with shared progress matrices and nudges.
- Email/password auth with password reset; light/dark mode.
- **Free, no monetization** — no paid tier is planned.
- **Scripture licensing honesty** — only licensed or public-domain translations are listed (YouVersion Platform API key licensing primary, Free Use API fallback) with required attribution; never surface unlicensed versions (e.g. NKJV/NLT/ESV/CSB without a covering key).
- **Mobile-first PWA** — the core habit loop must work on any phone, offline-capable; desktop is secondary but supported.
- Localization: UI is English today; scope for other languages is undecided.

## Brand Commitments

- Name: **Bible Track** (tagline: *Read. Track. Finish.*).
- Voice: gentle and non-guilty — reminders encourage rather than shame; missed readings offer recovery ("You missed your morning Bible reading…"), never scolding.

## Evidence on Hand

- `README.md` — feature list, stack table, Scripture provider and licensing behavior.
- `PROJECT_CONTEXT.md` — working design/implementation record (uncommitted).
- 94 passing Vitest tests; live production app at https://bible-track.vercel.app.
- Scripture text is fetched from live APIs, not stored in the repo.
- **Absences:** no customer stories, testimonials, benchmarks, press, or usage analytics exist. Future work must not fabricate any of them.

## Product Principles

1. **Finish what you start** — plans cover every chapter, and the product offers recovery paths instead of letting a plan die.
2. **Reminders stay gentle and correct** — timezone-accurate, encouraging in tone, easy to mute; the reminder loop is the product, so it must never nag.
3. **Honest Scripture sourcing** — only translations we may legally serve, with attribution, even when that shrinks the list.
4. **Free and mobile-first** — the core loop works on any phone, offline, at no cost.
5. **Accountability reinforces the habit** — groups and nudges exist to support the individual daily reading, not to replace it with social pressure.
