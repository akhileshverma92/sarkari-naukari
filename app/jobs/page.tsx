import Link from 'next/link'
import { Search, ArrowRight, X } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { JobCard } from '@/components/jobs/job-card'
import { JobSearch } from '@/components/jobs/job-search'
import { JobFilters } from '@/components/jobs/job-filters'
import { getJobs, getTaxonomies } from '@/lib/queries/jobs'

type Params = Promise<{
  q?: string
  state?: string
  category?: string
  organization?: string
  qualification?: string
  status?: string
  deadline?: string
  page?: string
}>

export const metadata = {
  title: 'Latest Government Jobs',
  description: 'Search current government recruitment openings by state, organization and category.',
}

export default async function JobsPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams
  const [result, taxonomies] = await Promise.all([
    getJobs({
      search: params.q,
      state: params.state,
      category: params.category,
      organization: params.organization,
      qualification: params.qualification,
      status: params.status,
      deadline: params.deadline,
      page: Number(params.page) || 1,
      limit: 9,
    }),
    getTaxonomies(),
  ])

  const active = Object.entries({
    q: params.q,
    state: params.state,
    category: params.category,
    organization: params.organization,
    qualification: params.qualification,
    status: params.status,
    deadline: params.deadline,
  }).filter(([, v]) => Boolean(v))

  const filterOnlyCount = active.filter(([k]) => k !== 'q').length
  const pages = Math.max(1, Math.ceil(result.count / 9))
  const current = Math.max(1, Number(params.page) || 1)

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-[#171717]">
      <SiteHeader />

      <main className="mx-auto max-w-[1160px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <Link href="/" className="hover:text-[#171717]">Home</Link>
            <span>/</span>
            <span className="text-stone-700">Latest jobs</span>
          </div>
          <span className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            OPPORTUNITY BOARD
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">
            Government jobs
          </h1>
          <p className="mt-1 text-xs text-stone-600 sm:text-sm">
            Search and filter current recruitment opportunities from across India.
          </p>

          <div className="mt-4">
            <JobSearch initialValue={params.q ?? ''} />
          </div>

          <JobFilters
            taxonomies={taxonomies}
            current={params}
            activeCount={filterOnlyCount}
          />
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between text-xs text-stone-500">
            <span>
              <strong className="text-[#171717]">{result.count}</strong>{' '}
              {result.count === 1 ? 'opportunity' : 'opportunities'} found
            </span>
            <span>Newest first</span>
          </div>

          {active.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {active.map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-700"
                >
                  {key === 'q' ? 'Search' : key}: {value}
                  <Link
                    href={`/jobs?${new URLSearchParams(
                      Object.fromEntries(active.filter(([k]) => k !== key) as [string, string][]),
                    )}`}
                    aria-label={`Remove ${key} filter`}
                    className="text-stone-400 hover:text-[#171717]"
                  >
                    <X className="h-3 w-3" />
                  </Link>
                </span>
              ))}
            </div>
          )}

          {result.error ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
              <h3 className="text-sm font-bold text-[#171717]">Couldn&apos;t load opportunities</h3>
              <p className="mt-1 text-xs text-stone-500">Please refresh in a moment.</p>
            </div>
          ) : result.jobs.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.jobs.map((job) => (
                <JobCard job={job} key={job.id} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <Search className="mx-auto h-7 w-7 text-stone-400" />
              <h3 className="mt-3 text-sm font-bold text-[#171717]">No matching jobs found</h3>
              <p className="mt-1 text-xs text-stone-500">
                Try another search or clear a filter to see more opportunities.
              </p>
              <Link
                href="/jobs"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#171717] px-4 py-2 text-xs font-semibold text-white"
              >
                Clear filters <X className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <nav
            className="mt-6 flex items-center justify-between text-xs text-stone-500"
            aria-label="Pagination"
          >
            <span>
              Page {current} of {pages}
            </span>
            <div className="flex gap-2">
              {current > 1 && (
                <Link
                  href={`/jobs?${new URLSearchParams({
                    ...Object.fromEntries(active as [string, string][]),
                    page: String(current - 1),
                  })}`}
                  className="rounded-full border border-stone-200 bg-white px-4 py-1.5 font-semibold text-[#171717] hover:bg-stone-100"
                >
                  Previous
                </Link>
              )}
              {current < pages && (
                <Link
                  href={`/jobs?${new URLSearchParams({
                    ...Object.fromEntries(active as [string, string][]),
                    page: String(current + 1),
                  })}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-4 py-1.5 font-semibold text-white hover:bg-stone-800"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </nav>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
