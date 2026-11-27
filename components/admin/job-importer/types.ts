import type { NormalizedExtractionResult } from '@/lib/ai/extraction-schema'
import type { TaxonomyItem } from '@/lib/queries/jobs'

export type JobFormValues = {
  title: string
  slug: string
  organization_name: string
  advertisement_number: string
  category_id: string
  state_id: string
  location: string
  total_vacancies: string
  short_description: string
  description: string
  application_start_date: string
  application_end_date: string
  fee_payment_last_date: string
  correction_last_date: string
  preliminary_exam_date: string
  mains_exam_date: string
  admit_card_date: string
  result_date: string
  minimum_age: string
  maximum_age: string
  age_calculation_date: string
  minimum_qualification_id: string
  experience: string
  age_relaxation: string
  additional_eligibility: string
  selection_process: string
  fees_json: string
  vacancies_json: string
  apply_url: string
  official_website_url: string
  notification_english_url: string
  notification_hindi_url: string
  source_url: string
  source_type: string
  is_featured: boolean
  verification_status: 'unverified' | 'pending' | 'verified'
  status: 'draft' | 'pending_review' | 'published'
}

export const EMPTY_JOB_FORM: JobFormValues = {
  title: '',
  slug: '',
  organization_name: '',
  advertisement_number: '',
  category_id: '',
  state_id: '',
  location: '',
  total_vacancies: '',
  short_description: '',
  description: '',
  application_start_date: '',
  application_end_date: '',
  fee_payment_last_date: '',
  correction_last_date: '',
  preliminary_exam_date: '',
  mains_exam_date: '',
  admit_card_date: '',
  result_date: '',
  minimum_age: '',
  maximum_age: '',
  age_calculation_date: '',
  minimum_qualification_id: '',
  experience: '',
  age_relaxation: '',
  additional_eligibility: '',
  selection_process: '',
  fees_json: '',
  vacancies_json: '',
  apply_url: '',
  official_website_url: '',
  notification_english_url: '',
  notification_hindi_url: '',
  source_url: '',
  source_type: '',
  is_featured: false,
  verification_status: 'pending',
  status: 'draft',
}

export type LocalJobRecord = {
  id: string
  status: 'draft' | 'published'
  savedAt: string
  sourceContent: string
  form: JobFormValues
  extraction: NormalizedExtractionResult | null
  aiPopulatedKeys: string[]
  editedKeys: string[]
}

export type ExtractionErrorState = {
  message: string
  code?: string
  issues?: string[]
}

export const FORM_TO_EXTRACTION_KEY: Partial<Record<keyof JobFormValues, string>> = {
  title: 'title',
  slug: 'slug',
  organization_name: 'organization',
  advertisement_number: 'advertisementNumber',
  category_id: 'category',
  state_id: 'state',
  location: 'location',
  total_vacancies: 'totalVacancies',
  short_description: 'shortDescription',
  description: 'description',
  application_start_date: 'applicationStartDate',
  application_end_date: 'applicationEndDate',
  fee_payment_last_date: 'feePaymentLastDate',
  correction_last_date: 'correctionLastDate',
  preliminary_exam_date: 'preliminaryExamDate',
  mains_exam_date: 'mainsExamDate',
  admit_card_date: 'admitCardDate',
  result_date: 'resultDate',
  minimum_age: 'minimumAge',
  maximum_age: 'maximumAge',
  age_calculation_date: 'ageCalculationDate',
  minimum_qualification_id: 'qualifications',
  experience: 'experience',
  age_relaxation: 'ageRelaxation',
  additional_eligibility: 'additionalEligibility',
  selection_process: 'selectionProcess',
  fees_json: 'fees',
  vacancies_json: 'vacancies',
  apply_url: 'applyUrl',
  official_website_url: 'officialWebsiteUrl',
  notification_english_url: 'notificationEnglishUrl',
  notification_hindi_url: 'notificationHindiUrl',
  source_url: 'sourceUrl',
}

export function matchTaxonomyId(name: string | null | undefined, items: TaxonomyItem[]): string {
  if (!name) return ''
  const target = name.trim().toLowerCase()
  const exact = items.find(
    (item) => item.name.toLowerCase() === target || item.slug.toLowerCase() === target,
  )
  if (exact) return exact.id
  const partial = items.find(
    (item) =>
      item.name.toLowerCase().includes(target) || target.includes(item.name.toLowerCase()),
  )
  return partial?.id ?? ''
}
