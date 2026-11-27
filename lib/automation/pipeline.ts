import {
  acquireExecutionLock,
  FieldValue,
  getAdminDb,
  releaseExecutionLock,
} from '@/lib/firebase/admin'
import {
  discoverJobPages,
  discoverOfficialNotification,
  extractJobLinksFromHomepage,
  hashString,
  isOfficialGovDomain,
  normalizeUrl,
  scrapeJobPage,
  searchJobSources,
} from '@/lib/firecrawl/client'
import { buildNormalizedResult } from '@/lib/ai/normalize-job'
import { extractAndVerifyCandidate } from './extract-and-verify'
import { syncCandidateToFirestore } from './firestore-sync'
import {
  getAutomationSettings,
  incrementUsageCounter,
  updateAutomationSettings,
  writeScrapingLog,
} from './settings'
import { listJobSources } from './sources'
import type { ScrapedCandidate } from './types'

export async function runDiscoveryJob(force = false) {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const settings = await getAutomationSettings()

  if (!settings.enabled && !force) {
    return { status: 'disabled', discovered: 0, skipped: 0 }
  }

  const locked = await acquireExecutionLock('discover_jobs', 4 * 60 * 1000)
  if (!locked) {
    await writeScrapingLog({
      jobType: 'discover',
      status: 'skipped_locked',
      summary: 'Skipped discovery because another discovery run holds the lock.',
      metrics: {},
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
    return { status: 'locked', discovered: 0, skipped: 0 }
  }

  let discovered = 0
  let skipped = 0
  let firecrawlCalls = 0

  try {
    const db = getAdminDb()
    const sources = (await listJobSources()).filter((s) => s.enabled).slice(0, 6)

    for (const source of sources) {
      const hits = await discoverJobPages(source, 4)
      firecrawlCalls += source.searchQueries.slice(0, 2).length

      for (const hit of hits) {
        const urlHash = hashString(hit.normalizedUrl)
        const processedRef = db.collection('processed_urls').doc(urlHash)
        const existing = await processedRef.get()

        if (existing.exists) {
          skipped += 1
          continue
        }

        const now = new Date().toISOString()
        const candidateRef = db.collection('scraped_candidates').doc(urlHash)
        await candidateRef.set({
          url: hit.url,
          normalizedUrl: hit.normalizedUrl,
          sourceId: source.id,
          sourceName: source.name,
          sourceType: source.sourceType,
          title: hit.title,
          snippet: hit.description,
          contentHash: null,
          rawMarkdown: null,
          extractedData: null,
          extractionConfidence: null,
          missingFields: [],
          verificationStatus: 'pending_verification',
          verificationNotes: null,
          officialMatchUrl: null,
          status: 'pending',
          retryCount: 0,
          lastError: null,
          jobId: null,
          discoveredAt: now,
          processedAt: null,
          updatedAt: now,
          serverCreatedAt: FieldValue.serverTimestamp(),
        })

        await processedRef.set({
          url: hit.url,
          normalizedUrl: hit.normalizedUrl,
          contentHash: null,
          status: 'discovered',
          candidateId: candidateRef.id,
          jobId: null,
          lastCheckedAt: now,
          updatedAt: now,
        })

        discovered += 1
      }

      await db.collection('job_sources').doc(source.id).update({
        lastDiscoveredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    await incrementUsageCounter('firecrawlRequestsToday', firecrawlCalls)
    await updateAutomationSettings({ lastDiscoveryAt: new Date().toISOString() })
    await writeScrapingLog({
      jobType: 'discover',
      status: 'completed',
      summary: `Discovered ${discovered} new candidate URLs (${skipped} already processed).`,
      metrics: { discovered, skipped, firecrawlCalls },
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })

    return { status: 'completed', discovered, skipped }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery failed'
    await writeScrapingLog({
      jobType: 'discover',
      status: 'failed',
      summary: 'Job discovery failed.',
      metrics: { discovered, skipped },
      error: message,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
    throw err
  } finally {
    await releaseExecutionLock('discover_jobs')
  }
}

export async function runProcessCandidatesJob(force = false, includeFailed = false) {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const settings = await getAutomationSettings()

  if (!settings.enabled && !force) {
    return { status: 'disabled', processed: 0, published: 0, failed: 0 }
  }

  const locked = await acquireExecutionLock('process_candidates', 4 * 60 * 1000)
  if (!locked) {
    await writeScrapingLog({
      jobType: 'process',
      status: 'skipped_locked',
      summary: 'Skipped candidate processing because another batch is active.',
      metrics: {},
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
    return { status: 'locked', processed: 0, published: 0, failed: 0 }
  }

  let processed = 0
  let published = 0
  let candidatesSaved = 0
  let duplicates = 0
  let failed = 0

  try {
    const db = getAdminDb()
    const batchLimit = Math.max(1, Math.min(5, settings.maxCandidatesPerRun || 3))

    const statuses = includeFailed ? ['pending', 'failed'] : ['pending']
    const snap = await db
      .collection('scraped_candidates')
      .where('status', 'in', statuses)
      .limit(batchLimit)
      .get()

    for (const doc of snap.docs) {
      const candidate = { id: doc.id, ...(doc.data() as Omit<ScrapedCandidate, 'id'>) }
      if (candidate.status === 'failed' && candidate.retryCount >= 3) {
        continue
      }

      const now = new Date().toISOString()
      await doc.ref.update({ status: 'processing', updatedAt: now })

      try {
        const scraped = await scrapeJobPage(candidate.url)
        await incrementUsageCounter('firecrawlRequestsToday', 1)

        const { officialWebsite, notificationPdf } = discoverOfficialNotification(
          scraped.links,
          candidate.url,
        )

        const bundle = await extractAndVerifyCandidate({
          markdown: scraped.markdown,
          sourceUrl: candidate.url,
          sourceName: candidate.sourceName,
          sourceType: candidate.sourceType,
          discoveredOfficialWebsite: officialWebsite,
          discoveredNotificationPdf: notificationPdf,
          confidenceThreshold: settings.confidenceThreshold,
        })
        await incrementUsageCounter('cloudflareAiRequestsToday', 1)

        const syncResult = await syncCandidateToFirestore({
          normalized: bundle.normalized,
          sourceUrl: candidate.url,
          sourceType: candidate.sourceType,
          verificationStatus: bundle.verificationStatus,
          autoPublishVerified: settings.autoPublishVerified,
        })

        const finalStatus =
          syncResult.outcome === 'published'
            ? 'published'
            : syncResult.outcome === 'duplicate_updated' || syncResult.outcome === 'duplicate_skipped'
              ? 'duplicate'
              : syncResult.outcome === 'rejected'
                ? 'rejected'
                : 'candidate'

        if (finalStatus === 'published') published += 1
        else if (finalStatus === 'candidate') candidatesSaved += 1
        else if (finalStatus === 'duplicate') duplicates += 1

        await doc.ref.update({
          contentHash: scraped.contentHash,
          rawMarkdown: scraped.markdown.slice(0, 12000),
          extractedData: bundle.normalized.data,
          extractionConfidence: bundle.extractionConfidence,
          missingFields: bundle.normalized.missingFields,
          verificationStatus: bundle.verificationStatus,
          verificationNotes: bundle.verificationNotes,
          officialMatchUrl: bundle.officialMatchUrl,
          status: finalStatus,
          jobId: syncResult.jobId,
          lastError: null,
          processedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

        await db
          .collection('processed_urls')
          .doc(candidate.id)
          .set(
            {
              contentHash: scraped.contentHash,
              status: finalStatus,
              jobId: syncResult.jobId,
              lastCheckedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          )

        processed += 1
      } catch (err) {
        failed += 1
        const msg = err instanceof Error ? err.message : 'Candidate processing error'
        await doc.ref.update({
          status: 'failed',
          retryCount: (candidate.retryCount ?? 0) + 1,
          lastError: msg.slice(0, 500),
          updatedAt: new Date().toISOString(),
        })
      }
    }

    await updateAutomationSettings({ lastProcessAt: new Date().toISOString() })
    await writeScrapingLog({
      jobType: 'process',
      status: 'completed',
      summary: `Processed ${processed} candidates (${published} published, ${candidatesSaved} saved for review, ${duplicates} duplicates, ${failed} failed).`,
      metrics: { processed, published, candidatesSaved, duplicates, failed },
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })

    return { status: 'completed', processed, published, candidatesSaved, duplicates, failed }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch processing failed'
    await writeScrapingLog({
      jobType: 'process',
      status: 'failed',
      summary: 'Candidate processing failed.',
      metrics: { processed, published, failed },
      error: message,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
    throw err
  } finally {
    await releaseExecutionLock('process_candidates')
  }
}

export async function runVerifyJobsJob(force = false) {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const settings = await getAutomationSettings()

  if (!settings.enabled && !force) {
    return { status: 'disabled', checked: 0, updated: 0 }
  }

  const locked = await acquireExecutionLock('verify_jobs', 4 * 60 * 1000)
  if (!locked) {
    await writeScrapingLog({
      jobType: 'verify',
      status: 'skipped_locked',
      summary: 'Skipped job verification because another run is active.',
      metrics: {},
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
    return { status: 'locked', checked: 0, updated: 0 }
  }

  let checked = 0
  let updated = 0

  try {
    const db = getAdminDb()
    const limit = Math.max(1, Math.min(5, settings.maxVerifyPerRun || 5))
    const snap = await db
      .collection('jobs')
      .where('status', '==', 'published')
      .limit(limit)
      .get()

    for (const doc of snap.docs) {
      const job = doc.data() as {
        source_url?: string | null
        official_website_url?: string | null
        source_type?: string | null
      }
      const targetUrl = job.source_url || job.official_website_url
      if (!targetUrl) continue

      try {
        const scraped = await scrapeJobPage(targetUrl)
        await incrementUsageCounter('firecrawlRequestsToday', 1)

        const { officialWebsite, notificationPdf } = discoverOfficialNotification(
          scraped.links,
          targetUrl,
        )

        const bundle = await extractAndVerifyCandidate({
          markdown: scraped.markdown,
          sourceUrl: targetUrl,
          sourceName: 'Scheduled Verification',
          sourceType: job.source_type === 'official' ? 'official' : 'aggregator',
          discoveredOfficialWebsite: officialWebsite,
          discoveredNotificationPdf: notificationPdf,
          confidenceThreshold: settings.confidenceThreshold,
        })
        await incrementUsageCounter('cloudflareAiRequestsToday', 1)

        const syncResult = await syncCandidateToFirestore({
          normalized: bundle.normalized,
          sourceUrl: targetUrl,
          sourceType: job.source_type === 'official' ? 'official' : 'aggregator',
          verificationStatus: bundle.verificationStatus,
          autoPublishVerified: false,
        })

        if (syncResult.outcome === 'duplicate_updated') {
          updated += 1
        }
        checked += 1
      } catch {
        checked += 1
      }
    }

    await updateAutomationSettings({ lastVerifyAt: new Date().toISOString() })
    await writeScrapingLog({
      jobType: 'verify',
      status: 'completed',
      summary: `Checked ${checked} published jobs for updates (${updated} updated).`,
      metrics: { checked, updated },
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })

    return { status: 'completed', checked, updated }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification job failed'
    await writeScrapingLog({
      jobType: 'verify',
      status: 'failed',
      summary: 'Job verification failed.',
      metrics: { checked, updated },
      error: message,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
    throw err
  } finally {
    await releaseExecutionLock('verify_jobs')
  }
}

export async function runUpdateJobStatusJob() {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()

  const locked = await acquireExecutionLock('update_job_status', 2 * 60 * 1000)
  if (!locked) {
    return { status: 'locked', closedCount: 0 }
  }

  let closedCount = 0
  try {
    const db = getAdminDb()
    const today = new Date().toISOString().slice(0, 10)
    const snap = await db.collection('jobs').where('status', '==', 'published').get()

    const now = new Date().toISOString()
    for (const doc of snap.docs) {
      const data = doc.data() as { application_end_date?: string | null; slug?: string; title?: string }
      if (data.application_end_date && data.application_end_date < today) {
        await doc.ref.update({
          status: 'closed',
          updated_at: now,
          serverUpdatedAt: FieldValue.serverTimestamp(),
        })
        await db.collection('job_update_history').add({
          jobId: doc.id,
          slug: data.slug ?? '',
          title: data.title ?? '',
          changes: [{ field: 'status', previousValue: 'published', newValue: 'closed' }],
          sourceUrl: 'system-expiry-check',
          verified: true,
          createdAt: now,
          serverCreatedAt: FieldValue.serverTimestamp(),
        })
        closedCount += 1
      }
    }

    await updateAutomationSettings({ lastStatusUpdateAt: now })
    await writeScrapingLog({
      jobType: 'status_update',
      status: 'completed',
      summary: `Marked ${closedCount} expired recruitment listings as closed.`,
      metrics: { closedCount },
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })

    return { status: 'completed', closedCount }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status update failed'
    await writeScrapingLog({
      jobType: 'status_update',
      status: 'failed',
      summary: 'Expired job status update failed.',
      metrics: { closedCount },
      error: message,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
    throw err
  } finally {
    await releaseExecutionLock('update_job_status')
  }
}

export async function addSourceAndFetch(params: { url: string; name?: string }) {
  const db = getAdminDb()
  const normalized = normalizeUrl(params.url)
  const parsed = new URL(normalized)
  const hostname = parsed.hostname.replace(/^www\./, '')
  const sourceId = hostname.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const sourceType = isOfficialGovDomain(normalized) ? 'official' : 'aggregator'
  const sourceName = params.name?.trim() || hostname
  const now = new Date().toISOString()

  // Save or update website in job_sources
  await db
    .collection('job_sources')
    .doc(sourceId)
    .set(
      {
        id: sourceId,
        name: sourceName,
        baseUrl: parsed.origin,
        searchQueries: [`site:${hostname} recruitment notification 2026`],
        sourceType,
        enabled: true,
        priority: 1,
        rateLimitPerMinute: 10,
        lastDiscoveredAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    )

  // Step 1: Scrape the website URL directly and extract job links from that page
  let discoveredCount = 0
  const scraped = await scrapeJobPage(normalized)
  await incrementUsageCounter('firecrawlRequestsToday', 1)

  const pageLinks = extractJobLinksFromHomepage(scraped.markdown, scraped.links, normalized, 15)

  for (const hit of pageLinks) {
    const urlHash = hashString(hit.normalizedUrl)
    const existing = await db.collection('scraped_candidates').doc(urlHash).get()
    if (existing.exists) continue

    await db
      .collection('scraped_candidates')
      .doc(urlHash)
      .set({
        url: hit.url,
        normalizedUrl: hit.normalizedUrl,
        sourceId,
        sourceName,
        sourceType,
        title: hit.title,
        snippet: `Found on ${sourceName}`,
        contentHash: null,
        rawMarkdown: null,
        extractedData: null,
        extractionConfidence: null,
        missingFields: [],
        verificationStatus: 'pending_verification',
        verificationNotes: null,
        officialMatchUrl: null,
        status: 'pending',
        retryCount: 0,
        lastError: null,
        jobId: null,
        discoveredAt: now,
        processedAt: null,
        updatedAt: now,
        serverCreatedAt: FieldValue.serverTimestamp(),
      })
    discoveredCount += 1
  }

  // Step 2: If no sub-links were found (e.g. user pasted a single job post URL), extract that page directly
  if (pageLinks.length === 0) {
    const settings = await getAutomationSettings()
    const { officialWebsite, notificationPdf } = discoverOfficialNotification(
      scraped.links,
      normalized,
    )
    const bundle = await extractAndVerifyCandidate({
      markdown: scraped.markdown,
      sourceUrl: normalized,
      sourceName,
      sourceType,
      discoveredOfficialWebsite: officialWebsite,
      discoveredNotificationPdf: notificationPdf,
      confidenceThreshold: settings.confidenceThreshold,
    })
    await incrementUsageCounter('cloudflareAiRequestsToday', 1)

    if (bundle.normalized.data.title) {
      const urlHash = hashString(normalized)
      await db
        .collection('scraped_candidates')
        .doc(urlHash)
        .set({
          url: normalized,
          normalizedUrl: normalized,
          sourceId,
          sourceName,
          sourceType,
          title: bundle.normalized.data.title,
          snippet: bundle.normalized.data.shortDescription,
          contentHash: scraped.contentHash,
          rawMarkdown: scraped.markdown.slice(0, 12000),
          extractedData: bundle.normalized.data,
          extractionConfidence: bundle.extractionConfidence,
          missingFields: bundle.normalized.missingFields,
          verificationStatus: bundle.verificationStatus,
          verificationNotes: bundle.verificationNotes,
          officialMatchUrl: bundle.officialMatchUrl,
          status: 'candidate',
          retryCount: 0,
          lastError: null,
          jobId: null,
          discoveredAt: now,
          processedAt: now,
          updatedAt: now,
          serverCreatedAt: FieldValue.serverTimestamp(),
        })
      discoveredCount = 1
    }
  } else {
    // Best-effort supplemental search if homepage yielded few links
    if (discoveredCount < 3) {
      try {
        const hits = await searchJobSources(`site:${hostname} recruitment OR vacancy 2026`, 5)
        await incrementUsageCounter('firecrawlRequestsToday', 1)
        for (const hit of hits) {
          const urlHash = hashString(hit.normalizedUrl)
          const existing = await db.collection('scraped_candidates').doc(urlHash).get()
          if (existing.exists) continue
          await db
            .collection('scraped_candidates')
            .doc(urlHash)
            .set({
              url: hit.url,
              normalizedUrl: hit.normalizedUrl,
              sourceId,
              sourceName,
              sourceType,
              title: hit.title,
              snippet: hit.description,
              contentHash: null,
              rawMarkdown: null,
              extractedData: null,
              extractionConfidence: null,
              missingFields: [],
              verificationStatus: 'pending_verification',
              verificationNotes: null,
              officialMatchUrl: null,
              status: 'pending',
              retryCount: 0,
              lastError: null,
              jobId: null,
              discoveredAt: now,
              processedAt: null,
              updatedAt: now,
              serverCreatedAt: FieldValue.serverTimestamp(),
            })
          discoveredCount += 1
        }
      } catch {
        // Search fallback is optional
      }
    }
  }

  return { sourceId, sourceName, discoveredCount }
}

export async function scrapeSingleCandidate(candidateId: string) {
  const db = getAdminDb()
  const settings = await getAutomationSettings()
  const docRef = db.collection('scraped_candidates').doc(candidateId)
  const snap = await docRef.get()
  if (!snap.exists) throw new Error('Candidate not found.')

  const candidate = { id: snap.id, ...(snap.data() as Omit<ScrapedCandidate, 'id'>) }
  const scraped = await scrapeJobPage(candidate.url)
  await incrementUsageCounter('firecrawlRequestsToday', 1)

  const { officialWebsite, notificationPdf } = discoverOfficialNotification(
    scraped.links,
    candidate.url,
  )

  const bundle = await extractAndVerifyCandidate({
    markdown: scraped.markdown,
    sourceUrl: candidate.url,
    sourceName: candidate.sourceName,
    sourceType: candidate.sourceType,
    discoveredOfficialWebsite: officialWebsite,
    discoveredNotificationPdf: notificationPdf,
    confidenceThreshold: settings.confidenceThreshold,
  })
  await incrementUsageCounter('cloudflareAiRequestsToday', 1)

  const now = new Date().toISOString()
  await docRef.update({
    title: bundle.normalized.data.title || candidate.title,
    snippet: bundle.normalized.data.shortDescription || candidate.snippet,
    contentHash: scraped.contentHash,
    rawMarkdown: scraped.markdown.slice(0, 12000),
    extractedData: bundle.normalized.data,
    extractionConfidence: bundle.extractionConfidence,
    missingFields: bundle.normalized.missingFields,
    verificationStatus: bundle.verificationStatus,
    verificationNotes: bundle.verificationNotes,
    officialMatchUrl: bundle.officialMatchUrl,
    status: 'candidate',
    lastError: null,
    processedAt: now,
    updatedAt: now,
  })

  return { id: candidateId, title: bundle.normalized.data.title || candidate.title }
}

export async function publishCandidateById(candidateId: string) {
  const db = getAdminDb()
  const docRef = db.collection('scraped_candidates').doc(candidateId)
  const snap = await docRef.get()
  if (!snap.exists) throw new Error('Candidate not found.')

  const candidate = { id: snap.id, ...(snap.data() as Omit<ScrapedCandidate, 'id'>) }
  if (!candidate.extractedData) {
    throw new Error('Scrape this job first before publishing.')
  }

  const normalized = buildNormalizedResult(candidate.extractedData, 'ai')
  const result = await syncCandidateToFirestore({
    normalized,
    sourceUrl: candidate.url,
    sourceType: candidate.sourceType,
    verificationStatus: 'verified',
    autoPublishVerified: true,
    forcePublish: true,
  })

  if (!result.jobId) {
    throw new Error('Could not publish job. Check that it has a valid title.')
  }

  const now = new Date().toISOString()
  await docRef.update({
    status: 'published',
    verificationStatus: 'verified',
    jobId: result.jobId,
    updatedAt: now,
  })

  return { jobId: result.jobId, slug: result.slug ?? normalized.data.slug }
}
