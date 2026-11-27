import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { JobCard } from '@/components/jobs/job-card'
import { getAllHydratedJobs, getTaxonomies } from '@/lib/queries/jobs'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return {
    title: `${slug
      .split('-')
      .map((x) => (x[0] ? x[0].toUpperCase() + x.slice(1) : ''))
      .join(' ')} Jobs`,
    description: 'Government job listings by recruitment category.',
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const taxonomies = await getTaxonomies()
  const category = taxonomies.categories.find((c) => c.slug === slug)

  if (!category) {
    return (
      <>
        <SiteHeader />
        <main className="listing-page">
          <div className="empty-panel">
            <h1>Category not found</h1>
            <p>We don&apos;t have a matching category in the current listings.</p>
            <Link href="/jobs" className="outline-link">
              <ArrowLeft /> Browse all jobs
            </Link>
          </div>
        </main>
      </>
    )
  }

  const allJobs = await getAllHydratedJobs()
  const data = allJobs
    .filter(
      (job) =>
        job.category_id === category.id &&
        (job.status === 'published' || job.status === 'closed'),
    )
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))

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
            <span>{category.name}</span>
          </div>
          <span className="section-kicker">EXPLORE BY CATEGORY</span>
          <h1>{category.name} jobs</h1>
          <p>Current government recruitment opportunities in this category.</p>
        </div>
        <section className="resource-list">
          {data.length ? (
            <div className="jobs-grid">
              {data.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <h3>No published jobs in this category</h3>
              <p>New recruitment updates will appear when verified.</p>
              <Link href="/jobs" className="outline-link">
                Browse all jobs
              </Link>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
