'use client'

import { Link2 } from 'lucide-react'
import { toast } from 'sonner'

export function ShareJobCard({ title, slug }: { title: string; slug: string }) {
  function getShareUrl() {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/jobs/${slug}`
  }

  async function copyLink() {
    const url = getShareUrl()
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Job link copied to clipboard.')
    } catch {
      toast.error('Could not copy link.')
    }
  }

  function openShare(platform: 'whatsapp' | 'telegram' | 'x') {
    const url = encodeURIComponent(getShareUrl())
    const text = encodeURIComponent(`${title} — Sarkari Naukari`)
    const targets = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    }
    window.open(targets[platform], '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
        SHARE
      </span>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openShare('whatsapp')}
          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-[#171717] transition hover:bg-stone-100"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => openShare('telegram')}
          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-[#171717] transition hover:bg-stone-100"
        >
          Telegram
        </button>
        <button
          type="button"
          onClick={() => openShare('x')}
          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-[#171717] transition hover:bg-stone-100"
        >
          X
        </button>
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link"
          className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-[#171717] transition hover:bg-stone-100"
        >
          <Link2 className="h-3.5 w-3.5" /> Copy
        </button>
      </div>
    </div>
  )
}
