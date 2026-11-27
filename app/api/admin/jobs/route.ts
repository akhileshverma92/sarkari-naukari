import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  fsCreateDoc,
  fsGetDoc,
  fsListDocs,
  fsUpdateDoc,
  getCurrentUser,
  isAdminUser,
} from '@/lib/firebase/server'
import type { JobFee, JobVacancy, TaxonomyItem } from '@/lib/queries/jobs'

const optionalNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().nonnegative().optional(),
)

const webUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS link')
  .optional()
  .or(z.literal(''))

const payloadSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().min(5, 'Job title must be at least 5 characters').max(180),
  slug: z
    .string()
    .trim()
    .min(3, 'URL slug must be at least 3 characters')
    .max(180)
    .regex(/^[a-z0-9-]+$/, 'Slug must use lowercase letters, numbers and hyphens'),
  organization_name: z.string().trim().max(180).optional().default(''),
  advertisement_number: z.string().trim().max(100).optional().default(''),
  category_id: z.string().trim().optional().default(''),
  state_id: z.string().trim().optional().default(''),
  location: z.string().trim().max(120).optional().default(''),
  total_vacancies: optionalNumber,
  short_description: z.string().trim().max(500).optional().default(''),
  description: z.string().trim().max(12000).optional().default(''),
  application_start_date: z.string().optional().default(''),
  application_end_date: z.string().optional().default(''),
  fee_payment_last_date: z.string().optional().default(''),
  correction_last_date: z.string().optional().default(''),
  preliminary_exam_date: z.string().optional().default(''),
  mains_exam_date: z.string().optional().default(''),
  admit_card_date: z.string().optional().default(''),
  result_date: z.string().optional().default(''),
  minimum_age: optionalNumber,
  maximum_age: optionalNumber,
  age_calculation_date: z.string().optional().default(''),
  minimum_qualification_id: z.string().trim().optional().default(''),
  experience: z.string().trim().max(500).optional().default(''),
  age_relaxation: z.string().trim().max(1000).optional().default(''),
  additional_eligibility: z.string().trim().max(4000).optional().default(''),
  selection_process: z.string().optional().default(''),
  fees_json: z.string().max(5000).optional().default(''),
  vacancies_json: z.string().max(10000).optional().default(''),
  apply_url: webUrl.default(''),
  official_website_url: webUrl.default(''),
  notification_english_url: webUrl.default(''),
  notification_hindi_url: webUrl.default(''),
  source_url: webUrl.default(''),
  source_type: z.string().trim().max(100).optional().default(''),
  is_featured: z.boolean().optional().default(false),
  verification_status: z.enum(['unverified', 'pending', 'verified']).default('pending'),
  status: z.enum(['draft', 'pending_review', 'published']).default('draft'),
})

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

async function resolveOrganization(name: string, idToken: string): Promise<string | null> {
  if (!name.trim()) return null
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  if (!slug) return null

  const existing = await fsListDocs<TaxonomyItem>('organizations', idToken)
  const match = existing.find((item) => item.slug === slug)
  if (match) return match.id

  const created = await fsCreateDoc(
    'organizations',
    {
      name: name.trim(),
      slug,
      created_at: new Date().toISOString(),
    },
    idToken,
  )
  return created.id
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const isAdmin = await isAdminUser(user)
  if (!user || !isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Sign in with an administrator account.' },
      { status: user ? 403 : 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid job form data.' },
      { status: 400 },
    )
  }

  const v = parsed.data

  let selection_process: unknown[] = []
  if (v.selection_process.trim()) {
    try {
      const sp = JSON.parse(v.selection_process)
      if (!Array.isArray(sp) || sp.some((x) => typeof x !== 'string')) throw new Error()
      selection_process = sp
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20)
    } catch {
      return NextResponse.json(
        { error: 'Selection process must be a JSON array of stage names.' },
        { status: 400 },
      )
    }
  }

  let job_fees: JobFee[] = []
  let job_vacancies: JobVacancy[] = []
  try {
    if (v.fees_json.trim()) {
      const parsedFees = feesSchema.parse(JSON.parse(v.fees_json))
      job_fees = parsedFees.map((fee, idx) => ({
        id: `fee-${idx + 1}`,
        category_name: fee.category_name,
        amount: fee.amount ?? null,
        currency: fee.currency,
      }))
    }
    if (v.vacancies_json.trim()) {
      const parsedVacancies = vacanciesSchema.parse(JSON.parse(v.vacancies_json))
      job_vacancies = parsedVacancies.map((vac, idx) => ({
        id: `vacancy-${idx + 1}`,
        post_name: vac.post_name,
        total_posts: vac.total_posts ?? null,
        category_breakdown: vac.category_breakdown,
      }))
    }
  } catch {
    return NextResponse.json(
      { error: 'Fees and vacancies must be valid JSON arrays.' },
      { status: 400 },
    )
  }

  const existingJobs = await fsListDocs<{ slug: string }>('jobs', user.idToken)
  const existingTarget = v.id ? await fsGetDoc('jobs', v.id, user.idToken) : null

  if (existingJobs.some((item) => item.slug === v.slug && item.id !== existingTarget?.id)) {
    return NextResponse.json(
      { error: `The slug "${v.slug}" is already in use. Choose a unique slug.` },
      { status: 409 },
    )
  }

  let organization_id: string | null = null
  try {
    organization_id = await resolveOrganization(v.organization_name, user.idToken)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save organization.' },
      { status: 500 },
    )
  }

  const now = new Date().toISOString()
  const docData = {
    title: v.title,
    slug: v.slug,
    organization_id,
    category_id: v.category_id || null,
    state_id: v.state_id || null,
    advertisement_number: v.advertisement_number || null,
    short_description: v.short_description || null,
    description: v.description || null,
    total_vacancies: v.total_vacancies ?? null,
    location: v.location || null,
    minimum_age: v.minimum_age ?? null,
    maximum_age: v.maximum_age ?? null,
    age_calculation_date: v.age_calculation_date || null,
    minimum_qualification_id: v.minimum_qualification_id || null,
    experience: v.experience || null,
    additional_eligibility: v.additional_eligibility || null,
    age_relaxation: v.age_relaxation || null,
    selection_process,
    job_fees,
    job_vacancies,
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
    source_type: v.source_type || null,
    is_featured: v.is_featured,
    verification_status: v.status === 'published' ? 'verified' : v.verification_status,
    status: v.status,
    published_at: v.status === 'published' ? now : null,
    updated_at: now,
  }

  try {
    let savedId: string
    if (existingTarget) {
      await fsUpdateDoc('jobs', existingTarget.id, docData, user.idToken)
      savedId = existingTarget.id
    } else {
      const created = await fsCreateDoc(
        'jobs',
        {
          ...docData,
          created_by: user.uid,
          created_at: now,
        },
        user.idToken,
      )
      savedId = created.id
    }

    await fsCreateDoc(
      'admin_activity_logs',
      {
        admin_id: user.uid,
        action: v.status === 'published' ? 'published' : 'created',
        entity_type: 'job',
        entity_id: savedId,
        details: { title: v.title, slug: v.slug },
        created_at: now,
      },
      user.idToken,
    ).catch(() => {})

    revalidatePath('/')
    revalidatePath('/jobs')
    revalidatePath(`/jobs/${v.slug}`)
    revalidatePath('/admin')
    revalidatePath('/admin/jobs')

    return NextResponse.json({
      ok: true,
      id: savedId,
      slug: v.slug,
      status: v.status,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to save job to Firebase Firestore.',
      },
      { status: 500 },
    )
  }
}
