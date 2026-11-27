import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CloudflareApiError,
  CloudflareConfigError,
  CloudflareRateLimitError,
  runCloudflarePrompt,
} from '@/lib/ai/cloudflare'
import { getJobBySlug } from '@/lib/queries/jobs'

const requestSchema = z.object({
  slug: z.string().trim().min(1).max(200),
})

const RATE_WINDOW_MS = 60_000
const RATE_MAX_REQUESTS = 15
const rateBuckets = new Map<string, number[]>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const list = (rateBuckets.get(ip) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS)
  if (list.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(ip, list)
    return false
  }
  list.push(now)
  rateBuckets.set(ip, list)
  return true
}

const SUMMARY_SYSTEM_PROMPT = `You are a helpful career assistant for Indian government job aspirants on Sarkari Naukari.
Summarize the provided job listing clearly, accurately, and concisely in BOTH English ("en") and natural, clear Hindi ("hi").
Never invent facts not present in the provided data.
Return ONLY valid JSON matching this exact structure:
{
  "en": {
    "headline": "One clear sentence summarizing the recruitment and total vacancies in English",
    "highlights": ["4 to 5 concise bullet points in English covering organization, vacancies, key dates, age/qualification, and fee"],
    "whoShouldApply": "1-2 sentences in English on who is eligible",
    "actionTip": "1 short practical reminder in English"
  },
  "hi": {
    "headline": "भर्ती और कुल पदों का एक स्पष्ट हिंदी वाक्य में सारांश",
    "highlights": ["संगठन, पद, महत्वपूर्ण तिथियां, आयु/योग्यता और शुल्क पर 4 से 5 संक्षिप्त बिंदु हिंदी में"],
    "whoShouldApply": "पात्रता के बारे में 1-2 वाक्य हिंदी में",
    "actionTip": "अंतिम तिथि या आधिकारिक सूचना जांचने का एक छोटा सुझाव हिंदी में"
  }
}`

export type SummaryLocaleContent = {
  headline: string
  highlights: string[]
  whoShouldApply: string
  actionTip: string
}

export type JobSummaryPayload = {
  en: SummaryLocaleContent
  hi: SummaryLocaleContent
}

function normalizeLocaleBlock(
  block: unknown,
  fallbackHeadline: string,
  fallbackTip: string,
): SummaryLocaleContent {
  if (block && typeof block === 'object') {
    const b = block as Record<string, unknown>
    return {
      headline: typeof b.headline === 'string' && b.headline.trim() ? b.headline : fallbackHeadline,
      highlights: Array.isArray(b.highlights)
        ? b.highlights.map((x) => String(x)).filter(Boolean).slice(0, 6)
        : [],
      whoShouldApply: typeof b.whoShouldApply === 'string' ? b.whoShouldApply : '',
      actionTip: typeof b.actionTip === 'string' && b.actionTip.trim() ? b.actionTip : fallbackTip,
    }
  }
  return {
    headline: fallbackHeadline,
    highlights: [],
    whoShouldApply: '',
    actionTip: fallbackTip,
  }
}

function parseSummaryOutput(raw: string, jobTitle: string): JobSummaryPayload {
  const trimmed = raw.trim()
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first !== -1 && last > first) {
      try {
        parsed = JSON.parse(trimmed.slice(first, last + 1))
      } catch {
        parsed = null
      }
    }
  }

  if (parsed && (parsed.en || parsed.hi)) {
    const en = normalizeLocaleBlock(
      parsed.en,
      jobTitle,
      'Verify all dates and eligibility on the official notification before applying.',
    )
    const hi = normalizeLocaleBlock(
      parsed.hi ?? parsed.en,
      jobTitle,
      'आवेदन करने से पहले आधिकारिक अधिसूचना में सभी तिथियां और पात्रता अवश्य जांचें।',
    )
    return { en, hi }
  }

  const single = normalizeLocaleBlock(
    parsed,
    trimmed.slice(0, 300) || jobTitle,
    'Verify all dates and eligibility on the official notification before applying.',
  )
  return { en: single, hi: single }
}

export async function POST(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? 'unknown'
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many summary requests. Please wait a moment.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid job slug' }, { status: 400 })
  }

  const job = await getJobBySlug(parsed.data.slug)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const context = {
    title: job.title,
    organization: job.organizations?.name ?? null,
    advertisementNumber: job.advertisement_number,
    totalVacancies: job.total_vacancies,
    location: job.states?.name ?? job.location,
    qualification: job.qualifications?.name ?? null,
    minimumAge: job.minimum_age,
    maximumAge: job.maximum_age,
    ageRelaxation: job.age_relaxation,
    applicationStartDate: job.application_start_date,
    applicationEndDate: job.application_end_date,
    preliminaryExamDate: job.preliminary_exam_date,
    selectionProcess: job.selection_process,
    fees: job.job_fees?.map((f) => `${f.category_name}: ${f.amount ?? 'TBA'} ${f.currency}`),
    vacancies: job.job_vacancies?.map((v) => `${v.post_name}: ${v.total_posts ?? 'TBA'}`),
    shortDescription: job.short_description,
    additionalEligibility: job.additional_eligibility,
  }

  try {
    const raw = await runCloudflarePrompt(
      SUMMARY_SYSTEM_PROMPT,
      `Summarize this government job in both English and Hindi:\n${JSON.stringify(context)}`,
      1500,
    )
    const summary = parseSummaryOutput(raw, job.title)
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    if (err instanceof CloudflareConfigError) {
      return NextResponse.json({ error: 'AI summarizer is not configured.' }, { status: 503 })
    }
    if (err instanceof CloudflareRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    if (err instanceof CloudflareApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Could not summarize this job.' }, { status: 500 })
  }
}
