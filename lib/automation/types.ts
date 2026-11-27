export type SourceType = 'official' | 'aggregator'

export type JobSource = {
  id: string
  name: string
  baseUrl: string
  searchQueries: string[]
  sourceType: SourceType
  enabled: boolean
  priority: number
  rateLimitPerMinute: number
  lastDiscoveredAt: string | null
  createdAt: string
  updatedAt: string
}

export type VerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'pending_verification'
  | 'rejected'

export type CandidateStatus =
  | 'pending'
  | 'processing'
  | 'published'
  | 'candidate'
  | 'duplicate'
  | 'failed'
  | 'rejected'

export type ScrapedCandidate = {
  id: string
  url: string
  normalizedUrl: string
  sourceId: string
  sourceName: string
  sourceType: SourceType
  title: string
  snippet: string | null
  contentHash: string | null
  rawMarkdown: string | null
  extractedData: Record<string, unknown> | null
  extractionConfidence: number | null
  missingFields: string[]
  verificationStatus: VerificationStatus
  verificationNotes: string | null
  officialMatchUrl: string | null
  status: CandidateStatus
  retryCount: number
  lastError: string | null
  jobId: string | null
  discoveredAt: string
  processedAt: string | null
  updatedAt: string
}

export type ScrapingLog = {
  id: string
  jobType: 'discover' | 'process' | 'verify' | 'status_update'
  status: 'started' | 'completed' | 'failed' | 'skipped_locked'
  summary: string
  metrics: Record<string, number>
  error: string | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
}

export type AutomationSettings = {
  enabled: boolean
  autoPublishVerified: boolean
  confidenceThreshold: number
  maxCandidatesPerRun: number
  maxVerifyPerRun: number
  firecrawlRequestsToday: number
  cloudflareAiRequestsToday: number
  usageResetDate: string
  lastDiscoveryAt: string | null
  lastProcessAt: string | null
  lastVerifyAt: string | null
  lastStatusUpdateAt: string | null
  updatedAt: string
}

export type JobUpdateChange = {
  field: string
  previousValue: unknown
  newValue: unknown
}

export type JobUpdateHistory = {
  id: string
  jobId: string
  slug: string
  title: string
  changes: JobUpdateChange[]
  sourceUrl: string
  verified: boolean
  createdAt: string
}
