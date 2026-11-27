'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { JobCard } from '@/components/jobs/job-card'
import { readLocalSavedJobs, SAVED_JOBS_EVENT } from '@/components/jobs/save-job-button'
import type { Job } from '@/lib/queries/jobs'

export function SavedJobsClient({
  allJobs,
  serverSavedIds = [],
}: {
  allJobs: Job[]
  serverSavedIds?: string[]
}) {
  const [savedIds, setSavedIds] = useState<string[]>(serverSavedIds)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const sync = () => {
      const localIds = readLocalSavedJobs().map((item) => item.jobId)
      const merged = Array.from(new Set([...localIds, ...serverSavedIds]))
      setSavedIds(merged)
    }
    sync()
    setHydrated(true)
    window.addEventListener(SAVED_JOBS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SAVED_JOBS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [serverSavedIds])

  const jobMap = new Map(allJobs.map((job) => [job.id, job]))
  const jobs = savedIds
    .map((id) => jobMap.get(id))
    .filter((job): job is Job => Boolean(job))

  if (!hydrated) {
    return (
      <div className="empty-panel">
        <span className="empty-icon">
          <Bookmark />
        </span>
        <h3>Loading saved jobs…</h3>
      </div>
    )
  }

  return jobs.length ? (
    <div className="jobs-grid">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  ) : (
    <div className="empty-panel">
      <span className="empty-icon">
        <Bookmark />
      </span>
      <h3>No saved jobs yet</h3>
      <p>Bookmark an opportunity to keep it handy in your browser for later.</p>
      <Link href="/jobs" className="outline-link">
        Explore jobs
      </Link>
    </div>
  )
}
