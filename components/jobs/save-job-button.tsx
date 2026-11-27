'use client'

import { useEffect, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export const SAVED_JOBS_STORAGE_KEY = 'govtjobs_hub_saved_jobs_v1'
export const SAVED_JOBS_EVENT = 'govtjobs:saved-updated'

export type LocalSavedJobEntry = {
  jobId: string
  savedAt: string
}

export function readLocalSavedJobs(): LocalSavedJobEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SAVED_JOBS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function SaveJobButton({ jobId }: { jobId: string; slug?: string }) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const sync = () => {
      const list = readLocalSavedJobs()
      setSaved(list.some((item) => item.jobId === jobId))
    }
    sync()
    window.addEventListener(SAVED_JOBS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SAVED_JOBS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [jobId])

  function toggle() {
    const current = readLocalSavedJobs()
    const exists = current.some((item) => item.jobId === jobId)
    const next = exists
      ? current.filter((item) => item.jobId !== jobId)
      : [{ jobId, savedAt: new Date().toISOString() }, ...current]

    try {
      localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      toast.error('Could not update saved jobs in your browser.')
      return
    }

    setSaved(!exists)
    window.dispatchEvent(new Event(SAVED_JOBS_EVENT))
    toast.success(exists ? 'Removed from saved jobs' : 'Saved for later')
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={saved ? 'Remove from saved jobs' : 'Save job'}
      aria-pressed={saved}
      title={saved ? 'Saved in browser' : 'Save job'}
      onClick={toggle}
    >
      <Bookmark
        data-icon="inline-start"
        aria-hidden="true"
        className={saved ? 'fill-[#2459a6] text-[#2459a6]' : undefined}
      />
    </Button>
  )
}
