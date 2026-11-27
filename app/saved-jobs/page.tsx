import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SavedJobsClient } from '@/components/jobs/saved-jobs-client'
import { fsListDocs, getCurrentUser } from '@/lib/firebase/server'
import { getAllHydratedJobs } from '@/lib/queries/jobs'

export const metadata = { title: 'Saved Jobs' }

export default async function SavedJobsPage() {
  const [user, allJobs] = await Promise.all([getCurrentUser(), getAllHydratedJobs()])

  let serverSavedIds: string[] = []
  if (user) {
    try {
      const savedRows = await fsListDocs<{ user_id: string; job_id: string }>(
        'saved_jobs',
        user.idToken,
      )
      serverSavedIds = savedRows
        .filter((row) => row.user_id === user.uid)
        .map((row) => row.job_id)
    } catch {
      serverSavedIds = []
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="listing-page">
        <div className="listing-header">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Saved jobs</span>
          </div>
          <span className="section-kicker">YOUR SHORTLIST</span>
          <h1>Saved jobs</h1>
          <p>Recruitment opportunities you&apos;ve bookmarked in your browser to review later.</p>
        </div>
        <section className="resource-list">
          <SavedJobsClient allJobs={allJobs} serverSavedIds={serverSavedIds} />
        </section>
      </main>
    </>
  )
}
