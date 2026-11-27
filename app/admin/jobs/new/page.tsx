import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import { getTaxonomies } from '@/lib/queries/jobs'
import { JobImporter } from '@/components/admin/job-importer/job-importer'

export const metadata = { title: 'Add a job' }

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Fadmin%2Fjobs%2Fnew')
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin%2Fjobs%2Fnew&error=unauthorized')

  const [{ error }, taxonomy] = await Promise.all([searchParams, getTaxonomies()])

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">G</span>
          <span>
            Sarkari<span className="brand-accent"> Naukari</span>
          </span>
        </Link>
        <span className="admin-label">WORKSPACE</span>
        <Link href="/admin" className="admin-nav">
          <ArrowLeft /> Back to overview
        </Link>
        <Link href="/admin/jobs" className="admin-nav">
          Manage jobs
        </Link>
        <Link href="/admin/taxonomies" className="admin-nav">
          Categories & lists
        </Link>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <span className="section-kicker">RECRUITMENT / NEW LISTING</span>
            <h1>Add a job</h1>
          </div>
          <Link href="/admin/jobs" className="outline-link">
            Cancel
          </Link>
        </header>
        <p className="admin-intro">
          Import recruitment notices with AI or enter details manually. Save a draft until all
          information has been verified against an official source.
        </p>
        <JobImporter taxonomy={taxonomy} initialError={error} />
      </section>
    </main>
  )
}
