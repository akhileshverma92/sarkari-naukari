import Link from 'next/link'
import { ArrowUpRight, MapPin, BriefcaseBusiness, CalendarDays, GraduationCap } from 'lucide-react'
import { SaveJobButton } from '@/components/jobs/save-job-button'
import type { Job } from '@/lib/queries/jobs'

function statusLabel(job: Job) {
  if (job.status === 'closed') return 'Closed'
  if (job.application_start_date && new Date(`${job.application_start_date}T00:00:00`) > new Date())
    return 'Opening soon'
  if (job.application_end_date && new Date(`${job.application_end_date}T23:59:59`) < new Date())
    return 'Closed'
  if (job.application_end_date && new Date(job.application_end_date).getTime() - Date.now() < 7 * 86400000)
    return 'Closing soon'
  if (job.published_at && Date.now() - new Date(job.published_at).getTime() < 7 * 86400000)
    return 'New'
  return 'Open'
}

export function JobCard({ job }: { job: Job }) {
  const status = statusLabel(job)
  const isClosed = status === 'Closed'
  const isSoon = status === 'Closing soon' || status === 'Opening soon'

  return (
    <article className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 transition hover:border-stone-300 hover:shadow-sm">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#171717] text-[11px] font-bold text-white"
              aria-hidden="true"
            >
              {job.organizations?.name?.slice(0, 2).toUpperCase() ?? 'IN'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                isClosed
                  ? 'bg-stone-100 text-stone-500'
                  : isSoon
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isClosed ? 'bg-stone-400' : isSoon ? 'bg-amber-600' : 'bg-emerald-600'
                }`}
              />
              {status}
            </span>
          </div>
          <SaveJobButton jobId={job.id} slug={job.slug} />
        </div>

        <Link
          href={`/jobs/${job.slug}`}
          className="mt-3.5 flex items-start justify-between gap-2 text-sm font-bold leading-snug tracking-tight text-[#171717] hover:underline"
        >
          <span className="line-clamp-2">{job.title}</span>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
        </Link>

        <p className="mt-1 text-xs font-medium text-stone-500">
          {job.organizations?.name ?? 'Recruiting authority'}
        </p>

        {job.short_description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600">
            {job.short_description}
          </p>
        )}

        {/* Eye-Catching Key Highlight Pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.total_vacancies != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-[#171717]">
              <BriefcaseBusiness className="h-3 w-3 text-stone-600" aria-hidden="true" />
              {job.total_vacancies.toLocaleString('en-IN')} Posts
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700">
            <MapPin className="h-3 w-3 text-stone-500" aria-hidden="true" />
            {job.states?.name ?? job.location ?? 'India'}
          </span>
          {job.qualifications?.name && (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700">
              <GraduationCap className="h-3 w-3 text-stone-500" aria-hidden="true" />
              {job.qualifications.name}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3.5 text-[11px]">
        <span
          className={`inline-flex items-center gap-1.5 font-semibold ${
            isSoon ? 'text-amber-800' : isClosed ? 'text-stone-400' : 'text-stone-700'
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {job.application_end_date
            ? `Last date: ${new Date(`${job.application_end_date}T00:00:00`).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}`
            : 'Deadline TBA'}
        </span>
        <Link
          href={`/jobs/${job.slug}`}
          className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#171717] transition hover:bg-stone-100"
        >
          Details
        </Link>
        {job.apply_url && !isClosed ? (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-stone-800"
          >
            Apply <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <Link
            href={`/jobs/${job.slug}`}
            className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-stone-800"
          >
            View <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  )
}
