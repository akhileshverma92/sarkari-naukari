import type { MetadataRoute } from 'next'
import { getAllHydratedJobs } from '@/lib/queries/jobs'
import { siteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl
  const jobs = await getAllHydratedJobs()
  const visible = jobs.filter((job) => job.status === 'published' || job.status === 'closed')
  return [
    { url: base, lastModified: new Date() },
    ...visible.map((job) => ({
      url: `${base}/jobs/${job.slug}`,
      lastModified: job.updated_at ? new Date(job.updated_at) : new Date(),
    })),
  ]
}
