import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { fsGetDoc, getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import { getTaxonomies, type Job } from '@/lib/queries/jobs'
import { updateJobAction } from '@/lib/actions/jobs'

export const metadata = { title: 'Edit a job' }

const date = (value: string | null) => value ?? ''

export default async function EditJob({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/admin/jobs/${id}/edit`)}`)
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin%2Fjobs&error=unauthorized')

  const [job, { categories, states, organizations, qualifications }, { error: formError }] =
    await Promise.all([
      fsGetDoc<Job>('jobs', id, user.idToken),
      getTaxonomies(),
      searchParams,
    ])

  if (!job) notFound()
  const orgName = job.organization_id
    ? (organizations.find((o) => o.id === job.organization_id)?.name ?? '')
    : ''
  const status = job.status

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
        <Link href="/admin/jobs" className="admin-nav">
          <ArrowLeft /> Manage jobs
        </Link>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <span className="section-kicker">RECRUITMENT / EDIT LISTING</span>
            <h1>Edit job</h1>
          </div>
          <Link href="/admin/jobs" className="outline-link">
            Cancel
          </Link>
        </header>
        {formError && (
          <div className="form-alert" role="alert">
            {formError}
          </div>
        )}
        <form action={updateJobAction} className="job-editor">
          <input type="hidden" name="id" value={job.id} />
          <section className="editor-section">
            <span className="section-kicker">01 / BASIC INFORMATION</span>
            <h2>Job details</h2>
            <div className="editor-grid">
              <label className="wide-field">
                Job title
                <input name="title" required minLength={5} maxLength={180} defaultValue={job.title} />
              </label>
              <label>
                URL slug
                <input name="slug" required pattern="[a-z0-9-]+" defaultValue={job.slug} />
              </label>
              <label>
                Organization
                <input name="organization_name" defaultValue={orgName} />
              </label>
              <label>
                Advertisement number
                <input name="advertisement_number" defaultValue={job.advertisement_number ?? ''} />
              </label>
              <label>
                Category
                <select name="category_id" defaultValue={job.category_id ?? ''}>
                  <option value="">No category</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                State
                <select name="state_id" defaultValue={job.state_id ?? ''}>
                  <option value="">All India / unspecified</option>
                  {states.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <input name="location" defaultValue={job.location ?? ''} />
              </label>
              <label>
                Total vacancies
                <input name="total_vacancies" type="number" min="0" defaultValue={job.total_vacancies ?? ''} />
              </label>
              <label className="wide-field">
                Short summary
                <textarea
                  name="short_description"
                  rows={3}
                  maxLength={500}
                  defaultValue={job.short_description ?? ''}
                />
              </label>
              <label className="wide-field">
                Description
                <textarea
                  name="description"
                  rows={5}
                  maxLength={12000}
                  defaultValue={job.description ?? ''}
                />
              </label>
            </div>
          </section>
          <section className="editor-section">
            <span className="section-kicker">02 / IMPORTANT DATES</span>
            <h2>Application timeline</h2>
            <div className="editor-grid">
              {[
                ['application_start_date', 'Application start'],
                ['application_end_date', 'Application deadline'],
                ['fee_payment_last_date', 'Fee payment deadline'],
                ['correction_last_date', 'Correction window'],
                ['preliminary_exam_date', 'Preliminary exam'],
                ['mains_exam_date', 'Mains exam'],
                ['admit_card_date', 'Admit card date'],
                ['result_date', 'Result date'],
              ].map(([name, label]) => (
                <label key={name}>
                  {label}
                  <input
                    name={name}
                    type="date"
                    defaultValue={date((job[name as keyof typeof job] as string | null) ?? null)}
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="editor-section">
            <span className="section-kicker">03 / ELIGIBILITY</span>
            <h2>Candidate requirements</h2>
            <div className="editor-grid">
              <label>
                Minimum age
                <input name="minimum_age" type="number" min="0" defaultValue={job.minimum_age ?? ''} />
              </label>
              <label>
                Maximum age
                <input name="maximum_age" type="number" min="0" defaultValue={job.maximum_age ?? ''} />
              </label>
              <label>
                Age calculation date
                <input name="age_calculation_date" type="date" defaultValue={job.age_calculation_date ?? ''} />
              </label>
              <label>
                Minimum qualification
                <select name="minimum_qualification_id" defaultValue={job.minimum_qualification_id ?? ''}>
                  <option value="">Not specified</option>
                  {qualifications.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Experience
                <input name="experience" defaultValue={job.experience ?? ''} />
              </label>
              <label>
                Age relaxation
                <input name="age_relaxation" defaultValue={job.age_relaxation ?? ''} />
              </label>
              <label className="wide-field">
                Additional eligibility
                <textarea
                  name="additional_eligibility"
                  rows={3}
                  defaultValue={job.additional_eligibility ?? ''}
                />
              </label>
              <label className="wide-field">
                Selection stages
                <textarea
                  name="selection_process"
                  rows={3}
                  defaultValue={JSON.stringify(Array.isArray(job.selection_process) ? job.selection_process : [])}
                />
                <small>JSON list, in order.</small>
              </label>
            </div>
          </section>
          <section className="editor-section">
            <span className="section-kicker">04 / FEES & VACANCIES</span>
            <h2>Breakdowns</h2>
            <div className="editor-grid">
              <label className="wide-field">
                Application fees
                <textarea
                  name="fees_json"
                  rows={4}
                  defaultValue={JSON.stringify(
                    (job.job_fees ?? []).map(({ category_name, amount, currency }) => ({
                      category_name,
                      amount,
                      currency,
                    })),
                  )}
                />
                <small>JSON list with category_name, amount and currency.</small>
              </label>
              <label className="wide-field">
                Vacancy rows
                <textarea
                  name="vacancies_json"
                  rows={5}
                  defaultValue={JSON.stringify(
                    (job.job_vacancies ?? []).map(({ post_name, total_posts, category_breakdown }) => ({
                      post_name,
                      total_posts,
                      category_breakdown,
                    })),
                  )}
                />
                <small>JSON list with post_name, total_posts and category_breakdown.</small>
              </label>
            </div>
          </section>
          <section className="editor-section">
            <span className="section-kicker">05 / OFFICIAL LINKS & REVIEW</span>
            <h2>Application and verification</h2>
            <div className="editor-grid">
              <label>
                Apply URL
                <input type="url" name="apply_url" defaultValue={job.apply_url ?? ''} />
              </label>
              <label>
                Official website
                <input type="url" name="official_website_url" defaultValue={job.official_website_url ?? ''} />
              </label>
              <label>
                English notification
                <input type="url" name="notification_english_url" defaultValue={job.notification_english_url ?? ''} />
              </label>
              <label>
                Hindi notification
                <input type="url" name="notification_hindi_url" defaultValue={job.notification_hindi_url ?? ''} />
              </label>
              <label className="wide-field">
                Source URL
                <input type="url" name="source_url" defaultValue={job.source_url ?? ''} />
              </label>
              <label>
                Source type
                <input name="source_type" defaultValue={job.source_type ?? ''} />
              </label>
              <label className="check-field">
                <span>Feature this listing</span>
                <input name="is_featured" type="checkbox" defaultChecked={job.is_featured} />
              </label>
              <label>
                Verification status
                <select name="verification_status" defaultValue={job.verification_status}>
                  <option value="unverified">Unverified</option>
                  <option value="pending">Pending verification</option>
                  <option value="verified">Verified against official source</option>
                </select>
              </label>
              <label>
                Job status
                <select name="status" defaultValue={status}>
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending review</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
          </section>
          <div className="editor-footer">
            <p>Published jobs must have a verified official source. Changes are written to the audit log.</p>
            <div>
              <button className="primary-action" type="submit">
                <Save /> Save changes
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  )
}
