import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, MapPinned, GraduationCap, Tags, ArrowLeft, Plus } from 'lucide-react'
import { getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import { getTaxonomies } from '@/lib/queries/jobs'
import { createTaxonomyAction } from '@/lib/actions/taxonomies'

export const metadata = { title: 'Manage taxonomies' }

export default async function TaxonomyManager({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Fadmin%2Ftaxonomies')
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin%2Ftaxonomies&error=unauthorized')

  const [taxonomies, params] = await Promise.all([getTaxonomies(), searchParams])

  const groups = [
    { kind: 'organizations', title: 'Organizations', items: taxonomies.organizations, icon: Building2 },
    { kind: 'states', title: 'States', items: taxonomies.states, icon: MapPinned },
    { kind: 'job_categories', title: 'Job categories', items: taxonomies.categories, icon: Tags },
    { kind: 'qualifications', title: 'Qualifications', items: taxonomies.qualifications, icon: GraduationCap },
  ]

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
          <ArrowLeft /> Overview
        </Link>
        <Link href="/admin/jobs" className="admin-nav">
          Manage jobs
        </Link>
        <Link href="/admin/taxonomies" className="admin-nav active">
          Categories & lists
        </Link>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <span className="section-kicker">CONTENT / DIRECTORY DATA</span>
            <h1>Categories & lists</h1>
          </div>
        </header>
        <p className="admin-intro">
          Add the shared names used by job listings and public filters. Existing taxonomy rows are
          shown below.
        </p>
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
        <section className="taxonomy-form-panel">
          <h2>Add a directory item</h2>
          <form action={createTaxonomyAction} className="taxonomy-form">
            <label>
              Type
              <select name="kind" defaultValue="job_categories">
                <option value="job_categories">Job category</option>
                <option value="organizations">Organization</option>
                <option value="states">State</option>
                <option value="qualifications">Qualification</option>
              </select>
            </label>
            <label>
              Name
              <input name="name" required minLength={2} maxLength={180} placeholder="e.g. Railway Recruitment Board" />
            </label>
            <label>
              Slug
              <input name="slug" required pattern="[a-z0-9-]+" placeholder="railway-recruitment-board" />
            </label>
            <label>
              Website URL
              <input type="url" name="website_url" placeholder="https:// (organizations only)" />
            </label>
            <label>
              Organization type
              <input name="organization_type" placeholder="Recruitment board (organizations only)" />
            </label>
            <label className="taxonomy-description">
              Description
              <input name="description" maxLength={1000} placeholder="Optional, organizations only" />
            </label>
            <button className="primary-action" type="submit">
              <Plus /> Add directory item
            </button>
          </form>
        </section>
        <div className="taxonomy-grid">
          {groups.map(({ kind, title, items, icon: Icon }) => (
            <section className="taxonomy-card" key={kind}>
              <header>
                <span>
                  <Icon />
                  <strong>{title}</strong>
                </span>
                <small>{items.length} entries</small>
              </header>
              {items.length ? (
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <span>{item.name}</span>
                      <code>{item.slug}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No items yet. Add the first one above.</p>
              )}
            </section>
          ))}
        </div>
        <p className="admin-footnote">Signed in as {user.email}</p>
      </section>
    </main>
  )
}
