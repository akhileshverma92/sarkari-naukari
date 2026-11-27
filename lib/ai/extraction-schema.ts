import { z } from 'zod'

export const confidenceSchema = z.enum(['high', 'medium', 'low'])
export type ConfidenceLevel = z.infer<typeof confidenceSchema>

export const extractedFieldMetaSchema = z.object({
  field: z.string(),
  value: z.unknown(),
  confidence: confidenceSchema,
  evidence: z.string().nullable().default(null),
  verified: z.literal(false).default(false),
})
export type ExtractedFieldMeta = z.infer<typeof extractedFieldMetaSchema>

export const conflictSchema = z.object({
  field: z.string(),
  message: z.string(),
  values: z.array(z.string()).default([]),
})
export type ExtractionConflict = z.infer<typeof conflictSchema>

function coerceNullableInt(maxVal?: number) {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return null
    let num: number | null = null
    if (typeof val === 'number') {
      num = val
    } else if (typeof val === 'string') {
      const m = val.match(/\d+/)
      if (m) num = Number(m[0])
    } else if (typeof val === 'object') {
      const obj = val as Record<string, unknown>
      for (const k of ['value', 'max', 'maximum', 'min', 'minimum', 'count', 'total', 'amount']) {
        if (typeof obj[k] === 'number') {
          num = obj[k] as number
          break
        }
      }
    }
    if (num === null || !Number.isFinite(num)) return null
    const rounded = Math.round(num)
    if (rounded < 0) return null
    if (maxVal !== undefined && rounded > maxVal) return null
    return rounded
  }, z.number().int().nonnegative().nullable().default(null))
}

function coerceNullableNumber() {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return null
    if (typeof val === 'number') return Number.isFinite(val) && val >= 0 ? val : null
    if (typeof val === 'string') {
      const cleaned = val.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
      if (cleaned) {
        const n = Number(cleaned[0])
        return Number.isFinite(n) && n >= 0 ? n : null
      }
    }
    return null
  }, z.number().nonnegative().nullable().default(null))
}

function coerceArray<T extends z.ZodTypeAny>(itemSchema: T, maxItems: number) {
  return z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(itemSchema).max(maxItems).default([]),
  )
}

export const feeItemSchema = z.object({
  category: z.string().trim().min(1).max(80),
  amount: coerceNullableNumber(),
  currency: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : 'INR'),
    z.string().trim().min(1).max(8).default('INR'),
  ),
})

export const vacancyItemSchema = z.object({
  postName: z.string().trim().min(1).max(180),
  totalPosts: coerceNullableInt(),
  categoryBreakdown: z.preprocess(
    (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
    z.record(z.string(), z.coerce.number().int().nonnegative()).default({}),
  ),
})

export const rawExtractionPayloadSchema = z.object({
  // Basic Information
  title: z.string().trim().max(180).nullable().default(null),
  slug: z.string().trim().max(180).nullable().default(null),
  organization: z.string().trim().max(180).nullable().default(null),
  advertisementNumber: z.string().trim().max(100).nullable().default(null),
  category: z.string().trim().max(100).nullable().default(null),
  state: z.string().trim().max(100).nullable().default(null),
  location: z.string().trim().max(120).nullable().default(null),
  totalVacancies: coerceNullableInt(),
  shortDescription: z.string().trim().max(500).nullable().default(null),
  description: z.string().trim().max(12000).nullable().default(null),

  // Important Dates (YYYY-MM-DD or null)
  notificationDate: z.string().trim().nullable().default(null),
  applicationStartDate: z.string().trim().nullable().default(null),
  applicationEndDate: z.string().trim().nullable().default(null),
  feePaymentLastDate: z.string().trim().nullable().default(null),
  correctionLastDate: z.string().trim().nullable().default(null),
  preliminaryExamDate: z.string().trim().nullable().default(null),
  mainsExamDate: z.string().trim().nullable().default(null),
  admitCardDate: z.string().trim().nullable().default(null),
  resultDate: z.string().trim().nullable().default(null),

  // Eligibility
  minimumAge: coerceNullableInt(100),
  maximumAge: coerceNullableInt(120),
  ageCalculationDate: z.string().trim().nullable().default(null),
  qualifications: z.string().trim().max(500).nullable().default(null),
  experience: z.string().trim().max(500).nullable().default(null),
  additionalEligibility: z.string().trim().max(4000).nullable().default(null),
  ageRelaxation: z.string().trim().max(1000).nullable().default(null),

  // Application Fees
  fees: coerceArray(feeItemSchema, 20),

  // Vacancies
  vacancies: coerceArray(vacancyItemSchema, 50),

  // Selection Process
  selectionProcess: coerceArray(z.string().trim().min(1).max(200), 20),

  // Important Links
  applyUrl: z.string().trim().nullable().default(null),
  notificationEnglishUrl: z.string().trim().nullable().default(null),
  notificationHindiUrl: z.string().trim().nullable().default(null),
  officialWebsiteUrl: z.string().trim().nullable().default(null),

  // Source
  sourceName: z.string().trim().max(180).nullable().default(null),
  sourceUrl: z.string().trim().nullable().default(null),

  // Evidence, Confidence & Conflicts
  fieldMetadata: z.preprocess(
    (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
    z
      .record(
        z.string(),
        z.object({
          confidence: confidenceSchema.default('medium'),
          evidence: z.string().nullable().default(null),
        }),
      )
      .default({}),
  ),
  conflicts: coerceArray(conflictSchema, 20),
})

export type RawExtractionPayload = z.infer<typeof rawExtractionPayloadSchema>

export type NormalizedExtractionResult = {
  data: RawExtractionPayload
  fields: Record<string, ExtractedFieldMeta>
  extractedCount: number
  totalTrackableFields: number
  missingFields: string[]
  lowConfidenceFields: string[]
  conflicts: ExtractionConflict[]
  mode: 'ai' | 'json'
}

export const TRACKABLE_FIELD_LABELS: Record<string, string> = {
  title: 'Job title',
  slug: 'URL slug',
  organization: 'Organization',
  advertisementNumber: 'Advertisement number',
  category: 'Category',
  state: 'State',
  location: 'Location',
  totalVacancies: 'Total vacancies',
  shortDescription: 'Short summary',
  description: 'Recruitment details',
  notificationDate: 'Notification date',
  applicationStartDate: 'Application start date',
  applicationEndDate: 'Application end date',
  feePaymentLastDate: 'Fee payment last date',
  correctionLastDate: 'Correction last date',
  preliminaryExamDate: 'Preliminary exam date',
  mainsExamDate: 'Mains exam date',
  admitCardDate: 'Admit card date',
  resultDate: 'Result date',
  minimumAge: 'Minimum age',
  maximumAge: 'Maximum age',
  ageCalculationDate: 'Age calculation date',
  qualifications: 'Minimum qualification',
  experience: 'Experience',
  additionalEligibility: 'Additional eligibility',
  ageRelaxation: 'Age relaxation',
  fees: 'Application fees',
  vacancies: 'Vacancy breakdown',
  selectionProcess: 'Selection process',
  applyUrl: 'Apply online URL',
  notificationEnglishUrl: 'English notification URL',
  notificationHindiUrl: 'Hindi notification URL',
  officialWebsiteUrl: 'Official website URL',
  sourceName: 'Source name',
  sourceUrl: 'Source URL',
}
