import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  BriefcaseBusiness,
  FileText,
  ExternalLink,
  GraduationCap,
  Users,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { SaveJobButton } from '@/components/jobs/save-job-button'
import { AiSummarizeJob } from '@/components/jobs/ai-summarize-button'
import { ShareJobCard } from '@/components/jobs/share-job-card'
import { SiteFooter } from '@/components/layout/site-footer'
import type { Job, JobFee, JobVacancy } from '@/lib/queries/jobs'

export type JobDetailData = Job & {
  job_fees?: JobFee[]
  job_vacancies?: JobVacancy[]
}

const formatDateLong = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Not announced'

const formatDateShort = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'TBA'

export function JobDetailView({
  job,
  relatedJobs = [],
  isPreview = false,
  onExitPreview,
}: {
  job: JobDetailData
  relatedJobs?: Job[]
  isPreview?: boolean
  onExitPreview?: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const expired =
    job.status === 'closed' ||
    Boolean(job.application_end_date && job.application_end_date < today)
  const openingSoon =
    !expired && Boolean(job.application_start_date && job.application_start_date > today)
  const status = expired
    ? 'Applications closed'
    : openingSoon
      ? 'Opening soon'
      : 'Applications open'

  const dateRows: Array<[string, string, boolean?]> = [
    ['Application start', formatDateLong(job.application_start_date)],
    ['Last date to apply', formatDateLong(job.application_end_date), true],
    ['Fee payment deadline', formatDateLong(job.fee_payment_last_date)],
    ['Correction deadline', formatDateLong(job.correction_last_date)],
    ['Preliminary exam', job.preliminary_exam_date ? formatDateLong(job.preliminary_exam_date) : 'Notify later'],
    ['Mains exam', job.mains_exam_date ? formatDateLong(job.mains_exam_date) : 'Notify later'],
    ['Admit card', job.admit_card_date ? formatDateLong(job.admit_card_date) : 'Before exam'],
    ['Result date', job.result_date ? formatDateLong(job.result_date) : 'Will be updated'],
  ]

  const officialLinks = [
    ['Apply online', job.apply_url, true],
    ['Notification (English)', job.notification_english_url, false],
    ['Notification (Hindi)', job.notification_hindi_url, false],
    ['Official website', job.official_website_url, false],
  ].filter(([, url]) => Boolean(url)) as Array<[string, string, boolean]>

  const ageRange =
    job.minimum_age != null && job.maximum_age != null
      ? `${job.minimum_age}–${job.maximum_age} yrs`
      : job.minimum_age != null
        ? `Min ${job.minimum_age} yrs`
        : job.maximum_age != null
          ? `Max ${job.maximum_age} yrs`
          : 'See notice'

  const updatedDateStr = new Date(job.updated_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const daysLeft =
    !expired && job.application_end_date
      ? Math.ceil(
          (new Date(`${job.application_end_date}T23:59:59`).getTime() - Date.now()) / 86400000,
        )
      : null

  return (
    <div className="min-h-screen bg-[#f6f6f3] pb-20 text-[#171717] md:pb-0">
      <main className="mx-auto max-w-[1160px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Top Navigation Row */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            {isPreview ? (
              <>
                <span className="font-semibold text-[#171717]">Preview</span>
                <span>/</span>
                <span className="truncate font-medium text-stone-700">{job.title}</span>
              </>
            ) : (
              <>
                <Link href="/jobs" className="inline-flex items-center gap-1.5 font-medium hover:text-[#171717]">
                  <ArrowLeft className="h-3.5 w-3.5" /> All jobs
                </Link>
                <span>/</span>
                <span className="line-clamp-1 text-stone-700">{job.title}</span>
              </>
            )}
          </div>
          {isPreview && onExitPreview && (
            <button
              type="button"
              onClick={onExitPreview}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-stone-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to editor
            </button>
          )}
        </div>

        {/* Hero Summary Card */}
        <section className="rounded-3xl border border-stone-200/80 bg-[#fbfbfa] p-5 shadow-2xs sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    expired
                      ? 'bg-stone-200 text-stone-700'
                      : openingSoon
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      expired ? 'bg-stone-500' : openingSoon ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                  />
                  {status}
                </span>
                {job.verification_status === 'verified' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-700">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Official source checked
                  </span>
                )}
                {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900">
                    {daysLeft === 0 ? 'Last date today' : `${daysLeft}d left to apply`}
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">
                {job.title || 'Untitled recruitment'}
              </h1>

              <p className="mt-1.5 text-xs text-stone-600 sm:text-sm">
                {job.organizations?.name ?? 'Government Recruiting Authority'}
                {job.advertisement_number ? ` · Advt. No. ${job.advertisement_number}` : ''}
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {job.apply_url && !expired && !openingSoon && (
                <a
                  href={job.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#171717] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-stone-800 sm:flex-none"
                >
                  Apply Now <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
              {!isPreview && <AiSummarizeJob slug={job.slug} />}
              {!isPreview && <SaveJobButton jobId={job.id} slug={job.slug} />}
            </div>
          </div>

          {/* 5-Column Responsive KPI Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-stone-200/70 bg-white p-3.5">
              <small className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> Vacancies
              </small>
              <strong className="mt-1.5 block text-sm font-bold text-[#171717]">
                {job.total_vacancies?.toLocaleString('en-IN') ?? 'TBA'}
              </strong>
            </div>
            <div className="rounded-2xl border border-stone-200/70 bg-white p-3.5">
              <small className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <CalendarDays className="h-3.5 w-3.5" /> Starts
              </small>
              <strong className="mt-1.5 block text-sm font-bold text-[#171717]">
                {formatDateShort(job.application_start_date)}
              </strong>
            </div>
            <div className="rounded-2xl border border-stone-200/70 bg-white p-3.5">
              <small className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <CalendarDays className="h-3.5 w-3.5" /> Deadline
              </small>
              <strong className="mt-1.5 block text-sm font-bold text-[#171717]">
                {formatDateShort(job.application_end_date)}
              </strong>
            </div>
            <div className="rounded-2xl border border-stone-200/70 bg-white p-3.5">
              <small className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <GraduationCap className="h-3.5 w-3.5" /> Qualification
              </small>
              <strong className="mt-1.5 block truncate text-sm font-bold text-[#171717]">
                {job.qualifications?.name ?? 'See notice'}
              </strong>
            </div>
            <div className="col-span-2 rounded-2xl border border-stone-200/70 bg-white p-3.5 sm:col-span-1">
              <small className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <Users className="h-3.5 w-3.5" /> Age limit
              </small>
              <strong className="mt-1.5 block text-sm font-bold text-[#171717]">{ageRange}</strong>
            </div>
          </div>

          {/* Secondary Official Links Bar */}
          {officialLinks.filter(([, , isPrimary]) => !isPrimary).length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {job.notification_english_url && (
                <a
                  href={job.notification_english_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#171717] transition hover:bg-stone-100"
                >
                  <FileText className="h-3.5 w-3.5" /> Notification (EN)
                </a>
              )}
              {job.notification_hindi_url && (
                <a
                  href={job.notification_hindi_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#171717] transition hover:bg-stone-100"
                >
                  <FileText className="h-3.5 w-3.5" /> Notification (HI)
                </a>
              )}
              {job.official_website_url && (
                <a
                  href={job.official_website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#171717] transition hover:bg-stone-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Official site
                </a>
              )}
            </div>
          )}
        </section>

        {/* Main 2-Column Layout */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-start">
          {/* Left Column */}
          <div className="space-y-5">
            {(job.short_description || job.description) && (
              <section className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5 sm:p-6">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  OVERVIEW
                </span>
                {job.short_description && (
                  <p className="mt-2 text-sm font-medium leading-relaxed text-[#171717]">
                    {job.short_description}
                  </p>
                )}
                {job.description && (
                  <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-stone-600 sm:text-[13px]">
                    {job.description}
                  </p>
                )}
              </section>
            )}

            {/* Important Dates & Application Fee */}
            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  SECTION 01
                </span>
                <h2 className="mt-1 text-base font-bold text-[#171717]">Important dates</h2>
                <div className="mt-3 divide-y divide-stone-200/60">
                  {dateRows.map(([label, value, highlight]) => (
                    <div key={label} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="text-stone-500">{label}</span>
                      <strong className={`text-right ${highlight ? 'text-[#171717]' : 'font-semibold text-stone-800'}`}>
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  SECTION 02
                </span>
                <h2 className="mt-1 text-base font-bold text-[#171717]">Application fee</h2>
                <div className="mt-3 text-xs text-stone-600">
                  {(job.job_fees?.length ?? 0) > 0 ? (
                    <ul className="divide-y divide-stone-200/60">
                      {job.job_fees!.map((fee) => (
                        <li key={fee.id} className="flex items-center justify-between py-2">
                          <span>{fee.category_name}</span>
                          <strong className="text-[#171717]">
                            {fee.amount == null
                              ? 'Not announced'
                              : `${fee.currency === 'INR' ? '₹' : fee.currency} ${Number(fee.amount).toLocaleString('en-IN')}`}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-stone-500">
                      Refer to the official notification for category-wise application fees.
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Vacancy Details & Eligibility */}
            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  SECTION 03
                </span>
                <h2 className="mt-1 text-base font-bold text-[#171717]">Vacancy details</h2>
                <div className="mt-3">
                  {(job.job_vacancies?.length ?? 0) > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-stone-200/80 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-stone-100 text-[11px] font-semibold text-stone-500">
                          <tr>
                            <th className="px-3 py-2">Post</th>
                            <th className="px-3 py-2 text-right">Posts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {job.job_vacancies!.map((vac) => (
                            <tr key={vac.id}>
                              <td className="px-3 py-2 font-semibold text-[#171717]">
                                {vac.post_name}
                                {Object.keys(vac.category_breakdown ?? {}).length > 0 && (
                                  <span className="mt-0.5 block text-[10px] font-normal text-stone-500">
                                    {Object.entries(vac.category_breakdown)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(' · ')}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-[#171717]">
                                {vac.total_posts?.toLocaleString('en-IN') ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white px-3.5 py-2.5 text-xs">
                      <span className="text-stone-600">Total vacancies</span>
                      <strong className="text-[#171717]">
                        {job.total_vacancies?.toLocaleString('en-IN') ?? 'Not announced'}
                      </strong>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  SECTION 04
                </span>
                <h2 className="mt-1 text-base font-bold text-[#171717]">Eligibility & age</h2>
                <div className="mt-3 space-y-2 text-xs text-stone-600">
                  <div className="flex justify-between border-b border-stone-200/60 pb-2">
                    <span>Age limit</span>
                    <strong className="text-[#171717]">{ageRange}</strong>
                  </div>
                  {job.qualifications?.name && (
                    <div className="flex justify-between border-b border-stone-200/60 pb-2">
                      <span>Qualification</span>
                      <strong className="text-[#171717]">{job.qualifications.name}</strong>
                    </div>
                  )}
                  {job.experience && (
                    <p>
                      <strong className="text-[#171717]">Experience:</strong> {job.experience}
                    </p>
                  )}
                  {job.age_relaxation && (
                    <p>
                      <strong className="text-[#171717]">Age relaxation:</strong> {job.age_relaxation}
                    </p>
                  )}
                  {job.additional_eligibility && (
                    <p className="whitespace-pre-line leading-relaxed">{job.additional_eligibility}</p>
                  )}
                </div>
              </section>
            </div>

            {/* Selection Process */}
            {Array.isArray(job.selection_process) && job.selection_process.length > 0 && (
              <section className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  SELECTION PROCESS
                </span>
                <h2 className="mt-1 text-base font-bold text-[#171717]">Stages</h2>
                <ol className="mt-3 flex flex-wrap gap-2.5">
                  {job.selection_process.map((stage, idx) => (
                    <li
                      key={idx}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-[#171717]"
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#171717] text-[10px] font-bold text-white">
                        {idx + 1}
                      </span>
                      {String(stage)}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* How to Apply */}
            <section className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                HOW TO APPLY
              </span>
              <ol className="mt-3 space-y-2.5 text-xs text-stone-600">
                {[
                  `Open the official portal${job.official_website_url ? ` (${job.official_website_url})` : ''} and read the notification.`,
                  'Complete registration and fill in personal and educational details.',
                  'Upload documents, pay the application fee, and save the confirmation.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#171717]" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-5">
            <div className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                IMPORTANT LINKS
              </span>
              <div className="mt-3 space-y-2">
                {officialLinks.length > 0 ? (
                  officialLinks.map(([label, url, isPrimary]) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-between rounded-full px-4 py-2.5 text-xs font-semibold transition ${
                        isPrimary
                          ? 'bg-[#171717] text-white hover:bg-stone-800'
                          : 'border border-stone-200 bg-white text-[#171717] hover:bg-stone-100'
                      }`}
                    >
                      <span>{label}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))
                ) : (
                  <p className="text-xs text-stone-500">Official links not yet provided.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                HIGHLIGHTS
              </span>
              <div className="mt-3 divide-y divide-stone-200/60">
                <div className="flex justify-between gap-2 py-2">
                  <span className="text-stone-500">Organization</span>
                  <strong className="text-right text-[#171717]">
                    {job.organizations?.name ?? 'TBA'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2 py-2">
                  <span className="text-stone-500">Location</span>
                  <strong className="text-right text-[#171717]">
                    {job.states?.name ?? job.location ?? 'India'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2 py-2">
                  <span className="text-stone-500">Last updated</span>
                  <strong className="text-right text-[#171717]">{updatedDateStr}</strong>
                </div>
              </div>
            </div>

            {relatedJobs.length > 0 && (
              <div className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  MORE OPENINGS
                </span>
                <ul className="mt-3 divide-y divide-stone-200/60 text-xs">
                  {relatedJobs.map((rel) => (
                    <li key={rel.id} className="py-2 first:pt-0 last:pb-0">
                      <Link
                        href={`/jobs/${rel.slug}`}
                        className="font-semibold text-[#171717] hover:underline"
                      >
                        {rel.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ShareJobCard title={job.title} slug={job.slug} />
          </aside>
        </div>
      </main>

      {!isPreview && <SiteFooter />}

      {/* Sticky Mobile Apply Bar */}
      {!isPreview && job.apply_url && !expired && !openingSoon && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-stone-200 bg-[#fbfbfa]/95 px-4 py-3 backdrop-blur-md md:hidden">
          <SaveJobButton jobId={job.id} slug={job.slug} />
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#171717] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-stone-800"
          >
            Apply Now <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  )
}
