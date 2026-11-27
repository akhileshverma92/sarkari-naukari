'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Pencil,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  TRACKABLE_FIELD_LABELS,
  type NormalizedExtractionResult,
} from '@/lib/ai/extraction-schema'

export function ExtractionSummary({
  result,
  onEdit,
  onReExtract,
  onPreview,
  onSaveDraft,
  onPublishRequest,
  loading,
}: {
  result: NormalizedExtractionResult
  onEdit: () => void
  onReExtract: () => void
  onPreview: () => void
  onSaveDraft: () => void
  onPublishRequest: () => void
  loading: boolean
}) {
  const {
    extractedCount,
    totalTrackableFields,
    missingFields,
    lowConfidenceFields,
    conflicts,
    data,
    mode,
  } = result

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="section-kicker">
            {mode === 'json' ? 'DIRECT JSON PARSE' : 'AI EXTRACTION SUMMARY'}
          </span>
          <h2 className="mt-1 text-base font-bold text-[#1b3150]">
            Extracted {extractedCount} of {totalTrackableFields} trackable fields
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            AI extraction is unverified by default. Review low-confidence fields and conflicts
            before publishing.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 border border-amber-200">
          <ShieldAlert className="h-3.5 w-3.5" /> Unverified AI Draft
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <small className="text-[11px] text-slate-500">Extracted fields</small>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-[#1b3150]">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {extractedCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <small className="text-[11px] text-slate-500">Missing fields</small>
          <p className="mt-1 text-lg font-bold text-slate-700">{missingFields.length}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <small className="text-[11px] text-slate-500">Needs review</small>
          <p className="mt-1 text-lg font-bold text-amber-700">{lowConfidenceFields.length}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <small className="text-[11px] text-slate-500">Conflicts</small>
          <p className="mt-1 text-lg font-bold text-red-700">{conflicts.length}</p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3.5">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-red-900">
            <AlertTriangle className="h-4 w-4 text-red-600" /> Conflicting information detected
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-red-800">
            {conflicts.map((c, idx) => (
              <li key={idx}>
                <strong>{TRACKABLE_FIELD_LABELS[c.field] ?? c.field}:</strong> {c.message}
                {c.values.length > 0 && ` (${c.values.join(' vs ')})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lowConfidenceFields.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-xs font-semibold text-amber-900">
            Fields requiring manual review (low confidence):
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lowConfidenceFields.map((key) => (
              <span
                key={key}
                className="rounded-md border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800"
              >
                {TRACKABLE_FIELD_LABELS[key] ?? key}
              </span>
            ))}
          </div>
        </div>
      )}

      {missingFields.length > 0 && (
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Missing fields ({missingFields.length}) — left empty
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingFields.map((key) => (
              <span
                key={key}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
              >
                {TRACKABLE_FIELD_LABELS[key] ?? key}
              </span>
            ))}
          </div>
        </details>
      )}

      {(data.sourceName || data.sourceUrl) && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
          <strong>Source:</strong> {data.sourceName ?? 'Unspecified'}{' '}
          {data.sourceUrl && (
            <span className="ml-2 font-mono text-[11px] text-slate-500">{data.sourceUrl}</span>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit extracted details
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onReExtract} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" /> Re-extract
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5" /> Preview job
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSaveDraft}>
            <Save className="h-3.5 w-3.5" /> Save as Draft
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onPublishRequest}
            className="bg-[#244c7b] text-white hover:bg-[#19385d]"
          >
            <Send className="h-3.5 w-3.5" /> Publish
          </Button>
        </div>
      </div>
    </section>
  )
}
