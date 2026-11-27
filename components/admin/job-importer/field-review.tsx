'use client'

import { Quote, ShieldAlert, Sparkles } from 'lucide-react'
import {
  TRACKABLE_FIELD_LABELS,
  type ExtractedFieldMeta,
  type ExtractionConflict,
} from '@/lib/ai/extraction-schema'

export function FieldReview({
  selectedFieldKey,
  fieldMeta,
  conflicts,
  sourceContent,
}: {
  selectedFieldKey: string | null
  fieldMeta: ExtractedFieldMeta | null
  conflicts: ExtractionConflict[]
  sourceContent: string
}) {
  const fieldConflicts = selectedFieldKey
    ? conflicts.filter((c) => c.field === selectedFieldKey)
    : []

  const confidenceStyles = {
    high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-sky-50 text-sky-700 border-sky-200',
    low: 'bg-amber-50 text-amber-800 border-amber-200',
  }

  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="h-4 w-4 text-[#2459a6]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1b3150]">
            Field Evidence Inspector
          </h3>
        </div>

        {!selectedFieldKey || !fieldMeta ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Select or focus any AI-populated field in the form to inspect its confidence score,
            verification status, and exact evidence snippet from your source text.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs text-[#1b3150]">
                {TRACKABLE_FIELD_LABELS[selectedFieldKey] ?? selectedFieldKey}
              </strong>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${confidenceStyles[fieldMeta.confidence]}`}
              >
                {fieldMeta.confidence} confidence
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>AI estimate — not officially verified</span>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Quote className="h-3 w-3" /> Source evidence
              </span>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                {fieldMeta.evidence ?? 'No verbatim evidence snippet was recorded for this field.'}
              </p>
            </div>

            {fieldConflicts.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                <strong>Conflict:</strong> {fieldConflicts.map((c) => c.message).join('; ')}
              </div>
            )}
          </div>
        )}
      </div>

      {sourceContent && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <summary className="cursor-pointer text-xs font-bold text-[#1b3150]">
            Original pasted source ({sourceContent.length.toLocaleString()} chars)
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
            {sourceContent}
          </pre>
        </details>
      )}
    </aside>
  )
}
