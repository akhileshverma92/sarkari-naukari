'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  fsCreateDoc,
  fsDeleteDoc,
  fsGetDoc,
  fsListDocs,
  fsUpdateDoc,
  getCurrentUser,
  isAdminUser,
} from '@/lib/firebase/server'
import type { JobFee, JobVacancy, TaxonomyItem } from '@/lib/queries/jobs'

const optionalNumber = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.coerce.number().int().nonnegative().optional(),
)
const webUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Use a secure HTTP or HTTPS link')
  .optional()
  .or(z.literal(''))

const jobSchema = z.object({
  title: z.string().trim().min(5, 'Enter a job title').max(180),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(180)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens'),
  short_description: z.string().trim().max(500).optional(),
  description: z.string().trim().max(12000).optional(),
  organization_name: z.string().trim().max(180).optional(),
  advertisement_number: z.string().trim().max(100).optional(),
  location: z.string().trim().max(120).optional(),
  category_id: z.string().trim().optional().or(z.literal('')),
  state_id: z.string().trim().optional().or(z.literal('')),
  minimum_qualification_id: z.string().trim().optional().or(z.literal('')),
  total_vacancies: optionalNumber,
  minimum_age: optionalNumber,
  maximum_age: optionalNumber,
  age_calculation_date: z.string().optional(),
  is_featured: z.preprocess((value) => value === 'on' || value === 'true', z.boolean()).optional(),
  source_type: z.string().trim().max(100).optional(),
  experience: z.string().trim().max(500).optional(),
  additional_eligibility: z.string().trim().max(4000).optional(),
  age_relaxation: z.string().trim().max(1000).optional(),
  selection_process: z.string().optional(),
  fees_json: z.string().max(5000).optional(),
  vacancies_json: z.string().max(10000).optional(),
  application_start_date: z.string().optional(),
  application_end_date: z.string().optional(),
  fee_payment_last_date: z.string().optional(),
  correction_last_date: z.string().optional(),
  preliminary_exam_date: z.string().optional(),
  mains_exam_date: z.string().optional(),
  admit_card_date: z.string().optional(),
  result_date: z.string().optional(),
  apply_url: webUrl,
  notification_english_url: webUrl,
  notification_hindi_url: webUrl,
  official_website_url: webUrl,
  source_url: webUrl,
  verification_status: z.enum(['unverified', 'pending', 'verified']),
  status: z.enum(['draft', 'pending_review', 'published', 'rejected', 'archived', 'closed']),
})

async function assertAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Fadmin')
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin&error=unauthorized')
  return user
}

async function resolveOrganization(name: string | undefined, idToken: string) {
  if (!name) return null
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  if (!slug) throw new Error('Enter a valid organization name')

  const existing = await fsListDocs<TaxonomyItem>('organizations', idToken)
  const match = existing.find((item) => item.slug === slug)
  if (match) return match.id

  const created = await fsCreateDoc(
    'organizations',
    {
      name,
      slug,
      created_at: new Date().toISOString(),
    },
    idToken,
  )
  return created.id
}

function jobValues(v: z.infer<typeof jobSchema>, organization_id: string | null) {
  let selection_process: unknown[] = []
  if (v.selection_process?.trim()) {
    try {
      const parsed = JSON.parse(v.selection_process)
      if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== 'string')) throw new Error()
      selection_process = parsed
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20)
    } catch {
      throw new Error('Selection process must be a JSON array of stage names.')
    }
  }
  return {
    title: v.title,
    slug: v.slug,
    short_description: v.short_description || null,
    description: v.description || null,
    advertisement_number: v.advertisement_number || null,
    location: v.location || null,
    category_id: v.category_id || null,
    state_id: v.state_id || null,
    minimum_qualification_id: v.minimum_qualification_id || null,
    total_vacancies: v.total_vacancies ?? null,
    minimum_age: v.minimum_age ?? null,
    maximum_age: v.maximum_age ?? null,
    age_calculation_date: v.age_calculation_date || null,
    is_featured: v.is_featured ?? false,
    source_type: v.source_type || null,
    experience: v.experience || null,
    additional_eligibility: v.additional_eligibility || null,
    age_relaxation: v.age_relaxation || null,
    selection_process,
    application_start_date: v.application_start_date || null,
    application_end_date: v.application_end_date || null,
    fee_payment_last_date: v.fee_payment_last_date || null,
    correction_last_date: v.correction_last_date || null,
    preliminary_exam_date: v.preliminary_exam_date || null,
    mains_exam_date: v.mains_exam_date || null,
    admit_card_date: v.admit_card_date || null,
    result_date: v.result_date || null,
    apply_url: v.apply_url || null,
    notification_english_url: v.notification_english_url || null,
    notification_hindi_url: v.notification_hindi_url || null,
    official_website_url: v.official_website_url || null,
    source_url: v.source_url || null,
    organization_id,
    verification_status: v.verification_status,
    status: v.status,
  }
}

const feesSchema = z
  .array(
    z.object({
      category_name: z.string().trim().min(1).max(80),
      amount: z.union([z.number().nonnegative(), z.null()]).optional(),
      currency: z.string().trim().min(1).max(8).default('INR'),
    }),
  )
  .max(20)

const vacanciesSchema = z
  .array(
    z.object({
      post_name: z.string().trim().min(1).max(180),
      total_posts: z.union([z.number().int().nonnegative(), z.null()]).optional(),
      category_breakdown: z.record(z.string(), z.number().int().nonnegative()).default({}),
    }),
  )
  .max(50)

function parseJobExtras(v: z.infer<typeof jobSchema>): {
  job_fees: JobFee[]
  job_vacancies: JobVacancy[]
} {
  let fees: z.infer<typeof feesSchema> = []
  let vacancies: z.infer<typeof vacanciesSchema> = []
  try {
    if (v.fees_json?.trim()) fees = feesSchema.parse(JSON.parse(v.fees_json))
    if (v.vacancies_json?.trim()) vacancies = vacanciesSchema.parse(JSON.parse(v.vacancies_json))
  } catch {
    throw new Error('Fees and vacancies must be valid JSON arrays with non-negative amounts and counts.')
  }
  return {
    job_fees: fees.map((fee, idx) => ({
      id: `fee-${idx + 1}`,
      category_name: fee.category_name,
      amount: fee.amount ?? null,
      currency: fee.currency,
    })),
    job_vacancies: vacancies.map((vacancy, idx) => ({
      id: `vacancy-${idx + 1}`,
      post_name: vacancy.post_name,
      total_posts: vacancy.total_posts ?? null,
      category_breakdown: vacancy.category_breakdown,
    })),
  }
}

export async function createJobAction(formData: FormData) {
  const user = await assertAdmin()
  const parsed = jobSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    redirect(
      `/admin/jobs/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Please check the form')}`,
    )
  }
  const v = parsed.data
  if (v.status === 'published' && v.verification_status !== 'verified') {
    redirect('/admin/jobs/new?error=Mark+the+official+source+as+verified+before+publishing')
  }

  let organization_id: string | null
  try {
    organization_id = await resolveOrganization(v.organization_name, user.idToken)
  } catch (error) {
    redirect(
      `/admin/jobs/new?error=${encodeURIComponent(error instanceof Error ? error.message : 'Could not save organization')}`,
    )
  }

  let values: ReturnType<typeof jobValues>
  let extras: ReturnType<typeof parseJobExtras>
  try {
    values = jobValues(v, organization_id)
    extras = parseJobExtras(v)
  } catch (error) {
    redirect(
      `/admin/jobs/new?error=${encodeURIComponent(error instanceof Error ? error.message : 'Invalid form value')}`,
    )
  }

  const existingJobs = await fsListDocs<{ slug: string }>('jobs', user.idToken)
  if (existingJobs.some((item) => item.slug === v.slug)) {
    redirect('/admin/jobs/new?error=This+job+slug+is+already+in+use.')
  }

  const now = new Date().toISOString()
  let created: { id: string }
  try {
    created = await fsCreateDoc(
      'jobs',
      {
        ...values,
        ...extras,
        created_by: user.uid,
        published_at: v.status === 'published' ? now : null,
        created_at: now,
        updated_at: now,
      },
      user.idToken,
    )
  } catch {
    redirect('/admin/jobs/new?error=Could+not+save+the+job.+Check+the+required+details.')
  }

  await fsCreateDoc(
    'admin_activity_logs',
    {
      admin_id: user.uid,
      action: v.status === 'published' ? 'published' : 'created',
      entity_type: 'job',
      entity_id: created.id,
      details: { title: v.title },
      created_at: now,
    },
    user.idToken,
  ).catch(() => {})

  revalidatePath('/')
  revalidatePath('/jobs')
  revalidatePath('/admin')
  redirect(v.status === 'published' ? `/jobs/${v.slug}` : '/admin?notice=Job+saved')
}

export async function updateJobAction(formData: FormData) {
  const user = await assertAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/admin/jobs?error=Invalid+job')

  const parsed = jobSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    redirect(
      `/admin/jobs/${id}/edit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Please check the form')}`,
    )
  }
  const v = parsed.data
  if (v.status === 'published' && v.verification_status !== 'verified') {
    redirect(`/admin/jobs/${id}/edit?error=Mark+the+official+source+as+verified+before+publishing`)
  }

  let organization_id: string | null
  try {
    organization_id = await resolveOrganization(v.organization_name, user.idToken)
  } catch (error) {
    redirect(
      `/admin/jobs/${id}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : 'Could not save organization')}`,
    )
  }

  let values: ReturnType<typeof jobValues>
  let extras: ReturnType<typeof parseJobExtras>
  try {
    values = jobValues(v, organization_id)
    extras = parseJobExtras(v)
  } catch (error) {
    redirect(
      `/admin/jobs/${id}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : 'Invalid job details')}`,
    )
  }

  const existingJobs = await fsListDocs<{ slug: string }>('jobs', user.idToken)
  if (existingJobs.some((item) => item.slug === v.slug && item.id !== id)) {
    redirect(`/admin/jobs/${id}/edit?error=This+slug+is+already+in+use.`)
  }

  const now = new Date().toISOString()
  try {
    await fsUpdateDoc(
      'jobs',
      id,
      {
        ...values,
        ...extras,
        published_at: v.status === 'published' ? now : undefined,
        updated_at: now,
      },
      user.idToken,
    )
  } catch {
    redirect(`/admin/jobs/${id}/edit?error=Could+not+update+the+job.`)
  }

  await fsCreateDoc(
    'admin_activity_logs',
    {
      admin_id: user.uid,
      action: 'updated',
      entity_type: 'job',
      entity_id: id,
      details: { title: v.title },
      created_at: now,
    },
    user.idToken,
  ).catch(() => {})

  revalidatePath('/')
  revalidatePath('/jobs')
  revalidatePath('/admin')
  redirect('/admin/jobs?notice=Job+updated')
}

export async function setJobStatusAction(formData: FormData) {
  const user = await assertAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (!id || !['draft', 'pending_review', 'published', 'rejected', 'archived', 'closed'].includes(status)) {
    redirect('/admin/jobs?error=Invalid+action')
  }

  if (status === 'published') {
    const job = await fsGetDoc<{ verification_status?: string }>('jobs', id, user.idToken)
    if (job?.verification_status !== 'verified') {
      redirect('/admin/jobs?error=Verify+the+official+source+before+publishing')
    }
  }

  const now = new Date().toISOString()
  try {
    await fsUpdateDoc(
      'jobs',
      id,
      {
        status,
        published_at: status === 'published' ? now : undefined,
        updated_at: now,
      },
      user.idToken,
    )
  } catch {
    redirect('/admin/jobs?error=Could+not+update+job')
  }

  await fsCreateDoc(
    'admin_activity_logs',
    {
      admin_id: user.uid,
      action: status,
      entity_type: 'job',
      entity_id: id,
      details: { status },
      created_at: now,
    },
    user.idToken,
  ).catch(() => {})

  revalidatePath('/')
  revalidatePath('/jobs')
  revalidatePath('/admin')
  redirect('/admin/jobs?notice=Job+status+updated')
}

export async function deleteJobAction(formData: FormData) {
  const user = await assertAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/admin/jobs?error=Invalid+job')

  try {
    await fsDeleteDoc('jobs', id, user.idToken)
  } catch {
    redirect('/admin/jobs?error=Could+not+delete+job')
  }

  await fsCreateDoc(
    'admin_activity_logs',
    {
      admin_id: user.uid,
      action: 'deleted',
      entity_type: 'job',
      entity_id: id,
      details: {},
      created_at: new Date().toISOString(),
    },
    user.idToken,
  ).catch(() => {})

  revalidatePath('/')
  revalidatePath('/jobs')
  revalidatePath('/admin')
  redirect('/admin/jobs?notice=Job+deleted')
}
