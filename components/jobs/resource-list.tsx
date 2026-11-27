import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { JobCard } from '@/components/jobs/job-card'
import { getAllHydratedJobs } from '@/lib/queries/jobs'

const fields = {
  admit: 'admit_card_date',
  result: 'result_date',
  calendar: 'preliminary_exam_date',
} as const

export async function ResourceList({
  kind,
  title,
  description,
}: {
  kind: keyof typeof fields
  title: string
  description: string
}) {
  const field = fields[kind]
  let data = [] as Awaited<ReturnType<typeof getAllHydratedJobs>>
  let hasError = false
  try {
    const allJobs = await getAllHydratedJobs()
    data = allJobs
      .filter((job) => (job.status === 'published' || job.status === 'closed') && Boolean(job[field]))
      .sort((a, b) => (a[field] ?? '').localeCompare(b[field] ?? ''))
      .slice(0, 20)
  } catch {
    hasError = true
  }

  return (
    <>
      <SiteHeader />
      <main className="listing-page">
        <div className="listing-header">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>{title}</span>
          </div>
          <span className="section-kicker">RECRUITMENT UPDATES</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <section className="resource-list">
          {hasError ? (
            <div className="empty-panel">
              <h3>Unable to load updates</h3>
              <p>Please try again later.</p>
            </div>
          ) : data.length ? (
            <div className="jobs-grid">
              {data.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <span className="empty-icon">
                <FileSearch />
              </span>
              <h3>No updates published yet</h3>
              <p>
                There are no verified {title.toLowerCase()} to display right now. We&apos;ll add
                updates when official information is available.
              </p>
              <Link href="/jobs" className="outline-link">
                Browse latest jobs
              </Link>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
