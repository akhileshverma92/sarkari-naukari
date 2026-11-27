import {
  rawExtractionPayloadSchema,
  TRACKABLE_FIELD_LABELS,
  type ExtractedFieldMeta,
  type NormalizedExtractionResult,
  type RawExtractionPayload,
} from './extraction-schema'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim()
  return cleaned || null
}

export function sanitizeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

function sanitizeDate(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!ISO_DATE_RE.test(trimmed)) return null
  const date = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return trimmed
}

function makeSlug(title: string | null, rawSlug: string | null): string | null {
  const base = rawSlug ?? title
  if (!base) return null
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 180)
  return slug.length >= 3 ? slug : null
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Strip markdown code fences if present
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim())
    }
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
    }
    throw new Error('Model output did not contain a valid JSON object.')
  }
}

function isFieldPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function sanitizePayload(parsed: RawExtractionPayload): RawExtractionPayload {
  return {
    ...parsed,
    title: sanitizeText(parsed.title),
    slug: makeSlug(sanitizeText(parsed.title), sanitizeText(parsed.slug)),
    organization: sanitizeText(parsed.organization),
    advertisementNumber: sanitizeText(parsed.advertisementNumber),
    category: sanitizeText(parsed.category),
    state: sanitizeText(parsed.state),
    location: sanitizeText(parsed.location),
    shortDescription: sanitizeText(parsed.shortDescription),
    description: sanitizeText(parsed.description),
    notificationDate: sanitizeDate(parsed.notificationDate),
    applicationStartDate: sanitizeDate(parsed.applicationStartDate),
    applicationEndDate: sanitizeDate(parsed.applicationEndDate),
    feePaymentLastDate: sanitizeDate(parsed.feePaymentLastDate),
    correctionLastDate: sanitizeDate(parsed.correctionLastDate),
    preliminaryExamDate: sanitizeDate(parsed.preliminaryExamDate),
    mainsExamDate: sanitizeDate(parsed.mainsExamDate),
    admitCardDate: sanitizeDate(parsed.admitCardDate),
    resultDate: sanitizeDate(parsed.resultDate),
    ageCalculationDate: sanitizeDate(parsed.ageCalculationDate),
    qualifications: sanitizeText(parsed.qualifications),
    experience: sanitizeText(parsed.experience),
    additionalEligibility: sanitizeText(parsed.additionalEligibility),
    ageRelaxation: sanitizeText(parsed.ageRelaxation),
    applyUrl: sanitizeHttpUrl(parsed.applyUrl),
    notificationEnglishUrl: sanitizeHttpUrl(parsed.notificationEnglishUrl),
    notificationHindiUrl: sanitizeHttpUrl(parsed.notificationHindiUrl),
    officialWebsiteUrl: sanitizeHttpUrl(parsed.officialWebsiteUrl),
    sourceName: sanitizeText(parsed.sourceName),
    sourceUrl: sanitizeHttpUrl(parsed.sourceUrl),
  }
}

export function buildNormalizedResult(
  rawInput: unknown,
  mode: 'ai' | 'json',
): NormalizedExtractionResult {
  const parsed = rawExtractionPayloadSchema.parse(rawInput)
  const data = sanitizePayload(parsed)

  const fields: Record<string, ExtractedFieldMeta> = {}
  const missingFields: string[] = []
  const lowConfidenceFields: string[] = []
  let extractedCount = 0

  const trackableKeys = Object.keys(TRACKABLE_FIELD_LABELS)
  for (const key of trackableKeys) {
    const val = data[key as keyof RawExtractionPayload]
    const populated = isFieldPopulated(val)
    const meta = data.fieldMetadata[key]
    const confidence =
      mode === 'json'
        ? populated
          ? 'high'
          : 'low'
        : (meta?.confidence ?? (populated ? 'medium' : 'low'))
    const evidence =
      mode === 'json'
        ? populated
          ? 'Parsed directly from supplied JSON input.'
          : null
        : sanitizeText(meta?.evidence)

    if (populated) {
      extractedCount += 1
      if (confidence === 'low') {
        lowConfidenceFields.push(key)
      }
    } else {
      missingFields.push(key)
    }

    fields[key] = {
      field: key,
      value: val,
      confidence,
      evidence,
      verified: false,
    }
  }

  return {
    data,
    fields,
    extractedCount,
    totalTrackableFields: trackableKeys.length,
    missingFields,
    lowConfidenceFields,
    conflicts: data.conflicts,
    mode,
  }
}

export function tryParseDirectJson(content: string): NormalizedExtractionResult | null {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return null
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(trimmed)
  } catch {
    throw new Error('INVALID_JSON')
  }
  if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    throw new Error('INVALID_JSON')
  }
  return buildNormalizedResult(parsedJson, 'json')
}

export function normalizeAiResponseText(rawModelText: string): NormalizedExtractionResult {
  const jsonObj = extractJsonObject(rawModelText)
  return buildNormalizedResult(jsonObj, 'ai')
}
