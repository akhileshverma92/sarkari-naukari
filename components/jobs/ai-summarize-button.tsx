'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import type { JobSummaryPayload } from '@/app/api/ai/summarize-job/route'

const CACHE_PREFIX = 'govtjobs_summary_v2_'

export function AiSummarizeJob({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<'en' | 'hi'>('en')
  const [summary, setSummary] = useState<JobSummaryPayload | null>(null)

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`${CACHE_PREFIX}${slug}`)
      if (cached) {
        setSummary(JSON.parse(cached) as JobSummaryPayload)
      }
    } catch {
      // Ignore storage errors
    }
  }, [slug])

  async function handleSummarize() {
    if (summary) {
      setOpen(true)
      return
    }
    if (loading) return

    setLoading(true)
    try {
      const res = await fetch('/api/ai/summarize-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        summary?: JobSummaryPayload
        error?: string
      }

      if (!res.ok || !data.summary) {
        toast.error(data.error ?? 'Could not summarize this job.')
        setLoading(false)
        return
      }

      setSummary(data.summary)
      setOpen(true)
      try {
        sessionStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(data.summary))
      } catch {
        // Ignore
      }
    } catch {
      toast.error('Network error while generating AI summary.')
    } finally {
      setLoading(false)
    }
  }

  const activeContent = summary ? summary[lang] : null

  return (
    <>
      <button
        type="button"
        onClick={handleSummarize}
        disabled={loading}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#171717] shadow-2xs transition hover:border-stone-300 hover:bg-stone-50 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Summarizing…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> AI Summarize
          </>
        )}
      </button>

      {open && activeContent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-summary-modal-title"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-stone-200 bg-[#fbfbfa] p-5 text-left shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span
                  id="ai-summary-modal-title"
                  className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-600"
                >
                  AI Quick Summary
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close summary modal"
                className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 hover:bg-stone-100 hover:text-[#171717]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Language Tabs: English & Hindi */}
            <div className="mt-3.5 inline-flex rounded-full border border-stone-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  lang === 'en'
                    ? 'bg-[#171717] text-white'
                    : 'text-stone-600 hover:text-[#171717]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  lang === 'hi'
                    ? 'bg-[#171717] text-white'
                    : 'text-stone-600 hover:text-[#171717]'
                }`}
              >
                हिंदी (Hindi)
              </button>
            </div>

            <p className="mt-4 text-sm font-bold leading-snug text-[#171717] sm:text-base">
              {activeContent.headline}
            </p>

            {activeContent.highlights.length > 0 && (
              <ul className="mt-4 space-y-2 rounded-2xl border border-stone-200/80 bg-white p-4 text-xs text-stone-700">
                {activeContent.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#171717]" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {activeContent.whoShouldApply && (
              <div className="mt-3 rounded-2xl border border-stone-200/80 bg-white p-4 text-xs leading-relaxed text-stone-700">
                <strong className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                  {lang === 'hi' ? 'किसे आवेदन करना चाहिए' : 'WHO SHOULD APPLY'}
                </strong>
                <p className="mt-1">{activeContent.whoShouldApply}</p>
              </div>
            )}

            {activeContent.actionTip && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[11px] font-medium text-amber-900">
                {lang === 'hi' ? 'सुझाव: ' : 'Tip: '}
                {activeContent.actionTip}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-200/80 pt-4">
              <span className="text-[10px] text-stone-400">
                {lang === 'hi'
                  ? 'अंतिम विवरण आधिकारिक अधिसूचना पर जांचें।'
                  : 'Verify final details on the official notice.'}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-[#171717] px-5 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
              >
                {lang === 'hi' ? 'ठीक है' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
