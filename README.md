# Sarkari Naukari

A Next.js 16 and Firebase Firestore government recruitment portal with automated Firecrawl scraping, Cloudflare Workers AI extraction, official source verification, and Vercel Hobby Cron scheduling.

## Stack

- Next.js 16 (App Router, Turbopack)
- Firebase Auth & Cloud Firestore (`firebase` + `firebase-admin`)
- Firecrawl API for recruitment discovery & scraping
- Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`) for structured extraction & bilingual (English + Hindi) job summarization
- Vercel Cron Jobs

## Vercel Hobby Deployment & Cron Setup

Vercel Hobby plans allow **one daily cron job**. [vercel.json](vercel.json) is configured with a single daily schedule at **02:00 UTC**:

```json
{
  "crons": [
    {
      "path": "/api/cron/run-automation",
      "schedule": "0 2 * * *"
    }
  ]
}
```

`GET /api/cron/run-automation` executes the full daily pipeline within Vercel's execution budget using Firestore execution locks (`automation_locks/`):
1. Closes expired `published` listings (`application_end_date < today`).
2. Discovers new recruitment URLs via Firecrawl into `scraped_candidates/`.
3. Processes a bounded batch of pending candidates (scrape → Cloudflare AI extraction → official verification → duplicate check → Firestore insertion).
4. Verifies a small batch of existing published jobs for updates.

Unfinished candidates remain `pending` in Firestore and resume on the next run.

### Optional External Free Scheduler

Individual `CRON_SECRET`-protected endpoints remain available for external schedulers (e.g. cron-job.org) using `Authorization: Bearer <CRON_SECRET>`:
- `GET /api/cron/discover-jobs`
- `GET /api/cron/process-candidates`
- `GET /api/cron/verify-jobs`
- `GET /api/cron/update-job-status`

## Environment Variables

Configure these server-only and public variables in `.env.local` and **Vercel → Project Settings → Environment Variables** (see [.env.example](.env.example)):

- `NEXT_PUBLIC_FIREBASE_*`
- `FIREBASE_SERVICE_ACCOUNT` (or `NEXT_FIREBASE_SERVICE_ACCOUNT`)
- `ADMIN_EMAILS`
- `FIRECRAWL_API_KEY` (or `NEXT_FIRECRAWL_API_KEY`)
- `CLOUDFLARE_ACCOUNT_ID` & `CLOUDFLARE_API_TOKEN` (or `NEXT_CLOUDFLARE_*`)
- `CRON_SECRET` (or `NEXT_CRON_SECRET`)
