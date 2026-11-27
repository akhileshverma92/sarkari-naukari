import Link from 'next/link'
import { ArrowUpRight, Search, Sparkles, Bookmark } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { JobCard } from '@/components/jobs/job-card'
import { getJobs, getTaxonomies } from '@/lib/queries/jobs'

export default async function HomePage() {
  const [{ jobs }, taxonomies] = await Promise.all([
    getJobs({ limit: 9 }),
    getTaxonomies(),
  ])

  const sections = [
    {
      kicker: 'SECTION 01',
      title: 'What’s open right now?',
      description:
        'Browse newly published government recruitment notices with verified deadlines, vacancy counts, and official apply links.',
      href: '/jobs',
    },
    {
      kicker: 'SECTION 02',
      title: 'Bookmark without signing in',
      description:
        'Save any recruitment notice directly in your browser shortlist so you can review eligibility and apply later.',
      href: '/saved-jobs',
    },
  ]

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-[#171717]">
      <SiteHeader />

      <main className="mx-auto max-w-[1160px] space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        {/* Compact Editorial Hero */}
        <section className="rounded-3xl border border-stone-200/80 bg-[#fbfbfa] px-5 py-8 text-center shadow-2xs sm:px-10 sm:py-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            India&apos;s Government Jobs Portal
          </p>

          <h1 className="mx-auto mt-3 max-w-2xl text-2xl font-bold tracking-tight text-[#171717] sm:text-4xl sm:leading-[1.12]">
            Find your next government job, fast.
          </h1>

          <p className="mx-auto mt-2.5 max-w-xl text-xs leading-relaxed text-stone-600 sm:text-sm">
            Verified recruitment vacancies, official deadlines, and direct application links across
            central &amp; state authorities.
          </p>

          {/* Search Pill */}
          <form
            action="/jobs"
            className="mx-auto mt-5 flex max-w-lg items-center gap-2 rounded-full border border-stone-200 bg-white p-1.5 shadow-xs focus-within:border-stone-400"
          >
            <Search className="ml-3 h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
            <input
              type="search"
              name="q"
              aria-label="Search government jobs"
              placeholder="Search UPSC, SSC, Railway, UPPSC..."
              className="min-w-0 flex-1 bg-transparent text-xs text-[#171717] placeholder:text-stone-400 focus:outline-none sm:text-sm"
            />
            <button
              type="submit"
              className="rounded-full bg-[#171717] px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
            >
              Search
            </button>
          </form>

          {/* Quick Highlight Pills */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#171717] px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Explore all jobs
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/saved-jobs"
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#171717] transition hover:bg-stone-100"
            >
              <Bookmark className="h-3.5 w-3.5 text-stone-500" /> Saved jobs
            </Link>
          </div>
        </section>

        {/* FIRST VIEW: Fresh Government Jobs */}
        <section className="rounded-3xl border border-stone-200/80 bg-[#fbfbfa] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                FRESH RECRUITMENT
              </span>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[#171717] sm:text-2xl">
                Latest government openings
              </h2>
            </div>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs font-semibold text-[#171717] transition hover:bg-stone-100"
            >
              View all jobs <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {jobs.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.slice(0, 6).map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-[#171717]">No published jobs yet</p>
              <p className="mt-1 text-xs text-stone-500">
                Published recruitment notices will appear here automatically.
              </p>
            </div>
          )}
        </section>

        {/* Browse by State & Qualification */}
        {(taxonomies.states.length > 0 || taxonomies.qualifications.length > 0) && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                BY REGION
              </span>
              <h3 className="mt-1 text-base font-bold text-[#171717]">State-wise jobs</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {taxonomies.states.slice(0, 10).map((state) => (
                  <Link
                    key={state.id}
                    href={`/state/${state.slug}`}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-[#171717]"
                  >
                    {state.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                BY EDUCATION
              </span>
              <h3 className="mt-1 text-base font-bold text-[#171717]">Qualification-wise jobs</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {taxonomies.qualifications.slice(0, 10).map((q) => (
                  <Link
                    key={q.id}
                    href={`/qualification/${q.slug}`}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-[#171717]"
                  >
                    {q.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Bottom Informational Sections */}
        <section aria-label="Portal guide" className="grid gap-4 md:grid-cols-2">
          {sections.map((item) => (
            <Link
              key={item.kicker}
              href={item.href}
              className="group rounded-2xl border border-stone-200/80 bg-[#fbfbfa] p-6 transition hover:border-stone-300 hover:bg-white"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                {item.kicker}
              </span>
              <h2 className="mt-2 flex items-center justify-between gap-2 text-lg font-bold tracking-tight text-[#171717]">
                <span>{item.title}</span>
                <ArrowUpRight className="h-4 w-4 text-stone-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#171717]" />
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-stone-600 sm:text-[13px]">
                {item.description}
              </p>
            </Link>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
