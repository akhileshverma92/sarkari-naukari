import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import { getJobs } from '@/lib/queries/jobs'
import { JobsDataTable } from '@/components/admin/jobs-data-table'

type SearchParams = Promise<{
  q?: string
  status?: string
  notice?: string
  error?: string
  page?: string
}>

export const metadata = { title: 'Manage jobs' }

export default async function ManageJobs({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Fadmin%2Fjobs')
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin%2Fjobs&error=unauthorized')

  const page = Math.max(1, Number(params.page) || 1)
  const { jobs, count, error } = await getJobs({
    search: params.q,
    status: params.status || undefined,
    page,
    limit: 10,
    admin: true,
    idToken: user.idToken,
  })
  const pages = Math.max(1, Math.ceil(count / 10))
  const rows = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    slug: job.slug,
    status: job.status,
    total_vacancies: job.total_vacancies,
    application_end_date: job.application_end_date,
    published_at: job.published_at,
    created_at: job.created_at,
    organizations: job.organizations ? { name: job.organizations.name } : null,
  }))

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
          Overview
        </Link>
        <Link href="/admin/jobs" className="admin-nav active">
          Manage jobs
        </Link>
        <Link href="/admin/jobs/new" className="admin-nav">
          <Plus /> Add new job
        </Link>
        <Link href="/admin/automation" className="admin-nav">
          Automation
        </Link>
        <Link href="/admin/taxonomies" className="admin-nav">
          Categories & lists
        </Link>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <span className="section-kicker">CONTENT / RECRUITMENT</span>
            <h1>Manage jobs</h1>
          </div>
          <Link href="/admin/jobs/new" className="primary-action">
            <Plus /> Add a job
          </Link>
        </header>
        {params.notice && (
          <div className="admin-notice" role="status">
            {params.notice.replaceAll('+', ' ')}
          </div>
        )}
        {params.error && (
          <div className="form-alert" role="alert">
            {params.error.replaceAll('+', ' ')}
          </div>
        )}
        <div className="admin-table-panel">
          <form action="/admin/jobs" className="admin-filterbar">
            <label className="admin-search">
              <Search />
              <input
                name="q"
                defaultValue={params.q}
                placeholder="Search title, organization or advertisement number"
                aria-label="Search jobs"
              />
              <button type="submit">Search</button>
            </label>
            <label className="sr-only" htmlFor="status-filter">
              Filter by status
            </label>
            <select id="status-filter" name="status" defaultValue={params.status ?? ''}>
              <option value="">All statuses</option>
              {['draft', 'pending_review', 'published', 'rejected', 'archived', 'closed'].map(
                (status) => (
                  <option value={status} key={status}>
                    {status.replace('_', ' ')}
                  </option>
                ),
              )}
            </select>
          </form>
          {error ? (
            <div className="admin-empty">
              <p>Could not load jobs. Please refresh.</p>
            </div>
          ) : rows.length ? (
            <JobsDataTable jobs={rows} />
          ) : (
            <div className="admin-empty">
              <h3>No jobs match this view</h3>
              <p>Create a listing or clear search and filters to see jobs.</p>
              <Link href="/admin/jobs/new" className="primary-action">
                Add a job
              </Link>
            </div>
          )}
          <nav className="admin-pagination" aria-label="Job list pages">
            <span>
              {count} jobs · Page {page} of {pages}
            </span>
            <div>
              {page > 1 && (
                <Link
                  href={`/admin/jobs?${new URLSearchParams({
                    ...(params.q ? { q: params.q } : {}),
                    ...(params.status ? { status: params.status } : {}),
                    page: String(page - 1),
                  })}`}
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/admin/jobs?${new URLSearchParams({
                    ...(params.q ? { q: params.q } : {}),
                    ...(params.status ? { status: params.status } : {}),
                    page: String(page + 1),
                  })}`}
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        </div>
        <p className="admin-footnote">Signed in as {user.email}</p>
      </section>
    </main>
  )
}
