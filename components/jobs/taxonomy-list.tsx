import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { JobCard } from '@/components/jobs/job-card'
import { getAllHydratedJobs, getTaxonomies } from '@/lib/queries/jobs'

export async function TaxonomyList({
  kind,
  slug,
}: {
  kind: 'state' | 'qualification' | 'organization'
  slug: string
}) {
  const taxonomies = await getTaxonomies()
  const list =
    kind === 'state'
      ? taxonomies.states
      : kind === 'qualification'
        ? taxonomies.qualifications
        : taxonomies.organizations

  const item = list.find((entry) => entry.slug === slug)
  if (!item) notFound()

  const key =
    kind === 'state'
      ? 'state_id'
      : kind === 'qualification'
        ? 'minimum_qualification_id'
        : 'organization_id'

  let data = [] as Awaited<ReturnType<typeof getAllHydratedJobs>>
  let hasError = false
  try {
    const allJobs = await getAllHydratedJobs()
    data = allJobs
      .filter(
        (job) =>
          job[key] === item.id && (job.status === 'published' || job.status === 'closed'),
      )
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  } catch {
    hasError = true
  }

  const title =
    kind === 'state'
      ? `${item.name} jobs`
      : kind === 'qualification'
        ? `${item.name} qualification jobs`
        : `${item.name} recruitment`

  return (
    <>
      <SiteHeader />
      <main className="listing-page">
        <div className="listing-header">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/jobs">Jobs</Link>
            <span>/</span>
            <span>{item.name}</span>
          </div>
          <span className="section-kicker">EXPLORE RECRUITMENT</span>
          <h1>{title}</h1>
          <p>Government recruitment opportunities that match this {kind}.</p>
        </div>
        <section className="resource-list">
          {hasError ? (
            <div className="empty-panel">
              <h3>Unable to load listings</h3>
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
              <h3>No published jobs here yet</h3>
              <p>We only show verified recruitment records. Check back for new listings.</p>
              <Link href="/jobs" className="outline-link">
                <ArrowLeft /> Browse all jobs
              </Link>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
