import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { JobDetailView } from '@/components/jobs/job-detail-view'
import { getJobBySlug, getJobs } from '@/lib/queries/jobs'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const job = await getJobBySlug(slug)
  if (!job) return { title: 'Job not found' }
  return {
    title: job.title,
    description:
      job.short_description ??
      `Recruitment details, eligibility and important dates for ${job.title}.`,
    alternates: { canonical: `/jobs/${slug}` },
    openGraph: {
      title: job.title,
      description: job.short_description ?? 'Government recruitment details',
    },
  }
}

export default async function JobDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [job, { jobs: recentJobs }] = await Promise.all([
    getJobBySlug(slug),
    getJobs({ limit: 6 }),
  ])
  if (!job) notFound()

  const relatedJobs = recentJobs.filter((item) => item.id !== job.id).slice(0, 5)

  const today = new Date().toISOString().slice(0, 10)
  const expired =
    job.status === 'closed' ||
    Boolean(job.application_end_date && job.application_end_date < today)

  const hasJobPosting =
    job.status === 'published' &&
    !expired &&
    job.verification_status === 'verified' &&
    Boolean(
      job.published_at &&
        job.application_end_date &&
        job.organizations?.name &&
        (job.location || job.states?.name) &&
        job.description,
    )

  const jsonLd = hasJobPosting
    ? {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: job.title,
        description: job.description,
        datePosted: job.published_at,
        validThrough: new Date(`${job.application_end_date}T23:59:59+05:30`).toISOString(),
        directApply: Boolean(job.apply_url),
        hiringOrganization: { '@type': 'Organization', name: job.organizations?.name },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: job.location || job.states?.name,
            addressRegion: job.states?.name,
            addressCountry: 'IN',
          },
        },
        ...(job.advertisement_number
          ? {
              identifier: {
                '@type': 'PropertyValue',
                name: job.organizations?.name,
                value: job.advertisement_number,
              },
            }
          : {}),
      }
    : null

  const safeJson = jsonLd ? JSON.stringify(jsonLd).replace(/</g, '\\u003c') : ''

  return (
    <>
      <SiteHeader />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJson }}
        />
      )}
      <JobDetailView job={job} relatedJobs={relatedJobs} />
    </>
  )
}
