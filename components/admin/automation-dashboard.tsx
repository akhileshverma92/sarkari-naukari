'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  Loader2,
  Play,
  Plus,
  Power,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { JobDetailView, type JobDetailData } from '@/components/jobs/job-detail-view'
import type {
  AutomationSettings,
  JobSource,
  JobUpdateHistory,
  ScrapedCandidate,
  ScrapingLog,
} from '@/lib/automation/types'

export type AutomationSnapshot = {
  envStatus: {
    firebaseAdmin: boolean
    firecrawl: boolean
    cloudflare: boolean
    cronSecret: boolean
  }
  settings: AutomationSettings | null
  sources: JobSource[]
  candidates: ScrapedCandidate[]
  logs: ScrapingLog[]
  history: JobUpdateHistory[]
  metrics: {
    totalSources: number
    discoveredToday: number
    scrapedCount: number
    publishedAuto: number
    pendingCandidates: number
    duplicatesSkipped: number
    failedRequests: number
  }
}

function candidateToPreviewJob(c: ScrapedCandidate): JobDetailData {
  const d = (c.extractedData ?? {}) as Record<string, unknown>
  const fees = Array.isArray(d.fees) ? d.fees : []
  const vacancies = Array.isArray(d.vacancies) ? d.vacancies : []

  return {
    id: c.id,
    title: String(d.title ?? c.title ?? 'Untitled Job'),
    slug: String(d.slug ?? 'preview-job'),
    advertisement_number: (d.advertisementNumber as string | null) ?? null,
    short_description: (d.shortDescription as string | null) ?? c.snippet ?? null,
    description: (d.description as string | null) ?? null,
    total_vacancies: typeof d.totalVacancies === 'number' ? d.totalVacancies : null,
    location: (d.location as string | null) ?? null,
    status: c.status === 'published' ? 'published' : 'draft',
    is_featured: false,
    published_at: c.processedAt ?? c.discoveredAt,
    created_at: c.discoveredAt,
    updated_at: c.updatedAt,
    application_start_date: (d.applicationStartDate as string | null) ?? null,
    application_end_date: (d.applicationEndDate as string | null) ?? null,
    fee_payment_last_date: (d.feePaymentLastDate as string | null) ?? null,
    correction_last_date: (d.correctionLastDate as string | null) ?? null,
    preliminary_exam_date: (d.preliminaryExamDate as string | null) ?? null,
    mains_exam_date: (d.mainsExamDate as string | null) ?? null,
    admit_card_date: (d.admitCardDate as string | null) ?? null,
    result_date: (d.resultDate as string | null) ?? null,
    apply_url: (d.applyUrl as string | null) ?? null,
    notification_english_url: (d.notificationEnglishUrl as string | null) ?? null,
    notification_hindi_url: (d.notificationHindiUrl as string | null) ?? null,
    official_website_url: (d.officialWebsiteUrl as string | null) ?? null,
    source_url: c.url,
    source_type: c.sourceType,
    verification_status: c.verificationStatus === 'verified' ? 'verified' : 'pending',
    minimum_age: typeof d.minimumAge === 'number' ? d.minimumAge : null,
    maximum_age: typeof d.maximumAge === 'number' ? d.maximumAge : null,
    age_calculation_date: (d.ageCalculationDate as string | null) ?? null,
    minimum_qualification_id: null,
    experience: (d.experience as string | null) ?? null,
    additional_eligibility: (d.additionalEligibility as string | null) ?? null,
    age_relaxation: (d.ageRelaxation as string | null) ?? null,
    selection_process: Array.isArray(d.selectionProcess) ? d.selectionProcess : [],
    job_fees: fees.map((f: Record<string, unknown>, i: number) => ({
      id: `f-${i}`,
      category_name: String(f.category ?? 'Category'),
      amount: typeof f.amount === 'number' ? f.amount : null,
      currency: String(f.currency ?? 'INR'),
    })),
    job_vacancies: vacancies.map((v: Record<string, unknown>, i: number) => ({
      id: `v-${i}`,
      post_name: String(v.postName ?? 'Post'),
      total_posts: typeof v.totalPosts === 'number' ? v.totalPosts : null,
      category_breakdown: (v.categoryBreakdown as Record<string, number>) ?? {},
    })),
    organizations: d.organization
      ? { name: String(d.organization), slug: 'preview-org' }
      : { name: c.sourceName, slug: 'source-org' },
    states: d.state ? { name: String(d.state), slug: 'preview-state' } : null,
    job_categories: d.category ? { name: String(d.category), slug: 'preview-cat' } : null,
    qualifications: d.qualifications
      ? { name: String(d.qualifications), slug: 'preview-qual' }
      : null,
  }
}

export function AutomationDashboard({
  initialSnapshot,
}: {
  initialSnapshot: AutomationSnapshot
}) {
  const [snapshot, setSnapshot] = useState<AutomationSnapshot>(initialSnapshot)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'cards' | 'sources' | 'logs' | 'history'>('cards')
  const [cardFilter, setCardFilter] = useState<'all' | 'ready' | 'pending' | 'published'>('all')
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all')
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [previewCandidate, setPreviewCandidate] = useState<ScrapedCandidate | null>(null)

  async function runAction(
    body: Record<string, unknown>,
    label: string,
    keyOverride?: string,
  ): Promise<boolean> {
    const key = keyOverride ?? String(body.action)
    setBusyKey(key)
    try {
      const res = await fetch('/api/admin/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        snapshot?: AutomationSnapshot
      }
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? `${label} failed`)
        return false
      }
      if (data.snapshot) {
        setSnapshot(data.snapshot)
      }
      toast.success(`${label} completed.`)
      return true
    } catch {
      toast.error(`Network error while running ${label}.`)
      return false
    } finally {
      setBusyKey(null)
    }
  }

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newUrl.trim()
    if (!trimmed) return
    const ok = await runAction(
      { action: 'add_source_and_fetch', url: trimmed, name: newName.trim() || undefined },
      'Scrape website & get jobs',
      'add_source',
    )
    if (ok) {
      setNewUrl('')
      setNewName('')
      setActiveTab('cards')
    }
  }

  const { envStatus, settings, sources, candidates, logs, history, metrics } = snapshot
  const missingEnv =
    !envStatus.firebaseAdmin || !envStatus.firecrawl || !envStatus.cloudflare || !envStatus.cronSecret

  const visibleCandidates = useMemo(() => {
    let active = candidates.filter((c) => c.status !== 'rejected')
    if (selectedSourceId !== 'all') {
      active = active.filter((c) => c.sourceId === selectedSourceId)
    }
    if (cardFilter === 'ready') {
      return active.filter((c) => c.extractedData && c.status !== 'published')
    }
    if (cardFilter === 'pending') {
      return active.filter((c) => c.status === 'pending' || c.status === 'failed')
    }
    if (cardFilter === 'published') {
      return active.filter((c) => c.status === 'published')
    }
    return active
  }, [candidates, cardFilter, selectedSourceId])

  return (
    <div className="space-y-6">
      {missingEnv && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <strong className="block font-bold">Server Environment Configuration Required</strong>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ['FIREBASE_SERVICE_ACCOUNT', envStatus.firebaseAdmin],
                  ['FIRECRAWL_API_KEY', envStatus.firecrawl],
                  ['CLOUDFLARE_API_TOKEN / ACCOUNT_ID', envStatus.cloudflare],
                  ['CRON_SECRET', envStatus.cronSecret],
                ].map(([name, ok]) => (
                  <span
                    key={String(name)}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                      ok
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {ok ? '✓' : '✗'} {String(name)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Simple Add Link & Fetch Jobs Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="section-kicker">STEP 1 / ADD RESOURCE LINK</span>
            <h2 className="mt-1 text-base font-bold text-[#1b3150]">
              Paste a recruitment website or job link to scrape
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyKey !== null || !envStatus.firebaseAdmin}
              onClick={() =>
                runAction(
                  { action: 'toggle_automation', enabled: !(settings?.enabled ?? true) },
                  settings?.enabled ? 'Pause auto-cron' : 'Enable auto-cron',
                )
              }
            >
              <Power className="h-3.5 w-3.5" />
              {settings?.enabled ? 'Auto Cron: ON' : 'Auto Cron: OFF'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyKey !== null || !envStatus.firebaseAdmin}
              onClick={() => runAction({ action: 'run_discover' }, 'Discover all sources')}
            >
              <Play className="h-3.5 w-3.5" />
              {busyKey === 'run_discover' ? 'Discovering…' : 'Discover All'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyKey !== null || !envStatus.firebaseAdmin}
              onClick={() => runAction({ action: 'run_process' }, 'Process next batch')}
            >
              <Cpu className="h-3.5 w-3.5" />
              {busyKey === 'run_process' ? 'Scraping…' : 'Scrape Next 3'}
            </Button>
          </div>
        </div>

        <form onSubmit={handleAddSource} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="url"
              required
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://ssc.gov.in or https://sarkariresult.com.cm/..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2459a6] focus:bg-white focus:outline-none"
            />
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Source name (optional)"
            className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2459a6] focus:bg-white focus:outline-none sm:w-48"
          />
          <Button
            type="submit"
            disabled={busyKey !== null || !envStatus.firebaseAdmin || !newUrl.trim()}
            className="h-10 bg-[#2459a6] px-5 text-xs font-bold text-white hover:bg-[#194a88]"
          >
            {busyKey === 'add_source' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Fetching…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add & Fetch Jobs
              </>
            )}
          </Button>
        </form>
      </section>

      {/* Compact Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <small className="text-[11px] text-slate-500">Resource Links</small>
          <strong className="mt-1 block text-lg font-extrabold text-[#1b3150]">
            {metrics.totalSources}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <small className="text-[11px] text-slate-500">Found Jobs</small>
          <strong className="mt-1 block text-lg font-extrabold text-[#1b3150]">
            {candidates.filter((c) => c.status !== 'rejected').length}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <small className="text-[11px] text-slate-500">Ready / Pending</small>
          <strong className="mt-1 block text-lg font-extrabold text-[#2459a6]">
            {metrics.pendingCandidates}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <small className="text-[11px] text-slate-500">Published Live</small>
          <strong className="mt-1 block text-lg font-extrabold text-emerald-700">
            {metrics.publishedAuto}
          </strong>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['cards', `Found Job Cards (${candidates.filter((c) => c.status !== 'rejected').length})`],
              ['sources', `Resource Links (${sources.length})`],
              ['logs', `Logs (${logs.length})`],
              ['history', `Updates (${history.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                activeTab === key
                  ? 'bg-[#2459a6] text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'cards' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by website"
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="h-8 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
            >
              <option value="all">All Websites</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {(
              [
                ['all', 'All'],
                ['ready', 'Ready to Publish'],
                ['pending', 'Needs Scrape'],
                ['published', 'Published'],
              ] as const
            ).map(([filterKey, label]) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setCardFilter(filterKey)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  cardFilter === filterKey
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card Preview Grid */}
      {activeTab === 'cards' && (
        <div>
          {visibleCandidates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleCandidates.map((c) => {
                const d = (c.extractedData ?? {}) as Record<string, unknown>
                const isPublished = c.status === 'published'
                const hasData = Boolean(c.extractedData)
                const isBusy = busyKey === `card-${c.id}`
                const orgName = String(d.organization ?? c.sourceName)
                const vacancies = typeof d.totalVacancies === 'number' ? d.totalVacancies : null
                const endDate = typeof d.applicationEndDate === 'string' ? d.applicationEndDate : null
                const slug = typeof d.slug === 'string' ? d.slug : null

                return (
                  <article
                    key={c.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            c.sourceType === 'official'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {c.sourceType}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            isPublished
                              ? 'bg-emerald-100 text-emerald-800'
                              : hasData
                                ? 'bg-blue-50 text-[#2459a6]'
                                : c.status === 'failed'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPublished
                            ? 'Published'
                            : hasData
                              ? 'Ready to Publish'
                              : c.status === 'failed'
                                ? 'Failed'
                                : 'Needs Scrape'}
                        </span>
                      </div>

                      <h3 className="mt-3 line-clamp-2 text-sm font-bold text-[#142642]">
                        {String(d.title ?? c.title)}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">{orgName}</p>

                      {c.snippet && (
                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                          {String(d.shortDescription ?? c.snippet)}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <BriefcaseBusiness className="h-3.5 w-3.5 text-slate-400" />
                          {vacancies != null ? `${vacancies.toLocaleString('en-IN')} posts` : 'Vacancies TBA'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                          {endDate ?? 'Date TBA'}
                        </span>
                        {c.extractionConfidence != null && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#2459a6]">
                            <Sparkles className="h-3.5 w-3.5" /> {c.extractionConfidence}% AI
                          </span>
                        )}
                      </div>

                      {c.lastError && (
                        <p className="mt-2 rounded bg-red-50 p-2 text-[11px] text-red-700">
                          {c.lastError}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open source URL"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Source
                        </a>
                        {hasData && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewCandidate(c)}
                            className="h-8 px-2.5 text-[11px]"
                          >
                            <Eye className="h-3.5 w-3.5" /> Preview
                          </Button>
                        )}
                        {!isPublished && (
                          <button
                            type="button"
                            title="Dismiss card"
                            disabled={busyKey !== null}
                            onClick={() =>
                              runAction(
                                { action: 'dismiss_candidate', candidateId: c.id },
                                'Dismissed job',
                                `card-${c.id}`,
                              )
                            }
                            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {isPublished ? (
                        <Link
                          href={slug ? `/jobs/${slug}` : '/jobs'}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> View Live
                        </Link>
                      ) : hasData ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyKey !== null}
                          onClick={() =>
                            runAction(
                              { action: 'publish_candidate', candidateId: c.id },
                              'Publish job',
                              `card-${c.id}`,
                            )
                          }
                          className="h-8 bg-[#208b3a] px-3 text-[11px] font-bold text-white hover:bg-[#19722f]"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          One-Click Publish
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyKey !== null}
                          onClick={() =>
                            runAction(
                              { action: 'scrape_candidate', candidateId: c.id },
                              'Fetch job details',
                              `card-${c.id}`,
                            )
                          }
                          className="h-8 bg-[#2459a6] px-3 text-[11px] font-bold text-white hover:bg-[#194a88]"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Fetch Details
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Globe className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">No job cards in this view</h3>
              <p className="mt-1 text-xs text-slate-500">
                Paste a recruitment website or job link above and click &quot;Add & Fetch Jobs&quot;.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Resource Links Tab */}
      {activeTab === 'sources' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">Resource Link</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Last Checked</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((src) => (
                <tr key={src.id}>
                  <td className="px-4 py-3">
                    <strong className="block text-slate-900">{src.name}</strong>
                    <span className="text-[11px] text-slate-500">{src.baseUrl}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        src.sourceType === 'official'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {src.sourceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {src.lastDiscoveredAt
                      ? new Date(src.lastDiscoveredAt).toLocaleString('en-IN')
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyKey !== null}
                        onClick={() =>
                          runAction(
                            { action: 'toggle_source', sourceId: src.id, enabled: !src.enabled },
                            `${src.enabled ? 'Disable' : 'Enable'} ${src.name}`,
                          )
                        }
                      >
                        {src.enabled ? 'Enabled' : 'Disabled'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyKey !== null}
                        onClick={() =>
                          runAction(
                            { action: 'delete_source', sourceId: src.id },
                            `Remove ${src.name}`,
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scraping Logs Tab */}
      {activeTab === 'logs' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-bold uppercase text-slate-800">{log.jobType}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {log.summary}
                    {log.error && <p className="mt-1 text-[11px] text-red-600">{log.error}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(log.startedAt).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Update History Tab */}
      {activeTab === 'history' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Detected Changes</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.title}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.changes
                      .map((ch) => `${ch.field}: ${String(ch.previousValue ?? '—')} → ${String(ch.newValue)}`)
                      .join(', ')}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(item.createdAt).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 md:p-8"
        >
          <div className="mx-auto max-w-[1200px] overflow-hidden rounded-2xl bg-[#f4f6fa] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <strong className="text-xs font-bold text-[#142642]">
                Card Preview — {previewCandidate.title}
              </strong>
              <div className="flex items-center gap-2">
                {previewCandidate.status !== 'published' && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyKey !== null}
                    onClick={async () => {
                      const ok = await runAction(
                        { action: 'publish_candidate', candidateId: previewCandidate.id },
                        'Publish job',
                        `card-${previewCandidate.id}`,
                      )
                      if (ok) setPreviewCandidate(null)
                    }}
                    className="bg-[#208b3a] text-white hover:bg-[#19722f]"
                  >
                    <Send className="h-3.5 w-3.5" /> One-Click Publish
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewCandidate(null)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <JobDetailView
              job={candidateToPreviewJob(previewCandidate)}
              isPreview
              onExitPreview={() => setPreviewCandidate(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
