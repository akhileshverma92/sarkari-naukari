import { fsListDocs, fsQueryPublicJobs } from '@/lib/firebase/server'

export type TaxonomyItem = {
  id: string
  name: string
  slug: string
  website_url?: string | null
  organization_type?: string | null
  description?: string | null
}

export type JobFee = {
  id: string
  category_name: string
  amount: number | null
  currency: string
}

export type JobVacancy = {
  id: string
  post_name: string
  total_posts: number | null
  category_breakdown: Record<string, number>
}

export type Job = {
  id: string
  title: string
  slug: string
  organization_id?: string | null
  category_id?: string | null
  state_id?: string | null
  advertisement_number: string | null
  short_description: string | null
  description: string | null
  total_vacancies: number | null
  location: string | null
  status: string
  is_featured: boolean
  published_at: string | null
  created_at: string
  application_start_date: string | null
  application_end_date: string | null
  apply_url: string | null
  notification_english_url: string | null
  notification_hindi_url: string | null
  official_website_url: string | null
  source_url: string | null
  source_type: string | null
  verification_status: string
  minimum_age: number | null
  maximum_age: number | null
  age_calculation_date: string | null
  minimum_qualification_id: string | null
  experience: string | null
  additional_eligibility: string | null
  age_relaxation: string | null
  updated_at: string
  selection_process: unknown[]
  fee_payment_last_date: string | null
  correction_last_date: string | null
  preliminary_exam_date: string | null
  mains_exam_date: string | null
  admit_card_date: string | null
  result_date: string | null
  job_fees?: JobFee[]
  job_vacancies?: JobVacancy[]
  organizations?: { name: string; slug: string } | null
  states?: { name: string; slug: string } | null
  job_categories?: { name: string; slug: string } | null
  qualifications?: { name: string; slug: string } | null
}

type RawJob = Omit<Job, 'organizations' | 'states' | 'job_categories' | 'qualifications'>

export async function getTaxonomies() {
  const [states, categories, organizations, qualifications] = await Promise.all([
    fsListDocs<TaxonomyItem>('states'),
    fsListDocs<TaxonomyItem>('job_categories'),
    fsListDocs<TaxonomyItem>('organizations'),
    fsListDocs<TaxonomyItem>('qualifications'),
  ])

  const byName = (a: TaxonomyItem, b: TaxonomyItem) => (a.name ?? '').localeCompare(b.name ?? '')
  return {
    states: states.sort(byName),
    categories: categories.sort(byName),
    organizations: organizations.sort(byName),
    qualifications: qualifications.sort(byName),
  }
}

export function hydrateJobs(
  rawJobs: RawJob[],
  taxonomies: Awaited<ReturnType<typeof getTaxonomies>>,
): Job[] {
  const orgMap = new Map(taxonomies.organizations.map((o) => [o.id, { name: o.name, slug: o.slug }]))
  const stateMap = new Map(taxonomies.states.map((s) => [s.id, { name: s.name, slug: s.slug }]))
  const catMap = new Map(taxonomies.categories.map((c) => [c.id, { name: c.name, slug: c.slug }]))
  const qualMap = new Map(taxonomies.qualifications.map((q) => [q.id, { name: q.name, slug: q.slug }]))

  return rawJobs.map((job) => ({
    ...job,
    organizations: job.organization_id ? (orgMap.get(job.organization_id) ?? null) : null,
    states: job.state_id ? (stateMap.get(job.state_id) ?? null) : null,
    job_categories: job.category_id ? (catMap.get(job.category_id) ?? null) : null,
    qualifications: job.minimum_qualification_id ? (qualMap.get(job.minimum_qualification_id) ?? null) : null,
  }))
}

export async function getAllHydratedJobs(idToken?: string): Promise<Job[]> {
  const [rawJobs, taxonomies] = await Promise.all([
    idToken ? fsListDocs<RawJob>('jobs', idToken) : fsQueryPublicJobs<RawJob>(),
    getTaxonomies(),
  ])
  return hydrateJobs(rawJobs, taxonomies)
}

export async function getJobs(
  options: {
    search?: string
    state?: string
    category?: string
    qualification?: string
    organization?: string
    status?: string
    deadline?: string
    page?: number
    limit?: number
    admin?: boolean
    idToken?: string
  } = {},
) {
  try {
    let jobs = await getAllHydratedJobs(options.idToken)

    if (!options.admin) {
      jobs = jobs.filter((job) => job.status === 'published' || job.status === 'closed')
    }

    const term = options.search?.trim().toLowerCase()
    if (term) {
      jobs = jobs.filter((job) => {
        const haystack = [
          job.title,
          job.advertisement_number,
          job.short_description,
          job.description,
          job.organizations?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
    }

    if (options.status && !['open', 'closed'].includes(options.status)) {
      jobs = jobs.filter((job) => job.status === options.status)
    }
    if (options.category) jobs = jobs.filter((job) => job.category_id === options.category)
    if (options.state) jobs = jobs.filter((job) => job.state_id === options.state)
    if (options.organization) jobs = jobs.filter((job) => job.organization_id === options.organization)
    if (options.qualification) jobs = jobs.filter((job) => job.minimum_qualification_id === options.qualification)

    const today = new Date().toISOString().slice(0, 10)
    if (options.status === 'open') {
      jobs = jobs.filter(
        (job) =>
          job.status === 'published' &&
          (!job.application_start_date || job.application_start_date <= today) &&
          (!job.application_end_date || job.application_end_date >= today),
      )
    }
    if (options.status === 'closed') {
      jobs = jobs.filter(
        (job) =>
          job.status === 'closed' ||
          (job.status === 'published' && Boolean(job.application_end_date && job.application_end_date < today)),
      )
    }
    if (options.deadline === '7') {
      const limitDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      jobs = jobs.filter(
        (job) =>
          Boolean(job.application_end_date) &&
          job.application_end_date! >= today &&
          job.application_end_date! <= limitDate,
      )
    }
    if (options.deadline === '30') {
      const limitDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      jobs = jobs.filter(
        (job) =>
          Boolean(job.application_end_date) &&
          job.application_end_date! >= today &&
          job.application_end_date! <= limitDate,
      )
    }
    if (options.deadline === 'expired') {
      jobs = jobs.filter((job) => Boolean(job.application_end_date) && job.application_end_date! < today)
    }

    jobs.sort((a, b) => {
      const aDate = a.published_at ?? a.created_at ?? ''
      const bDate = b.published_at ?? b.created_at ?? ''
      return bDate.localeCompare(aDate)
    })

    const page = Math.max(1, options.page ?? 1)
    const limit = options.limit ?? 10
    const count = jobs.length
    const paginated = jobs.slice((page - 1) * limit, page * limit)

    return { jobs: paginated, count, error: null }
  } catch (error) {
    return {
      jobs: [] as Job[],
      count: 0,
      error: error instanceof Error ? error.message : 'Could not load jobs',
    }
  }
}

export async function getJobBySlug(slug: string) {
  const jobs = await getAllHydratedJobs()
  const job = jobs.find(
    (item) => item.slug === slug && (item.status === 'published' || item.status === 'closed'),
  )
  if (!job) return null
  return {
    ...job,
    job_fees: job.job_fees ?? [],
    job_vacancies: job.job_vacancies ?? [],
  }
}

export async function getDatedJobs(
  field: 'admit_card_date' | 'result_date' | 'preliminary_exam_date',
  limit = 3,
) {
  const jobs = await getAllHydratedJobs()
  return jobs
    .filter((job) => (job.status === 'published' || job.status === 'closed') && Boolean(job[field]))
    .sort((a, b) => {
      const av = a[field] ?? ''
      const bv = b[field] ?? ''
      return field === 'preliminary_exam_date' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    .slice(0, limit)
}

export async function getRecentlyUpdatedJobs(limit = 3) {
  const jobs = await getAllHydratedJobs()
  return jobs
    .filter((job) => job.status === 'published' || job.status === 'closed')
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .slice(0, limit)
}
