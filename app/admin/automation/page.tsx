import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Cpu,
  ExternalLink,
  Plus,
} from 'lucide-react'
import { getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import { getAutomationDashboardSnapshot } from '@/app/api/admin/automation/route'
import { AutomationDashboard } from '@/components/admin/automation-dashboard'

export const metadata = { title: 'Automation & Scraping' }
export const dynamic = 'force-dynamic'

export default async function AdminAutomationPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Fadmin%2Fautomation')
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin%2Fautomation&error=unauthorized')

  const snapshot = await getAutomationDashboardSnapshot()

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
        <Link href="/admin" className="admin-nav">
          <BriefcaseBusiness /> Overview
        </Link>
        <Link href="/admin/jobs" className="admin-nav">
          <ClipboardList /> Manage jobs
        </Link>
        <Link href="/admin/jobs/new" className="admin-nav">
          <Plus /> Add new job
        </Link>
        <Link href="/admin/automation" className="admin-nav active">
          <Cpu /> Automation
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
            <span className="section-kicker">AUTOMATION / VERCEL CRON & FIRECRAWL</span>
            <h1>Automated Job Pipeline</h1>
          </div>
          <Link href="/admin/jobs" className="outline-link">
            View jobs
          </Link>
        </header>
        <AutomationDashboard initialSnapshot={snapshot} />
      </section>
    </main>
  )
}
