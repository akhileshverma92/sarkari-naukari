import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin'
import { getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import {
  addSourceAndFetch,
  publishCandidateById,
  runDailyAutomationPipeline,
  runDiscoveryJob,
  runProcessCandidatesJob,
  runUpdateJobStatusJob,
  runVerifyJobsJob,
  scrapeSingleCandidate,
} from '@/lib/automation/pipeline'
import {
  getAutomationSettings,
  listScrapingLogs,
  updateAutomationSettings,
} from '@/lib/automation/settings'
import { listJobSources, toggleJobSource } from '@/lib/automation/sources'
import type { JobUpdateHistory, ScrapedCandidate } from '@/lib/automation/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('run_full_pipeline') }),
  z.object({ action: z.literal('run_discover') }),
  z.object({ action: z.literal('run_process') }),
  z.object({ action: z.literal('retry_failed') }),
  z.object({ action: z.literal('run_verify') }),
  z.object({ action: z.literal('run_status_update') }),
  z.object({ action: z.literal('toggle_automation'), enabled: z.boolean() }),
  z.object({
    action: z.literal('update_settings'),
    confidenceThreshold: z.number().int().min(0).max(100),
    autoPublishVerified: z.boolean(),
  }),
  z.object({
    action: z.literal('toggle_source'),
    sourceId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal('add_source_and_fetch'),
    url: z.string().url(),
    name: z.string().optional(),
  }),
  z.object({
    action: z.literal('delete_source'),
    sourceId: z.string().min(1),
  }),
  z.object({
    action: z.literal('scrape_candidate'),
    candidateId: z.string().min(1),
  }),
  z.object({
    action: z.literal('publish_candidate'),
    candidateId: z.string().min(1),
  }),
  z.object({
    action: z.literal('dismiss_candidate'),
    candidateId: z.string().min(1),
  }),
])

function toPlainDoc<T extends Record<string, unknown>>(
  id: string,
  data: Record<string, unknown>,
): T & { id: string } {
  const out: Record<string, unknown> = { id }
  for (const [k, v] of Object.entries(data)) {
    if (k === 'serverCreatedAt' || k === 'serverUpdatedAt') continue
    if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate?: unknown }).toDate === 'function') {
      out[k] = (v as { toDate: () => Date }).toDate().toISOString()
    } else {
      out[k] = v
    }
  }
  return out as T & { id: string }
}

export async function getAutomationDashboardSnapshot() {
  const adminConfigured = isFirebaseAdminConfigured()
  const envStatus = {
    firebaseAdmin: adminConfigured,
    firecrawl: Boolean(
      process.env.FIRECRAWL_API_KEY?.trim() || process.env.NEXT_FIRECRAWL_API_KEY?.trim(),
    ),
    cloudflare: Boolean(
      (process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
        process.env.NEXT_CLOUDFLARE_ACCOUNT_ID?.trim()) &&
        (process.env.CLOUDFLARE_API_TOKEN?.trim() ||
          process.env.NEXT_CLOUDFLARE_API_TOKEN?.trim()),
    ),
    cronSecret: Boolean(process.env.CRON_SECRET?.trim() || process.env.NEXT_CRON_SECRET?.trim()),
  }

  if (!adminConfigured) {
    return {
      envStatus,
      settings: null,
      sources: [],
      candidates: [],
      logs: [],
      history: [],
      metrics: {
        totalSources: 0,
        discoveredToday: 0,
        scrapedCount: 0,
        publishedAuto: 0,
        pendingCandidates: 0,
        duplicatesSkipped: 0,
        failedRequests: 0,
      },
    }
  }

  const db = getAdminDb()
  const [settings, sources, logs, candidatesSnap, historySnap] = await Promise.all([
    getAutomationSettings(),
    listJobSources(),
    listScrapingLogs(25),
    db.collection('scraped_candidates').orderBy('discoveredAt', 'desc').limit(100).get(),
    db.collection('job_update_history').orderBy('createdAt', 'desc').limit(30).get(),
  ])

  const candidates = candidatesSnap.docs.map((doc) =>
    toPlainDoc<Omit<ScrapedCandidate, 'id'>>(doc.id, doc.data()),
  )

  const history = historySnap.docs.map((doc) =>
    toPlainDoc<Omit<JobUpdateHistory, 'id'>>(doc.id, doc.data()),
  )

  const plainSources = sources.map((src) =>
    toPlainDoc<Omit<typeof src, 'id'>>(src.id, src as unknown as Record<string, unknown>),
  )
  const plainLogs = logs.map((log) =>
    toPlainDoc<Omit<typeof log, 'id'>>(log.id, log as unknown as Record<string, unknown>),
  )
  const plainSettings = settings
    ? toPlainDoc<typeof settings>('default', settings as unknown as Record<string, unknown>)
    : null

  const today = new Date().toISOString().slice(0, 10)
  const metrics = {
    totalSources: sources.filter((s) => s.enabled).length,
    discoveredToday: candidates.filter((c) => c.discoveredAt?.startsWith(today)).length,
    scrapedCount: candidates.filter((c) => c.processedAt !== null).length,
    publishedAuto: candidates.filter((c) => c.status === 'published').length,
    pendingCandidates: candidates.filter(
      (c) => c.status === 'pending' || c.status === 'candidate',
    ).length,
    duplicatesSkipped: candidates.filter((c) => c.status === 'duplicate').length,
    failedRequests: candidates.filter((c) => c.status === 'failed').length,
  }

  return {
    envStatus,
    settings: plainSettings,
    sources: plainSources,
    candidates,
    logs: plainLogs,
    history,
    metrics,
  }
}

export async function GET() {
  const user = await getCurrentUser()
  const isAdmin = await isAdminUser(user)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: user ? 403 : 401 })
  }

  const snapshot = await getAutomationDashboardSnapshot()
  return NextResponse.json(snapshot)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const isAdmin = await isAdminUser(user)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: user ? 403 : 401 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'FIREBASE_SERVICE_ACCOUNT is not configured on the server.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid automation action' }, { status: 400 })
  }

  const payload = parsed.data
  try {
    let result: unknown = { ok: true }
    if (payload.action === 'run_full_pipeline') {
      result = await runDailyAutomationPipeline(true)
    } else if (payload.action === 'run_discover') {
      result = await runDiscoveryJob(true)
    } else if (payload.action === 'run_process') {
      result = await runProcessCandidatesJob(true, false)
    } else if (payload.action === 'retry_failed') {
      result = await runProcessCandidatesJob(true, true)
    } else if (payload.action === 'run_verify') {
      result = await runVerifyJobsJob(true)
    } else if (payload.action === 'run_status_update') {
      result = await runUpdateJobStatusJob()
    } else if (payload.action === 'toggle_automation') {
      result = await updateAutomationSettings({ enabled: payload.enabled })
    } else if (payload.action === 'update_settings') {
      result = await updateAutomationSettings({
        confidenceThreshold: payload.confidenceThreshold,
        autoPublishVerified: payload.autoPublishVerified,
      })
    } else if (payload.action === 'toggle_source') {
      await toggleJobSource(payload.sourceId, payload.enabled)
    } else if (payload.action === 'add_source_and_fetch') {
      result = await addSourceAndFetch({ url: payload.url, name: payload.name })
    } else if (payload.action === 'delete_source') {
      await getAdminDb().collection('job_sources').doc(payload.sourceId).delete()
    } else if (payload.action === 'scrape_candidate') {
      result = await scrapeSingleCandidate(payload.candidateId)
    } else if (payload.action === 'publish_candidate') {
      result = await publishCandidateById(payload.candidateId)
    } else if (payload.action === 'dismiss_candidate') {
      await getAdminDb()
        .collection('scraped_candidates')
        .doc(payload.candidateId)
        .update({ status: 'rejected', updatedAt: new Date().toISOString() })
    }

    revalidatePath('/')
    revalidatePath('/jobs')
    revalidatePath('/admin')
    revalidatePath('/admin/automation')

    const snapshot = await getAutomationDashboardSnapshot()
    return NextResponse.json({ ok: true, result, snapshot })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Automation action failed' },
      { status: 500 },
    )
  }
}
