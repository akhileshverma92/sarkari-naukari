import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import {
  CloudflareApiError,
  CloudflareConfigError,
  CloudflareRateLimitError,
  runCloudflareJobExtraction,
} from '@/lib/ai/cloudflare'
import { normalizeAiResponseText, tryParseDirectJson } from '@/lib/ai/normalize-job'

const MAX_CONTENT_LENGTH = 50000
const MIN_CONTENT_LENGTH = 20

const requestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(MIN_CONTENT_LENGTH, `Paste at least ${MIN_CONTENT_LENGTH} characters of recruitment text or JSON.`)
    .max(MAX_CONTENT_LENGTH, `Input exceeds the ${MAX_CONTENT_LENGTH.toLocaleString()} character limit.`),
})

// Simple in-memory sliding-window rate limiter (10 requests / 60s per admin key)
const RATE_WINDOW_MS = 60_000
const RATE_MAX_REQUESTS = 10
const rateBuckets = new Map<string, number[]>()

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const timestamps = (rateBuckets.get(key) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS)
  if (timestamps.length >= RATE_MAX_REQUESTS) {
    const oldest = timestamps[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000))
    rateBuckets.set(key, timestamps)
    return { allowed: false, retryAfterSec }
  }
  timestamps.push(now)
  rateBuckets.set(key, timestamps)
  return { allowed: true, retryAfterSec: 0 }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const isAdmin = await isAdminUser(user)

  if (!user || !isAdmin) {
    return NextResponse.json(
      {
        error: 'Unauthorized. Sign in with an administrator account to use the AI importer.',
        errorCode: 'UNAUTHORIZED',
      },
      { status: user ? 403 : 401 },
    )
  }

  const rate = checkRateLimit(user.uid)
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Please wait ${rate.retryAfterSec}s before extracting again.`,
        errorCode: 'RATE_LIMITED',
      },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.', errorCode: 'INVALID_REQUEST' },
      { status: 400 },
    )
  }

  const parsedInput = requestSchema.safeParse(body)
  if (!parsedInput.success) {
    return NextResponse.json(
      {
        error: parsedInput.error.issues[0]?.message ?? 'Invalid input content.',
        errorCode: 'INVALID_INPUT',
      },
      { status: 400 },
    )
  }

  const { content } = parsedInput.data

  // Fast path: direct JSON input
  try {
    const direct = tryParseDirectJson(content)
    if (direct) {
      return NextResponse.json({ result: direct })
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_JSON') {
      return NextResponse.json(
        {
          error: 'The pasted JSON is malformed. Fix syntax errors or paste plain recruitment text.',
          errorCode: 'INVALID_JSON',
        },
        { status: 400 },
      )
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: `JSON validation failed: ${err.issues[0]?.message ?? 'Invalid schema'}`,
          issues: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          errorCode: 'VALIDATION_FAILED',
        },
        { status: 422 },
      )
    }
  }

  // AI path: Cloudflare Workers AI
  try {
    const rawOutput = await runCloudflareJobExtraction(content)
    const normalized = normalizeAiResponseText(rawOutput)
    return NextResponse.json({ result: normalized })
  } catch (err) {
    if (err instanceof CloudflareConfigError) {
      return NextResponse.json(
        {
          error: err.message,
          errorCode: 'MISSING_CREDENTIALS',
        },
        { status: 503 },
      )
    }
    if (err instanceof CloudflareRateLimitError) {
      return NextResponse.json(
        {
          error: err.message,
          errorCode: 'RATE_LIMITED',
        },
        { status: 429 },
      )
    }
    if (err instanceof CloudflareApiError) {
      return NextResponse.json(
        {
          error: err.message,
          errorCode: 'API_ERROR',
        },
        { status: 502 },
      )
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'AI output failed structured validation.',
          issues: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          errorCode: 'VALIDATION_FAILED',
        },
        { status: 422 },
      )
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to extract recruitment data.',
        errorCode: 'EXTRACTION_FAILED',
      },
      { status: 500 },
    )
  }
}
