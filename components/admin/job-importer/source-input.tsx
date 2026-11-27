'use client'

import { ClipboardPaste, Eraser, Sparkles, AlertTriangle, FileJson, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ExtractionErrorState } from './types'

const MAX_CHARS = 50000

export function SourceInput({
  value,
  onChange,
  onExtract,
  loading,
  error,
}: {
  value: string
  onChange: (next: string) => void
  onExtract: () => void
  loading: boolean
  error: ExtractionErrorState | null
}) {
  const trimmed = value.trim()
  const isJsonLike = trimmed.startsWith('{') || trimmed.startsWith('[')
  const charCount = value.length
  const overLimit = charCount > MAX_CHARS

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.info('Clipboard is empty.')
        return
      }
      onChange(text)
      toast.success('Pasted recruitment content from clipboard.')
    } catch {
      toast.error('Clipboard access denied. Paste directly using Ctrl+V.')
    }
  }

  function handleClear() {
    onChange('')
    toast.info('Cleared source input.')
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="section-kicker">AI EXTRACTION / SOURCE INPUT</span>
          <h2 className="mt-1 text-base font-bold text-[#1b3150]">
            Paste raw recruitment notice or JSON
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste official notification text, press releases, or structured JSON. Missing fields
            stay empty—never invented.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {isJsonLike ? (
              <>
                <FileJson className="h-3.5 w-3.5 text-[#2459a6]" /> JSON detected
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 text-[#2459a6]" /> Plain text
              </>
            )}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={handlePaste} disabled={loading}>
            <ClipboardPaste className="h-3.5 w-3.5" /> Paste content
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={loading || !value}
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="ai-source-textarea" className="sr-only">
          Raw recruitment text or JSON
        </label>
        <textarea
          id="ai-source-textarea"
          rows={11}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          placeholder={`Paste official recruitment notice text here...\n\nExample:\nStaff Selection Commission (SSC) — Advt. No. SSC/2026/CGL\nTotal Vacancies: 501 Posts\nApplication Start Date: 2026-07-01 | Last Date: 2026-07-31\nMinimum Age: 18 years, Maximum Age: 30 years\nQualification: Bachelor's Degree from a recognized university\nApply Online: https://ssc.gov.in`}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#4784cf] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2459a6]/15 disabled:opacity-60"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">{error.message}</p>
            {error.issues && error.issues.length > 0 && (
              <ul className="list-disc pl-4 text-[11px] text-amber-800">
                {error.issues.slice(0, 4).map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className={`text-xs ${overLimit ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
        </span>
        <Button
          type="button"
          onClick={onExtract}
          disabled={loading || trimmed.length < 20 || overLimit}
          className="bg-[#2459a6] text-white hover:bg-[#194a88]"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? 'Extracting with AI…' : 'Extract with AI'}
        </Button>
      </div>
    </section>
  )
}
