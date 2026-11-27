import { createHash } from 'node:crypto'
import type { JobSource } from '@/lib/automation/types'

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1'
const DEFAULT_TIMEOUT_MS = 20_000
const MAX_CONTENT_CHARS = 28_000

export class FirecrawlConfigError extends Error {
  constructor(message = 'FIRECRAWL_API_KEY is not configured on the server.') {
    super(message)
    this.name = 'FirecrawlConfigError'
  }
}

export class FirecrawlApiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = 'FirecrawlApiError'
    this.status = status
  }
}

function getFirecrawlApiKey(): string {
  const key =
    process.env.FIRECRAWL_API_KEY?.trim() || process.env.NEXT_FIRECRAWL_API_KEY?.trim()
  if (!key) throw new FirecrawlConfigError()
  return key
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim())
    u.hash = ''
    for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid']) {
      u.searchParams.delete(param)
    }
    const str = u.toString()
    return str.endsWith('/') && u.pathname !== '/' ? str.slice(0, -1) : str
  } catch {
    return rawUrl.trim()
  }
}

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function isOfficialGovDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return (
      hostname.endsWith('.gov.in') ||
      hostname.endsWith('.nic.in') ||
      hostname.endsWith('.ac.in') ||
      hostname === 'ibps.in' ||
      hostname.endsWith('.ibps.in') ||
      hostname === 'nta.ac.in' ||
      hostname.endsWith('.nta.ac.in')
    )
  } catch {
    return false
  }
}

async function fetchWithRetry(
  path: string,
  body: Record<string, unknown>,
  retries = 2,
): Promise<Response> {
  const apiKey = getFirecrawlApiKey()
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const res = await fetch(`${FIRECRAWL_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timer)

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
          continue
        }
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err : new Error('Firecrawl request failed')
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        continue
      }
    }
  }

  throw new FirecrawlApiError(lastError?.message ?? 'Firecrawl request timed out', 504)
}

export type FirecrawlSearchHit = {
  url: string
  normalizedUrl: string
  title: string
  description: string | null
}

export async function searchJobSources(
  query: string,
  limit = 6,
): Promise<FirecrawlSearchHit[]> {
  const res = await fetchWithRetry('/search', {
    query,
    limit,
    lang: 'en',
    country: 'in',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new FirecrawlApiError(`Firecrawl search error (${res.status}): ${text.slice(0, 200)}`, res.status)
  }

  const json = (await res.json()) as {
    success?: boolean
    data?: Array<{ url?: string; title?: string; description?: string }>
  }

  const seen = new Set<string>()
  const hits: FirecrawlSearchHit[] = []

  for (const item of json.data ?? []) {
    if (!item.url) continue
    const normalized = normalizeUrl(item.url)
    if (seen.has(normalized)) continue
    seen.add(normalized)

    hits.push({
      url: item.url,
      normalizedUrl: normalized,
      title: (item.title ?? '').trim() || normalized,
      description: item.description?.trim() ?? null,
    })
  }

  return hits
}

export async function discoverJobPages(
  source: JobSource,
  limitPerQuery = 5,
): Promise<FirecrawlSearchHit[]> {
  const allHits: FirecrawlSearchHit[] = []
  const seen = new Set<string>()

  for (const query of source.searchQueries.slice(0, 2)) {
    const hits = await searchJobSources(query, limitPerQuery)
    for (const hit of hits) {
      if (seen.has(hit.normalizedUrl)) continue
      seen.add(hit.normalizedUrl)
      allHits.push(hit)
    }
  }

  return allHits
}

export type FirecrawlScrapeOutput = {
  url: string
  markdown: string
  links: string[]
  contentHash: string
  title: string | null
}

export async function scrapeJobPage(url: string): Promise<FirecrawlScrapeOutput> {
  const res = await fetchWithRetry('/scrape', {
    url,
    formats: ['markdown', 'links'],
    onlyMainContent: true,
    timeout: 15000,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new FirecrawlApiError(`Firecrawl scrape error (${res.status}): ${text.slice(0, 200)}`, res.status)
  }

  const json = (await res.json()) as {
    success?: boolean
    data?: {
      markdown?: string
      links?: string[]
      metadata?: { title?: string }
    }
  }

  const rawMarkdown = json.data?.markdown ?? ''
  const cleaned = extractPageContent(rawMarkdown)
  if (!cleaned) {
    throw new FirecrawlApiError('Firecrawl returned empty page content.', 422)
  }

  return {
    url,
    markdown: cleaned,
    links: Array.isArray(json.data?.links) ? json.data.links : [],
    contentHash: hashString(cleaned),
    title: json.data?.metadata?.title ?? null,
  }
}

export function extractPageContent(markdown: string): string {
  return markdown
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CONTENT_CHARS)
}

export function discoverOfficialNotification(
  links: string[],
  sourceUrl: string,
): { officialWebsite: string | null; notificationPdf: string | null } {
  let officialWebsite: string | null = isOfficialGovDomain(sourceUrl)
    ? new URL(sourceUrl).origin
    : null
  let notificationPdf: string | null = null

  for (const link of links) {
    try {
      const parsed = new URL(link)
      if (!['http:', 'https:'].includes(parsed.protocol)) continue

      const lower = parsed.toString().toLowerCase()
      const isOfficial = isOfficialGovDomain(lower)

      if (isOfficial && !officialWebsite) {
        officialWebsite = parsed.origin
      }
      if (isOfficial && lower.endsWith('.pdf') && !notificationPdf) {
        notificationPdf = parsed.toString()
      } else if (lower.endsWith('.pdf') && !notificationPdf && lower.includes('notif')) {
        notificationPdf = parsed.toString()
      }
    } catch {
      continue
    }
  }

  return { officialWebsite, notificationPdf }
}

const SKIP_PATH_RE =
  /\/(about|contact|privacy|terms|disclaimer|login|register|signup|search|tag|author|wp-json|feed|sitemap|cdn-cgi)\b/i

const ASSET_EXT_RE = /\.(png|jpe?g|gif|svg|webp|ico|css|js|xml|zip)$/i

export function extractJobLinksFromHomepage(
  markdown: string,
  links: string[],
  homeUrl: string,
  limit = 20,
): Array<{ url: string; normalizedUrl: string; title: string }> {
  let homeHost = ''
  try {
    homeHost = new URL(homeUrl).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return []
  }

  const results: Array<{ url: string; normalizedUrl: string; title: string }> = []
  const seen = new Set<string>([normalizeUrl(homeUrl)])

  // 1. Parse [Anchor Text](https://...) from scraped markdown first (gives clean job titles!)
  const mdLinkRe = /\[([^\]]{6,140})\]\((https?:\/\/[^\s)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = mdLinkRe.exec(markdown)) !== null) {
    if (results.length >= limit) break
    const rawTitle = match[1].replace(/\s+/g, ' ').trim()
    const rawUrl = match[2].trim()
    try {
      const u = new URL(rawUrl)
      const host = u.hostname.replace(/^www\./, '').toLowerCase()
      if (host !== homeHost && !host.endsWith(`.${homeHost}`)) continue
      if (u.pathname === '/' || SKIP_PATH_RE.test(u.pathname) || ASSET_EXT_RE.test(u.pathname)) {
        continue
      }
      const norm = normalizeUrl(rawUrl)
      if (seen.has(norm)) continue
      seen.add(norm)
      results.push({ url: rawUrl, normalizedUrl: norm, title: rawTitle })
    } catch {
      continue
    }
  }

  // 2. Fallback to Firecrawl links array if markdown had few links
  if (results.length < limit) {
    for (const rawUrl of links) {
      if (results.length >= limit) break
      try {
        const u = new URL(rawUrl)
        const host = u.hostname.replace(/^www\./, '').toLowerCase()
        if (host !== homeHost && !host.endsWith(`.${homeHost}`)) continue
        if (u.pathname === '/' || SKIP_PATH_RE.test(u.pathname) || ASSET_EXT_RE.test(u.pathname)) {
          continue
        }
        const norm = normalizeUrl(rawUrl)
        if (seen.has(norm)) continue
        seen.add(norm)
        const slugTitle =
          u.pathname
            .split('/')
            .filter(Boolean)
            .pop()
            ?.replace(/[-_]+/g, ' ')
            .replace(/\.\w+$/, '') ?? norm
        results.push({
          url: rawUrl,
          normalizedUrl: norm,
          title: slugTitle.length >= 4 ? slugTitle : norm,
        })
      } catch {
        continue
      }
    }
  }

  return results
}
