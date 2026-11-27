'use client'

import { Loader2, Sparkles } from 'lucide-react'

export function ExtractionProgress() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center rounded-xl border border-[#dce7f5] bg-[#f4f8fe] px-6 py-10 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6effb] text-[#2459a6]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h3 className="mt-4 flex items-center gap-1.5 text-sm font-bold text-[#1b3150]">
        <Sparkles className="h-4 w-4 text-[#2459a6]" /> Analyzing recruitment notice…
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
        Sending source content to Cloudflare Workers AI, extracting structured dates, vacancies,
        and eligibility, and validating every field against the schema.
      </p>
    </div>
  )
}
