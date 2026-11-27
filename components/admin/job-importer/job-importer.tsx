'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Eye,
  FileEdit,
  Save,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { JobDetailView, type JobDetailData } from '@/components/jobs/job-detail-view'
import type { NormalizedExtractionResult } from '@/lib/ai/extraction-schema'
import type { JobFee, JobVacancy, TaxonomyItem } from '@/lib/queries/jobs'
import { ExtractionProgress } from './extraction-progress'
import { ExtractionSummary } from './extraction-summary'
import { FieldReview } from './field-review'
import { SourceInput } from './source-input'
import {
  EMPTY_JOB_FORM,
  FORM_TO_EXTRACTION_KEY,
  matchTaxonomyId,
  type ExtractionErrorState,
  type JobFormValues,
  type LocalJobRecord,
} from './types'

const ACTIVE_STORAGE_KEY = 'govtjobs_hub_active_importer_v1'
const SAVED_JOBS_STORAGE_KEY = 'govtjobs_hub_local_jobs_v1'

type Taxonomies = {
  states: TaxonomyItem[]
  categories: TaxonomyItem[]
  organizations: TaxonomyItem[]
  qualifications: TaxonomyItem[]
}

export function JobImporter({
  taxonomy,
  initialError,
}: {
  taxonomy: Taxonomies
  initialError?: string
}) {
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai')
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [sourceContent, setSourceContent] = useState('')
  const [form, setForm] = useState<JobFormValues>(EMPTY_JOB_FORM)
  const [extraction, setExtraction] = useState<NormalizedExtractionResult | null>(null)
  const [aiPopulatedKeys, setAiPopulatedKeys] = useState<string[]>([])
  const [editedKeys, setEditedKeys] = useState<string[]>([])
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ExtractionErrorState | null>(
    initialError ? { message: initialError } : null,
  )
  const [localJobs, setLocalJobs] = useState<LocalJobRecord[]>([])
  const [activeRecordId, setActiveRecordId] = useState<string>('draft-active')
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const router = useRouter()
  const formSectionRef = useRef<HTMLFormElement>(null)

  // Restore active draft and saved local jobs from localStorage on mount
  useEffect(() => {
    try {
      const rawActive = localStorage.getItem(ACTIVE_STORAGE_KEY)
      if (rawActive) {
        const parsed = JSON.parse(rawActive) as Partial<LocalJobRecord> & {
          creationMode?: 'ai' | 'manual'
        }
        if (parsed.form) setForm({ ...EMPTY_JOB_FORM, ...parsed.form })
        if (parsed.sourceContent !== undefined) setSourceContent(parsed.sourceContent)
        if (parsed.extraction !== undefined) setExtraction(parsed.extraction)
        if (Array.isArray(parsed.aiPopulatedKeys)) setAiPopulatedKeys(parsed.aiPopulatedKeys)
        if (Array.isArray(parsed.editedKeys)) setEditedKeys(parsed.editedKeys)
        if (parsed.id) setActiveRecordId(parsed.id)
        if (parsed.creationMode) setCreationMode(parsed.creationMode)
      }
      const rawList = localStorage.getItem(SAVED_JOBS_STORAGE_KEY)
      if (rawList) {
        const list = JSON.parse(rawList)
        if (Array.isArray(list)) setLocalJobs(list)
      }
    } catch {
      // Ignore corrupt localStorage
    } finally {
      setHydrated(true)
    }
  }, [])

  // Persist active state automatically on change
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(
        ACTIVE_STORAGE_KEY,
        JSON.stringify({
          id: activeRecordId,
          creationMode,
          sourceContent,
          form,
          extraction,
          aiPopulatedKeys,
          editedKeys,
          savedAt: new Date().toISOString(),
        }),
      )
    } catch {
      // Ignore quota errors
    }
  }, [hydrated, activeRecordId, creationMode, sourceContent, form, extraction, aiPopulatedKeys, editedKeys])

  function updateField<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setEditedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
  }

  function applyExtractionToForm(result: NormalizedExtractionResult) {
    const d = result.data
    const nextValues: Partial<JobFormValues> = {
      title: d.title ?? '',
      slug: d.slug ?? '',
      organization_name: d.organization ?? '',
      advertisement_number: d.advertisementNumber ?? '',
      category_id: matchTaxonomyId(d.category, taxonomy.categories),
      state_id: matchTaxonomyId(d.state, taxonomy.states),
      location: d.location ?? '',
      total_vacancies: d.totalVacancies != null ? String(d.totalVacancies) : '',
      short_description: d.shortDescription ?? '',
      description: d.description ?? '',
      application_start_date: d.applicationStartDate ?? '',
      application_end_date: d.applicationEndDate ?? '',
      fee_payment_last_date: d.feePaymentLastDate ?? '',
      correction_last_date: d.correctionLastDate ?? '',
      preliminary_exam_date: d.preliminaryExamDate ?? '',
      mains_exam_date: d.mainsExamDate ?? '',
      admit_card_date: d.admitCardDate ?? '',
      result_date: d.resultDate ?? '',
      minimum_age: d.minimumAge != null ? String(d.minimumAge) : '',
      maximum_age: d.maximumAge != null ? String(d.maximumAge) : '',
      age_calculation_date: d.ageCalculationDate ?? '',
      minimum_qualification_id: matchTaxonomyId(d.qualifications, taxonomy.qualifications),
      experience: d.experience ?? '',
      age_relaxation: d.ageRelaxation ?? '',
      additional_eligibility: d.additionalEligibility ?? '',
      selection_process: d.selectionProcess.length ? JSON.stringify(d.selectionProcess) : '',
      fees_json: d.fees.length
        ? JSON.stringify(
            d.fees.map((f) => ({
              category_name: f.category,
              amount: f.amount,
              currency: f.currency,
            })),
          )
        : '',
      vacancies_json: d.vacancies.length
        ? JSON.stringify(
            d.vacancies.map((v) => ({
              post_name: v.postName,
              total_posts: v.totalPosts,
              category_breakdown: v.categoryBreakdown,
            })),
          )
        : '',
      apply_url: d.applyUrl ?? '',
      official_website_url: d.officialWebsiteUrl ?? '',
      notification_english_url: d.notificationEnglishUrl ?? '',
      notification_hindi_url: d.notificationHindiUrl ?? '',
      source_url: d.sourceUrl ?? '',
      verification_status: 'pending',
    }

    let overwriteEdited = true
    if (editedKeys.length > 0) {
      overwriteEdited = window.confirm(
        'You have manually edited some fields. Click OK to overwrite them with AI-extracted values, or Cancel to keep your manual edits.',
      )
    }

    const populated: string[] = []
    setForm((prev) => {
      const merged = { ...prev }
      for (const [k, v] of Object.entries(nextValues)) {
        const key = k as keyof JobFormValues
        if (!overwriteEdited && editedKeys.includes(key)) continue
        ;(merged as Record<string, unknown>)[key] = v
        if (typeof v === 'string' && v.trim() !== '') {
          populated.push(key)
        }
      }
      return merged
    })
    setAiPopulatedKeys(populated)
    if (overwriteEdited) setEditedKeys([])
  }

  async function handleExtract() {
    if (!sourceContent.trim()) {
      setError({ message: 'Paste recruitment text or JSON before extracting.' })
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/extract-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sourceContent }),
      })
      const payload = (await res.json()) as {
        result?: NormalizedExtractionResult
        error?: string
        errorCode?: string
        issues?: string[]
      }

      if (!res.ok || !payload.result) {
        setError({
          message: payload.error ?? 'Extraction failed. Please check your input and try again.',
          code: payload.errorCode,
          issues: payload.issues,
        })
        toast.error(payload.error ?? 'Extraction failed')
        setLoading(false)
        return
      }

      setExtraction(payload.result)
      applyExtractionToForm(payload.result)
      toast.success(
        payload.result.mode === 'json'
          ? `Parsed ${payload.result.extractedCount} fields from JSON.`
          : `Extracted ${payload.result.extractedCount} fields with AI.`,
      )
    } catch {
      setError({ message: 'Network error while contacting the extraction endpoint.' })
      toast.error('Network error during extraction')
    } finally {
      setLoading(false)
    }
  }

  async function saveToLocalJobs(status: 'draft' | 'published') {
    if (saving) return
    if (!form.title.trim() || form.title.trim().length < 5) {
      toast.error('Enter a job title (at least 5 characters) before saving.')
      return
    }
    if (!form.slug.trim() || !/^[a-z0-9-]+$/.test(form.slug.trim())) {
      toast.error('Enter a valid URL slug (lowercase letters, numbers, hyphens).')
      return
    }

    setSaving(true)
    const nextVerification = status === 'published' ? 'verified' : form.verification_status

    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRecordId.startsWith('job-') || activeRecordId === 'draft-active' ? undefined : activeRecordId,
          ...form,
          verification_status: nextVerification,
          status,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        id?: string
        slug?: string
        error?: string
      }

      if (!res.ok || !data.ok || !data.id) {
        toast.error(data.error ?? 'Could not save job to Firebase.')
        setSaving(false)
        return
      }

      const savedId = data.id
      const record: LocalJobRecord = {
        id: savedId,
        status,
        savedAt: new Date().toISOString(),
        sourceContent,
        form: { ...form, status, verification_status: nextVerification },
        extraction,
        aiPopulatedKeys,
        editedKeys,
      }

      const updated = [record, ...localJobs.filter((item) => item.id !== savedId && item.id !== activeRecordId)].slice(0, 20)
      setLocalJobs(updated)
      setActiveRecordId(savedId)
      setForm((prev) => ({ ...prev, status, verification_status: nextVerification }))
      try {
        localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore quota errors
      }

      if (status === 'published') {
        toast.success('Job published to Firebase and is now live!')
        router.push(`/jobs/${data.slug ?? form.slug}`)
        router.refresh()
      } else {
        toast.success('Draft saved to Firebase and localStorage.')
      }
    } catch {
      toast.error('Network error while saving job to Firebase.')
    } finally {
      setSaving(false)
    }
  }

  function loadLocalRecord(record: LocalJobRecord) {
    setActiveRecordId(record.id)
    setForm({ ...EMPTY_JOB_FORM, ...record.form })
    setSourceContent(record.sourceContent ?? '')
    setExtraction(record.extraction ?? null)
    setAiPopulatedKeys(record.aiPopulatedKeys ?? [])
    setEditedKeys(record.editedKeys ?? [])
    setViewMode('edit')
    toast.info(`Loaded "${record.form.title || 'Untitled draft'}"`)
  }

  function deleteLocalRecord(id: string) {
    const updated = localJobs.filter((item) => item.id !== id)
    setLocalJobs(updated)
    localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(updated))
    if (activeRecordId === id) {
      setActiveRecordId('draft-active')
    }
    toast.info('Removed local draft.')
  }

  function handleFieldFocus(formKey: keyof JobFormValues) {
    const extractionKey = FORM_TO_EXTRACTION_KEY[formKey]
    if (extractionKey) setSelectedFieldKey(extractionKey)
  }

  function renderFieldBadge(formKey: keyof JobFormValues) {
    const isAi = aiPopulatedKeys.includes(formKey) && !editedKeys.includes(formKey)
    const extractionKey = FORM_TO_EXTRACTION_KEY[formKey]
    const meta = extractionKey ? extraction?.fields[extractionKey] : undefined
    const hasConflict = Boolean(
      extractionKey && extraction?.conflicts.some((c) => c.field === extractionKey),
    )

    if (!isAi && !hasConflict) return null
    return (
      <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
        {isAi && (
          <span className="rounded bg-[#eaf1fb] px-1.5 py-0.5 text-[9px] font-bold text-[#2459a6]">
            AI
          </span>
        )}
        {meta?.confidence === 'low' && isAi && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
            Review
          </span>
        )}
        {hasConflict && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
            Conflict
          </span>
        )}
      </span>
    )
  }

  const previewJob: JobDetailData = useMemo(() => {
    let selectionProcess: unknown[] = []
    try {
      if (form.selection_process.trim()) {
        const parsed = JSON.parse(form.selection_process)
        if (Array.isArray(parsed)) selectionProcess = parsed
      }
    } catch {
      selectionProcess = []
    }

    let jobFees: JobFee[] = []
    try {
      if (form.fees_json.trim()) {
        const parsed = JSON.parse(form.fees_json) as Array<{
          category_name: string
          amount: number | null
          currency?: string
        }>
        if (Array.isArray(parsed)) {
          jobFees = parsed.map((f, i) => ({
            id: `preview-fee-${i}`,
            category_name: f.category_name,
            amount: f.amount ?? null,
            currency: f.currency ?? 'INR',
          }))
        }
      }
    } catch {
      jobFees = []
    }

    let jobVacancies: JobVacancy[] = []
    try {
      if (form.vacancies_json.trim()) {
        const parsed = JSON.parse(form.vacancies_json) as Array<{
          post_name: string
          total_posts: number | null
          category_breakdown?: Record<string, number>
        }>
        if (Array.isArray(parsed)) {
          jobVacancies = parsed.map((v, i) => ({
            id: `preview-vac-${i}`,
            post_name: v.post_name,
            total_posts: v.total_posts ?? null,
            category_breakdown: v.category_breakdown ?? {},
          }))
        }
      }
    } catch {
      jobVacancies = []
    }

    const stateObj = taxonomy.states.find((s) => s.id === form.state_id)
    const catObj = taxonomy.categories.find((c) => c.id === form.category_id)
    const qualObj = taxonomy.qualifications.find((q) => q.id === form.minimum_qualification_id)

    return {
      id: activeRecordId,
      title: form.title || 'Untitled Recruitment Listing',
      slug: form.slug || 'preview-job',
      advertisement_number: form.advertisement_number || null,
      short_description: form.short_description || null,
      description: form.description || null,
      total_vacancies: form.total_vacancies ? Number(form.total_vacancies) : null,
      location: form.location || null,
      status: form.status,
      is_featured: form.is_featured,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      application_start_date: form.application_start_date || null,
      application_end_date: form.application_end_date || null,
      fee_payment_last_date: form.fee_payment_last_date || null,
      correction_last_date: form.correction_last_date || null,
      preliminary_exam_date: form.preliminary_exam_date || null,
      mains_exam_date: form.mains_exam_date || null,
      admit_card_date: form.admit_card_date || null,
      result_date: form.result_date || null,
      apply_url: form.apply_url || null,
      notification_english_url: form.notification_english_url || null,
      notification_hindi_url: form.notification_hindi_url || null,
      official_website_url: form.official_website_url || null,
      source_url: form.source_url || null,
      source_type: form.source_type || null,
      verification_status: form.verification_status,
      minimum_age: form.minimum_age ? Number(form.minimum_age) : null,
      maximum_age: form.maximum_age ? Number(form.maximum_age) : null,
      age_calculation_date: form.age_calculation_date || null,
      minimum_qualification_id: form.minimum_qualification_id || null,
      experience: form.experience || null,
      additional_eligibility: form.additional_eligibility || null,
      age_relaxation: form.age_relaxation || null,
      selection_process: selectionProcess,
      job_fees: jobFees,
      job_vacancies: jobVacancies,
      organizations: form.organization_name
        ? { name: form.organization_name, slug: 'preview-org' }
        : null,
      states: stateObj ? { name: stateObj.name, slug: stateObj.slug } : null,
      job_categories: catObj ? { name: catObj.name, slug: catObj.slug } : null,
      qualifications: qualObj ? { name: qualObj.name, slug: qualObj.slug } : null,
    }
  }, [form, taxonomy, activeRecordId])

  if (viewMode === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce7f5] bg-[#f0f5fb] px-4 py-3">
          <div className="text-xs text-[#1b3150]">
            <strong>Preview Mode</strong> — Rendering the exact public recruitment layout.
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setViewMode('edit')}>
              Back to editor
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => saveToLocalJobs('draft')}>
              <Save className="h-3.5 w-3.5" /> Save as Draft
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowPublishConfirm(true)}
              className="bg-[#244c7b] text-white hover:bg-[#19385d]"
            >
              <Send className="h-3.5 w-3.5" /> Publish
            </Button>
          </div>
        </div>
        <JobDetailView job={previewJob} isPreview onExitPreview={() => setViewMode('edit')} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Creation Option Switcher */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setCreationMode('ai')}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
            creationMode === 'ai'
              ? 'border-[#2459a6] bg-[#f2f7fe] ring-2 ring-[#2459a6]/15'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2459a6] text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-sm text-[#1b3150]">Import with AI</strong>
              <span className="rounded-full bg-[#2459a6] px-2 py-0.5 text-[10px] font-bold text-white">
                Recommended
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Paste raw recruitment text or JSON and auto-populate fields with source evidence.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCreationMode('manual')}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
            creationMode === 'manual'
              ? 'border-[#2459a6] bg-[#f2f7fe] ring-2 ring-[#2459a6]/15'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <FileEdit className="h-4 w-4" />
          </span>
          <div>
            <strong className="text-sm text-[#1b3150]">Manual Entry</strong>
            <p className="mt-1 text-xs text-slate-600">
              Fill out the recruitment form manually field by field.
            </p>
          </div>
        </button>
      </div>

      {/* Saved LocalStorage Drafts Bar */}
      {localJobs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Saved Local Drafts & Listings ({localJobs.length})
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {localJobs.map((rec) => (
              <div
                key={rec.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                  activeRecordId === rec.id
                    ? 'border-[#2459a6] bg-[#eef5ff]'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadLocalRecord(rec)}
                  className="font-semibold text-[#1b3150] hover:underline"
                >
                  {rec.form.title || 'Untitled draft'}
                </button>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    rec.status === 'published'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {rec.status}
                </span>
                <button
                  type="button"
                  aria-label="Delete draft"
                  onClick={() => deleteLocalRecord(rec.id)}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Importer Section */}
      {creationMode === 'ai' && (
        <div className="space-y-4">
          <SourceInput
            value={sourceContent}
            onChange={setSourceContent}
            onExtract={handleExtract}
            loading={loading}
            error={error}
          />

          {loading && <ExtractionProgress />}

          {!loading && extraction && (
            <ExtractionSummary
              result={extraction}
              onEdit={() => formSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              onReExtract={handleExtract}
              onPreview={() => setViewMode('preview')}
              onSaveDraft={() => saveToLocalJobs('draft')}
              onPublishRequest={() => setShowPublishConfirm(true)}
              loading={loading}
            />
          )}
        </div>
      )}

      {/* Main Editor + Field Evidence Inspector */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-start">
        <form
          ref={formSectionRef}
          onSubmit={(e) => {
            e.preventDefault()
            saveToLocalJobs('draft')
          }}
          className="job-editor"
        >
          <section className="editor-section">
            <span className="section-kicker">01 / BASIC INFORMATION</span>
            <h2>Job details</h2>
            <div className="editor-grid">
              <label className="wide-field">
                <span>
                  Job title *{renderFieldBadge('title')}
                </span>
                <input
                  name="title"
                  required
                  minLength={5}
                  maxLength={180}
                  value={form.title}
                  onFocus={() => handleFieldFocus('title')}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g. Junior Engineer Recruitment"
                />
              </label>
              <label>
                <span>
                  URL slug *{renderFieldBadge('slug')}
                </span>
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9-]+"
                  value={form.slug}
                  onFocus={() => handleFieldFocus('slug')}
                  onChange={(e) => updateField('slug', e.target.value)}
                  placeholder="junior-engineer-recruitment-2026"
                />
                <small>Lowercase letters, numbers and hyphens.</small>
              </label>
              <label>
                <span>
                  Organization{renderFieldBadge('organization_name')}
                </span>
                <input
                  name="organization_name"
                  maxLength={180}
                  value={form.organization_name}
                  onFocus={() => handleFieldFocus('organization_name')}
                  onChange={(e) => updateField('organization_name', e.target.value)}
                  placeholder="Recruiting authority"
                />
              </label>
              <label>
                <span>
                  Advertisement number{renderFieldBadge('advertisement_number')}
                </span>
                <input
                  name="advertisement_number"
                  maxLength={100}
                  value={form.advertisement_number}
                  onFocus={() => handleFieldFocus('advertisement_number')}
                  onChange={(e) => updateField('advertisement_number', e.target.value)}
                />
              </label>
              <label>
                <span>
                  Job category{renderFieldBadge('category_id')}
                </span>
                <select
                  name="category_id"
                  value={form.category_id}
                  onFocus={() => handleFieldFocus('category_id')}
                  onChange={(e) => updateField('category_id', e.target.value)}
                >
                  <option value="">Choose category</option>
                  {taxonomy.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  State{renderFieldBadge('state_id')}
                </span>
                <select
                  name="state_id"
                  value={form.state_id}
                  onFocus={() => handleFieldFocus('state_id')}
                  onChange={(e) => updateField('state_id', e.target.value)}
                >
                  <option value="">Choose state / all India</option>
                  {taxonomy.states.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  Job location{renderFieldBadge('location')}
                </span>
                <input
                  name="location"
                  maxLength={120}
                  value={form.location}
                  onFocus={() => handleFieldFocus('location')}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="All India or state"
                />
              </label>
              <label>
                <span>
                  Total vacancies{renderFieldBadge('total_vacancies')}
                </span>
                <input
                  name="total_vacancies"
                  type="number"
                  min="0"
                  step="1"
                  value={form.total_vacancies}
                  onFocus={() => handleFieldFocus('total_vacancies')}
                  onChange={(e) => updateField('total_vacancies', e.target.value)}
                />
              </label>
              <label className="wide-field">
                <span>
                  Short summary{renderFieldBadge('short_description')}
                </span>
                <textarea
                  name="short_description"
                  rows={3}
                  maxLength={500}
                  value={form.short_description}
                  onFocus={() => handleFieldFocus('short_description')}
                  onChange={(e) => updateField('short_description', e.target.value)}
                  placeholder="A concise, factual summary for job listings."
                />
              </label>
              <label className="wide-field">
                <span>
                  Recruitment details{renderFieldBadge('description')}
                </span>
                <textarea
                  name="description"
                  rows={5}
                  maxLength={12000}
                  value={form.description}
                  onFocus={() => handleFieldFocus('description')}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Add verified recruitment information. Leave details blank if not confirmed."
                />
              </label>
            </div>
          </section>

          <section className="editor-section">
            <span className="section-kicker">02 / IMPORTANT DATES</span>
            <h2>Application timeline</h2>
            <div className="editor-grid">
              {(
                [
                  ['application_start_date', 'Application start'],
                  ['application_end_date', 'Application deadline'],
                  ['fee_payment_last_date', 'Fee payment deadline'],
                  ['correction_last_date', 'Correction window'],
                  ['preliminary_exam_date', 'Preliminary exam'],
                  ['mains_exam_date', 'Mains exam'],
                  ['admit_card_date', 'Admit card date'],
                  ['result_date', 'Result date'],
                ] as const
              ).map(([name, label]) => (
                <label key={name}>
                  <span>
                    {label}
                    {renderFieldBadge(name)}
                  </span>
                  <input
                    name={name}
                    type="date"
                    value={form[name]}
                    onFocus={() => handleFieldFocus(name)}
                    onChange={(e) => updateField(name, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="editor-section">
            <span className="section-kicker">03 / ELIGIBILITY</span>
            <h2>Candidate requirements</h2>
            <div className="editor-grid">
              <label>
                <span>
                  Minimum age{renderFieldBadge('minimum_age')}
                </span>
                <input
                  name="minimum_age"
                  type="number"
                  min="0"
                  max="100"
                  value={form.minimum_age}
                  onFocus={() => handleFieldFocus('minimum_age')}
                  onChange={(e) => updateField('minimum_age', e.target.value)}
                />
              </label>
              <label>
                <span>
                  Maximum age{renderFieldBadge('maximum_age')}
                </span>
                <input
                  name="maximum_age"
                  type="number"
                  min="0"
                  max="120"
                  value={form.maximum_age}
                  onFocus={() => handleFieldFocus('maximum_age')}
                  onChange={(e) => updateField('maximum_age', e.target.value)}
                />
              </label>
              <label>
                <span>
                  Age calculation date{renderFieldBadge('age_calculation_date')}
                </span>
                <input
                  name="age_calculation_date"
                  type="date"
                  value={form.age_calculation_date}
                  onFocus={() => handleFieldFocus('age_calculation_date')}
                  onChange={(e) => updateField('age_calculation_date', e.target.value)}
                />
              </label>
              <label>
                <span>
                  Minimum qualification{renderFieldBadge('minimum_qualification_id')}
                </span>
                <select
                  name="minimum_qualification_id"
                  value={form.minimum_qualification_id}
                  onFocus={() => handleFieldFocus('minimum_qualification_id')}
                  onChange={(e) => updateField('minimum_qualification_id', e.target.value)}
                >
                  <option value="">Choose qualification</option>
                  {taxonomy.qualifications.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  Required experience{renderFieldBadge('experience')}
                </span>
                <input
                  name="experience"
                  maxLength={500}
                  value={form.experience}
                  onFocus={() => handleFieldFocus('experience')}
                  onChange={(e) => updateField('experience', e.target.value)}
                  placeholder="If specified"
                />
              </label>
              <label>
                <span>
                  Age relaxation{renderFieldBadge('age_relaxation')}
                </span>
                <input
                  name="age_relaxation"
                  maxLength={1000}
                  value={form.age_relaxation}
                  onFocus={() => handleFieldFocus('age_relaxation')}
                  onChange={(e) => updateField('age_relaxation', e.target.value)}
                  placeholder="See notification if not confirmed"
                />
              </label>
              <label className="wide-field">
                <span>
                  Additional eligibility{renderFieldBadge('additional_eligibility')}
                </span>
                <textarea
                  name="additional_eligibility"
                  rows={3}
                  maxLength={4000}
                  value={form.additional_eligibility}
                  onFocus={() => handleFieldFocus('additional_eligibility')}
                  onChange={(e) => updateField('additional_eligibility', e.target.value)}
                />
              </label>
              <label className="wide-field">
                <span>
                  Selection stages{renderFieldBadge('selection_process')}
                </span>
                <textarea
                  name="selection_process"
                  rows={3}
                  value={form.selection_process}
                  onFocus={() => handleFieldFocus('selection_process')}
                  onChange={(e) => updateField('selection_process', e.target.value)}
                  placeholder={'["Written examination", "Interview"]'}
                />
                <small>Enter a JSON list of confirmed selection stages in order.</small>
              </label>
            </div>
          </section>

          <section className="editor-section">
            <span className="section-kicker">04 / FEES & VACANCIES</span>
            <h2>Breakdowns</h2>
            <div className="editor-grid">
              <label className="wide-field">
                <span>
                  Application fees{renderFieldBadge('fees_json')}
                </span>
                <textarea
                  name="fees_json"
                  rows={4}
                  value={form.fees_json}
                  onFocus={() => handleFieldFocus('fees_json')}
                  onChange={(e) => updateField('fees_json', e.target.value)}
                  placeholder={'[{"category_name":"General","amount":100,"currency":"INR"}]'}
                />
                <small>JSON list. Set amount to null when the official notice does not state a fee.</small>
              </label>
              <label className="wide-field">
                <span>
                  Vacancy rows{renderFieldBadge('vacancies_json')}
                </span>
                <textarea
                  name="vacancies_json"
                  rows={5}
                  value={form.vacancies_json}
                  onFocus={() => handleFieldFocus('vacancies_json')}
                  onChange={(e) => updateField('vacancies_json', e.target.value)}
                  placeholder={'[{"post_name":"Assistant","total_posts":10,"category_breakdown":{"General":4,"OBC":3,"SC":2,"ST":1}}]'}
                />
                <small>
                  JSON list of posts with numeric category counts. Leave blank when not officially
                  specified.
                </small>
              </label>
            </div>
          </section>

          <section className="editor-section">
            <span className="section-kicker">05 / OFFICIAL LINKS & REVIEW</span>
            <h2>Application and verification</h2>
            <div className="editor-grid">
              <label>
                <span>
                  Apply online URL{renderFieldBadge('apply_url')}
                </span>
                <input
                  type="url"
                  name="apply_url"
                  value={form.apply_url}
                  onFocus={() => handleFieldFocus('apply_url')}
                  onChange={(e) => updateField('apply_url', e.target.value)}
                  placeholder="https://"
                />
              </label>
              <label>
                <span>
                  Official website URL{renderFieldBadge('official_website_url')}
                </span>
                <input
                  type="url"
                  name="official_website_url"
                  value={form.official_website_url}
                  onFocus={() => handleFieldFocus('official_website_url')}
                  onChange={(e) => updateField('official_website_url', e.target.value)}
                  placeholder="https://"
                />
              </label>
              <label>
                <span>
                  English notification URL{renderFieldBadge('notification_english_url')}
                </span>
                <input
                  type="url"
                  name="notification_english_url"
                  value={form.notification_english_url}
                  onFocus={() => handleFieldFocus('notification_english_url')}
                  onChange={(e) => updateField('notification_english_url', e.target.value)}
                  placeholder="https://"
                />
              </label>
              <label>
                <span>
                  Hindi notification URL{renderFieldBadge('notification_hindi_url')}
                </span>
                <input
                  type="url"
                  name="notification_hindi_url"
                  value={form.notification_hindi_url}
                  onFocus={() => handleFieldFocus('notification_hindi_url')}
                  onChange={(e) => updateField('notification_hindi_url', e.target.value)}
                  placeholder="https://"
                />
              </label>
              <label className="wide-field">
                <span>
                  Original source URL{renderFieldBadge('source_url')}
                </span>
                <input
                  type="url"
                  name="source_url"
                  value={form.source_url}
                  onFocus={() => handleFieldFocus('source_url')}
                  onChange={(e) => updateField('source_url', e.target.value)}
                  placeholder="https://"
                />
              </label>
              <label>
                Source type
                <select
                  name="source_type"
                  value={form.source_type}
                  onChange={(e) => updateField('source_type', e.target.value)}
                >
                  <option value="">Choose source type</option>
                  <option value="official">Official authority</option>
                  <option value="verified-media">Verified media</option>
                  <option value="sample">Development sample</option>
                </select>
              </label>
              <label className="check-field">
                <span>Feature this listing</span>
                <input
                  name="is_featured"
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => updateField('is_featured', e.target.checked)}
                />
              </label>
              <label>
                Verification status
                <select
                  name="verification_status"
                  value={form.verification_status}
                  onChange={(e) =>
                    updateField(
                      'verification_status',
                      e.target.value as JobFormValues['verification_status'],
                    )
                  }
                >
                  <option value="pending">Needs verification</option>
                  <option value="verified">Verified against official source</option>
                </select>
              </label>
            </div>
          </section>

          <div className="editor-footer">
            <p>
              Drafts and extracted evidence are saved automatically in localStorage. Publishing
              requires explicit confirmation.
            </p>
            <div>
              <button
                type="button"
                className="outline-link"
                onClick={() => setViewMode('preview')}
              >
                <Eye className="h-3.5 w-3.5" /> Preview job
              </button>
              <button
                type="submit"
                className="primary-action"
              >
                <Save /> Save as Draft
              </button>
              <button
                type="button"
                className="primary-action publish-action"
                onClick={() => setShowPublishConfirm(true)}
              >
                <Send className="h-3.5 w-3.5" /> Publish
              </button>
            </div>
          </div>
        </form>

        <FieldReview
          selectedFieldKey={selectedFieldKey}
          fieldMeta={selectedFieldKey ? (extraction?.fields[selectedFieldKey] ?? null) : null}
          conflicts={extraction?.conflicts ?? []}
          sourceContent={sourceContent}
        />
      </div>

      {/* Explicit Publish Confirmation Dialog */}
      {showPublishConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 id="publish-confirm-title" className="text-base font-bold text-[#1b3150]">
                  Confirm before publishing
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  AI-extracted values are estimates and are not automatically verified. Confirm that
                  you have manually checked all dates, vacancies, eligibility, and official URLs
                  against the official source.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPublishConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setShowPublishConfirm(false)
                  saveToLocalJobs('published')
                }}
                className="bg-[#244c7b] text-white hover:bg-[#19385d]"
              >
                Confirm & Publish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
