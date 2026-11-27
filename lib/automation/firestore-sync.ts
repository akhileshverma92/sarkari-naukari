import { FieldValue, getAdminDb } from '@/lib/firebase/admin'
import type { NormalizedExtractionResult } from '@/lib/ai/extraction-schema'
import type { JobUpdateChange, SourceType, VerificationStatus } from './types'

async function resolveOrganizationId(name: string | null): Promise<string | null> {
  if (!name?.trim()) return null
  const db = getAdminDb()
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  if (!slug) return null

  const existing = await db
    .collection('organizations')
    .where('slug', '==', slug)
    .limit(1)
    .get()
  if (!existing.empty) return existing.docs[0].id

  const created = await db.collection('organizations').add({
    name: name.trim(),
    slug,
    created_at: new Date().toISOString(),
  })
  return created.id
}

async function resolveTaxonomyId(
  collection: 'states' | 'job_categories' | 'qualifications',
  name: string | null,
): Promise<string | null> {
  if (!name?.trim()) return null
  const db = getAdminDb()
  const target = name.trim().toLowerCase()
  const snap = await db.collection(collection).get()
  for (const doc of snap.docs) {
    const data = doc.data() as { name?: string; slug?: string }
    const docName = (data.name ?? '').toLowerCase()
    const docSlug = (data.slug ?? '').toLowerCase()
    if (docName === target || docSlug === target || (docName && target.includes(docName))) {
      return doc.id
    }
  }
  return null
}

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export async function findDuplicateJob(params: {
  slug: string | null
  title: string | null
  advertisementNumber: string | null
  organizationId: string | null
  applyUrl: string | null
  sourceUrl: string
}): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const db = getAdminDb()

  if (params.slug) {
    const bySlug = await db.collection('jobs').where('slug', '==', params.slug).limit(1).get()
    if (!bySlug.empty) {
      return { id: bySlug.docs[0].id, data: bySlug.docs[0].data() }
    }
  }

  if (params.applyUrl) {
    const byApply = await db
      .collection('jobs')
      .where('apply_url', '==', params.applyUrl)
      .limit(1)
      .get()
    if (!byApply.empty) {
      return { id: byApply.docs[0].id, data: byApply.docs[0].data() }
    }
  }

  if (params.advertisementNumber && params.organizationId) {
    const byAdvt = await db
      .collection('jobs')
      .where('advertisement_number', '==', params.advertisementNumber)
      .where('organization_id', '==', params.organizationId)
      .limit(1)
      .get()
    if (!byAdvt.empty) {
      return { id: byAdvt.docs[0].id, data: byAdvt.docs[0].data() }
    }
  }

  if (params.title) {
    const targetKey = normalizeTitleKey(params.title)
    const recent = await db.collection('jobs').limit(200).get()
    for (const doc of recent.docs) {
      const data = doc.data() as { title?: string; source_url?: string }
      if (data.source_url === params.sourceUrl) {
        return { id: doc.id, data }
      }
      if (data.title && normalizeTitleKey(data.title) === targetKey) {
        return { id: doc.id, data }
      }
    }
  }

  return null
}

export async function syncCandidateToFirestore(params: {
  normalized: NormalizedExtractionResult
  sourceUrl: string
  sourceType: SourceType
  verificationStatus: VerificationStatus
  autoPublishVerified: boolean
  forcePublish?: boolean
}): Promise<{
  outcome: 'published' | 'candidate' | 'duplicate_updated' | 'duplicate_skipped' | 'rejected'
  jobId: string | null
  slug?: string
  changes: JobUpdateChange[]
}> {
  const {
    normalized,
    sourceUrl,
    sourceType,
    verificationStatus,
    autoPublishVerified,
    forcePublish = false,
  } = params
  const d = normalized.data

  if (!forcePublish && (verificationStatus === 'rejected' || !d.title)) {
    return { outcome: 'rejected', jobId: null, changes: [] }
  }
  if (!d.title) {
    return { outcome: 'rejected', jobId: null, changes: [] }
  }

  const [organizationId, stateId, categoryId, qualificationId] = await Promise.all([
    resolveOrganizationId(d.organization),
    resolveTaxonomyId('states', d.state),
    resolveTaxonomyId('job_categories', d.category),
    resolveTaxonomyId('qualifications', d.qualifications),
  ])

  const baseSlug =
    d.slug ||
    d.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 160)

  const duplicate = await findDuplicateJob({
    slug: baseSlug,
    title: d.title,
    advertisementNumber: d.advertisementNumber,
    organizationId,
    applyUrl: d.applyUrl,
    sourceUrl,
  })

  const db = getAdminDb()
  const now = new Date().toISOString()

  if (duplicate) {
    // Only update existing job if new data is officially verified
    if (verificationStatus !== 'verified') {
      return { outcome: 'duplicate_skipped', jobId: duplicate.id, changes: [] }
    }

    const existing = duplicate.data
    const monitorFields: Array<[string, unknown]> = [
      ['application_end_date', d.applicationEndDate],
      ['total_vacancies', d.totalVacancies],
      ['admit_card_date', d.admitCardDate],
      ['result_date', d.resultDate],
      ['preliminary_exam_date', d.preliminaryExamDate],
      ['mains_exam_date', d.mainsExamDate],
      ['notification_english_url', d.notificationEnglishUrl],
      ['notification_hindi_url', d.notificationHindiUrl],
      ['apply_url', d.applyUrl],
    ]

    const patch: Record<string, unknown> = {}
    const changes: JobUpdateChange[] = []

    for (const [field, nextVal] of monitorFields) {
      if (nextVal !== null && nextVal !== undefined && nextVal !== '' && existing[field] !== nextVal) {
        patch[field] = nextVal
        changes.push({
          field,
          previousValue: existing[field] ?? null,
          newValue: nextVal,
        })
      }
    }

    if (changes.length === 0) {
      return { outcome: 'duplicate_skipped', jobId: duplicate.id, changes: [] }
    }

    patch.updated_at = now
    patch.serverUpdatedAt = FieldValue.serverTimestamp()

    await db.collection('jobs').doc(duplicate.id).update(patch)
    await db.collection('job_update_history').add({
      jobId: duplicate.id,
      slug: String(existing.slug ?? baseSlug),
      title: String(existing.title ?? d.title),
      changes,
      sourceUrl,
      verified: true,
      createdAt: now,
      serverCreatedAt: FieldValue.serverTimestamp(),
    })

    return { outcome: 'duplicate_updated', jobId: duplicate.id, changes }
  }

  // Publishing rule: only auto-publish if verified, autoPublishVerified enabled, and has apply/notification link
  // Or when admin explicitly clicks One-Click Publish (forcePublish = true)
  const hasActionableLink = Boolean(
    d.applyUrl || d.notificationEnglishUrl || d.notificationHindiUrl,
  )
  const shouldAutoPublish =
    forcePublish ||
    (autoPublishVerified && verificationStatus === 'verified' && hasActionableLink)

  if (!shouldAutoPublish) {
    return { outcome: 'candidate', jobId: null, changes: [] }
  }

  const jobPayload = {
    title: d.title,
    slug: baseSlug,
    organization_id: organizationId,
    category_id: categoryId,
    state_id: stateId,
    advertisement_number: d.advertisementNumber,
    short_description: d.shortDescription,
    description: d.description,
    total_vacancies: d.totalVacancies,
    location: d.location,
    minimum_age: d.minimumAge,
    maximum_age: d.maximumAge,
    age_calculation_date: d.ageCalculationDate,
    minimum_qualification_id: qualificationId,
    experience: d.experience,
    additional_eligibility: d.additionalEligibility,
    age_relaxation: d.ageRelaxation,
    selection_process: d.selectionProcess,
    job_fees: d.fees.map((f, idx) => ({
      id: `fee-${idx + 1}`,
      category_name: f.category,
      amount: f.amount,
      currency: f.currency,
    })),
    job_vacancies: d.vacancies.map((v, idx) => ({
      id: `vacancy-${idx + 1}`,
      post_name: v.postName,
      total_posts: v.totalPosts,
      category_breakdown: v.categoryBreakdown,
    })),
    application_start_date: d.applicationStartDate,
    application_end_date: d.applicationEndDate,
    fee_payment_last_date: d.feePaymentLastDate,
    correction_last_date: d.correctionLastDate,
    preliminary_exam_date: d.preliminaryExamDate,
    mains_exam_date: d.mainsExamDate,
    admit_card_date: d.admitCardDate,
    result_date: d.resultDate,
    apply_url: d.applyUrl,
    notification_english_url: d.notificationEnglishUrl,
    notification_hindi_url: d.notificationHindiUrl,
    official_website_url: d.officialWebsiteUrl,
    source_url: sourceUrl,
    source_type: sourceType,
    is_featured: false,
    verification_status: 'verified',
    status: 'published',
    published_at: now,
    created_by: 'automation-cron',
    created_at: now,
    updated_at: now,
    serverCreatedAt: FieldValue.serverTimestamp(),
  }

  // Concurrency-safe slug insertion via Firestore transaction
  const finalSlug = await db.runTransaction(async (tx) => {
    const slugCheck = await tx.get(
      db.collection('jobs').where('slug', '==', baseSlug).limit(1),
    )
    const chosenSlug = slugCheck.empty
      ? baseSlug
      : `${baseSlug}-${Date.now().toString(36).slice(-4)}`

    const newRef = db.collection('jobs').doc()
    tx.set(newRef, { ...jobPayload, slug: chosenSlug })
    return { id: newRef.id, slug: chosenSlug }
  })

  return { outcome: 'published', jobId: finalSlug.id, slug: finalSlug.slug, changes: [] }
}
