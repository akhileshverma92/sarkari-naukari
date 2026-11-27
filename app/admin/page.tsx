import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Plus,
  BriefcaseBusiness,
  FileClock,
  CircleCheck,
  Building2,
  ArrowUpRight,
  ExternalLink,
  ClipboardList,
} from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import { getAllHydratedJobs, getTaxonomies } from '@/lib/queries/jobs'
import { setJobStatusAction } from '@/lib/actions/jobs'

export const metadata = { title: 'Admin overview' }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Fadmin')
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin&error=unauthorized')

  const [allJobs, taxonomies, params] = await Promise.all([
    getAllHydratedJobs(user.idToken),
    getTaxonomies(),
    searchParams,
  ])

  const all = allJobs.length
  const published = allJobs.filter((j) => j.status === 'published').length
  const drafts = allJobs.filter((j) => j.status === 'draft').length
  const pending = allJobs.filter((j) => j.status === 'pending_review').length
  const closed = allJobs.filter((j) => j.status === 'closed').length
  const orgs = taxonomies.organizations.length

  const adminJobs = [...allJobs]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 8)

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <ClipboardList />
          </span>
          <span>
            Sarkari<span className="brand-accent"> Naukari</span>
          </span>
        </Link>
        <span className="admin-label">WORKSPACE</span>
        <Link href="/admin" className="admin-nav active">
          <BriefcaseBusiness /> Overview
        </Link>
        <Link href="/admin/jobs" className="admin-nav">
          <ClipboardList /> Manage jobs
        </Link>
        <Link href="/admin/jobs/new" className="admin-nav">
          <Plus /> Add new job
        </Link>
        <Link href="/admin/automation" className="admin-nav">
          <BriefcaseBusiness /> Automation
        </Link>
        <Link href="/admin/taxonomies" className="admin-nav">
          <Building2 /> Categories & lists
        </Link>
        <Link href="/" className="admin-nav admin-nav-muted">
          <ExternalLink /> View public site
        </Link>
        <div className="admin-user">
          <span className="admin-user-avatar">{user.email?.slice(0, 1).toUpperCase() ?? 'A'}</span>
          <span>
            <strong>{user.email}</strong>
            <small>Administrator</small>
          </span>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <span className="section-kicker">SARKARI NAUKARI / ADMIN</span>
            <h1>Overview</h1>
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
        <div className="admin-stats">
          {[
            [BriefcaseBusiness, 'Total jobs', all],
            [CircleCheck, 'Published', published],
            [FileClock, 'Drafts', drafts],
            [ClipboardList, 'Needs review', pending],
            [BriefcaseBusiness, 'Closed', closed],
            [Building2, 'Organizations', orgs],
          ].map(([Icon, label, value]) => {
            const Symbol = Icon as typeof BriefcaseBusiness
            return (
              <article className="admin-stat" key={label as string}>
                <span>
                  <Symbol />
                </span>
                <small>{label as string}</small>
                <strong>{(value as number | null) ?? 0}</strong>
              </article>
            )
          })}
        </div>
        <section className="admin-table-panel">
          <div className="admin-table-heading">
            <div>
              <h2>Recent jobs</h2>
              <p>Manage recruitment listings and publishing status.</p>
            </div>
            <Link href="/admin/jobs/new" className="text-link">
              Create job <ArrowUpRight />
            </Link>
          </div>
          {adminJobs.length ? (
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Job title</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link href={`/jobs/${job.slug}`} className="table-job-title">
                        {job.title}
                      </Link>
                    </TableCell>
                    <TableCell>{job.organizations?.name ?? '—'}</TableCell>
                    <TableCell>
                      {job.application_end_date
                        ? new Date(`${job.application_end_date}T00:00:00`).toLocaleDateString('en-IN')
                        : 'Not announced'}
                    </TableCell>
                    <TableCell>
                      <span className={`status-pill status-${job.status}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <form action={setJobStatusAction} className="row-actions">
                        <input type="hidden" name="id" value={job.id} />
                        <select
                          name="status"
                          defaultValue={job.status}
                          aria-label={`Set status for ${job.title}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="pending_review">Pending review</option>
                          <option value="published">Published</option>
                          <option value="closed">Closed</option>
                          <option value="archived">Archived</option>
                        </select>
                        <button type="submit">Save</button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="admin-empty">
              <ClipboardList />
              <h3>No jobs yet</h3>
              <p>Add your first recruitment listing as a draft, then verify and publish it.</p>
              <Link href="/admin/jobs/new" className="primary-action">
                <Plus /> Add first job
              </Link>
            </div>
          )}
          <p className="sr-only">Signed in as {user.email}</p>
        </section>
        <p className="admin-footnote">Signed in as {user.email}</p>
      </section>
    </main>
  )
}
