import { runCloudflareJobExtraction } from '@/lib/ai/cloudflare'
import type { NormalizedExtractionResult } from '@/lib/ai/extraction-schema'
import { normalizeAiResponseText } from '@/lib/ai/normalize-job'
import { isOfficialGovDomain } from '@/lib/firecrawl/client'
import type { SourceType, VerificationStatus } from './types'

export type VerifiedExtractionBundle = {
  normalized: NormalizedExtractionResult
  extractionConfidence: number
  verificationStatus: VerificationStatus
  verificationNotes: string
  officialMatchUrl: string | null
}

function sanitizeUntrustedScrapedText(markdown: string): string {
  return markdown
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[filtered]')
    .replace(/system\s*prompt/gi, '[filtered]')
    .slice(0, 24000)
}

export function computeExtractionConfidence(normalized: NormalizedExtractionResult): number {
  const values = Object.values(normalized.fields).filter(
    (f) => f.value !== null && f.value !== undefined && !(Array.isArray(f.value) && f.value.length === 0) && f.value !== '',
  )
  if (values.length === 0) return 0

  let scoreSum = 0
  for (const field of values) {
    if (field.confidence === 'high') scoreSum += 100
    else if (field.confidence === 'medium') scoreSum += 70
    else scoreSum += 35
  }

  const avgFieldScore = scoreSum / values.length
  const completenessBonus = Math.min(20, normalized.extractedCount * 1.5)
  const conflictPenalty = normalized.conflicts.length * 15

  return Math.max(0, Math.min(100, Math.round(avgFieldScore * 0.8 + completenessBonus - conflictPenalty)))
}

export function verifyExtractedJob(params: {
  normalized: NormalizedExtractionResult
  sourceUrl: string
  sourceType: SourceType
  discoveredOfficialWebsite: string | null
  discoveredNotificationPdf: string | null
  confidence: number
  confidenceThreshold: number
}): {
  verificationStatus: VerificationStatus
  verificationNotes: string
  officialMatchUrl: string | null
} {
  const {
    normalized,
    sourceUrl,
    sourceType,
    discoveredOfficialWebsite,
    discoveredNotificationPdf,
    confidence,
    confidenceThreshold,
  } = params

  const d = normalized.data
  if (!d.title || (!d.organization && !d.applyUrl && !d.officialWebsiteUrl)) {
    return {
      verificationStatus: 'rejected',
      verificationNotes: 'Missing required title or recruiting authority / application link.',
      officialMatchUrl: null,
    }
  }

  if (normalized.conflicts.length > 0) {
    return {
      verificationStatus: 'pending_verification',
      verificationNotes: `Contradictory values detected in ${normalized.conflicts.length} field(s). Manual review required.`,
      officialMatchUrl: null,
    }
  }

  const candidateOfficialUrls = [
    sourceType === 'official' ? sourceUrl : null,
    d.officialWebsiteUrl,
    d.applyUrl,
    d.notificationEnglishUrl,
    d.notificationHindiUrl,
    discoveredOfficialWebsite,
    discoveredNotificationPdf,
  ].filter((u): u is string => Boolean(u))

  const officialMatchUrl = candidateOfficialUrls.find((u) => isOfficialGovDomain(u)) ?? null
  const hasApplyOrNotification = Boolean(
    d.applyUrl || d.notificationEnglishUrl || d.notificationHindiUrl || discoveredNotificationPdf,
  )

  // Rule: Third-party-only listings are never automatically marked verified
  if (sourceType !== 'official' && !officialMatchUrl) {
    return {
      verificationStatus: 'pending_verification',
      verificationNotes: 'Discovered from third-party source without a confirmed official .gov.in / .nic.in link.',
      officialMatchUrl: null,
    }
  }

  if (officialMatchUrl && hasApplyOrNotification && confidence >= confidenceThreshold) {
    return {
      verificationStatus: 'verified',
      verificationNotes: `Verified against official domain (${new URL(officialMatchUrl).hostname}) with ${confidence}% confidence.`,
      officialMatchUrl,
    }
  }

  if (officialMatchUrl || hasApplyOrNotification) {
    return {
      verificationStatus: 'partially_verified',
      verificationNotes: `Official reference found, but confidence (${confidence}%) or required application links need review.`,
      officialMatchUrl,
    }
  }

  return {
    verificationStatus: 'pending_verification',
    verificationNotes: 'Missing official application or notification link.',
    officialMatchUrl: null,
  }
}

export async function extractAndVerifyCandidate(params: {
  markdown: string
  sourceUrl: string
  sourceName: string
  sourceType: SourceType
  discoveredOfficialWebsite: string | null
  discoveredNotificationPdf: string | null
  confidenceThreshold: number
}): Promise<VerifiedExtractionBundle> {
  const safeText = sanitizeUntrustedScrapedText(params.markdown)
  const rawAi = await runCloudflareJobExtraction(safeText)
  const normalized = normalizeAiResponseText(rawAi)

  // Fill discovered official links ONLY if AI left them null (never overwrite)
  if (!normalized.data.officialWebsiteUrl && params.discoveredOfficialWebsite) {
    normalized.data.officialWebsiteUrl = params.discoveredOfficialWebsite
  }
  if (!normalized.data.notificationEnglishUrl && params.discoveredNotificationPdf) {
    normalized.data.notificationEnglishUrl = params.discoveredNotificationPdf
  }
  if (!normalized.data.sourceName) {
    normalized.data.sourceName = params.sourceName
  }
  if (!normalized.data.sourceUrl) {
    normalized.data.sourceUrl = params.sourceUrl
  }

  const extractionConfidence = computeExtractionConfidence(normalized)
  const verification = verifyExtractedJob({
    normalized,
    sourceUrl: params.sourceUrl,
    sourceType: params.sourceType,
    discoveredOfficialWebsite: params.discoveredOfficialWebsite,
    discoveredNotificationPdf: params.discoveredNotificationPdf,
    confidence: extractionConfidence,
    confidenceThreshold: params.confidenceThreshold,
  })

  return {
    normalized,
    extractionConfidence,
    ...verification,
  }
}
