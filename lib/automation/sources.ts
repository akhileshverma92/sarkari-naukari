import { FieldValue, getAdminDb } from '@/lib/firebase/admin'
import type { JobSource } from './types'

export const DEFAULT_JOB_SOURCES: Array<
  Omit<JobSource, 'lastDiscoveredAt' | 'createdAt' | 'updatedAt'>
> = [
  {
    id: 'upsc',
    name: 'UPSC (Union Public Service Commission)',
    baseUrl: 'https://upsc.gov.in',
    searchQueries: ['site:upsc.gov.in recruitment notification 2026'],
    sourceType: 'official',
    enabled: true,
    priority: 1,
    rateLimitPerMinute: 10,
  },
  {
    id: 'ssc',
    name: 'SSC (Staff Selection Commission)',
    baseUrl: 'https://ssc.gov.in',
    searchQueries: ['site:ssc.gov.in notice recruitment 2026'],
    sourceType: 'official',
    enabled: true,
    priority: 1,
    rateLimitPerMinute: 10,
  },
  {
    id: 'uppsc',
    name: 'UPPSC (Uttar Pradesh PSC)',
    baseUrl: 'https://uppsc.up.nic.in',
    searchQueries: ['site:uppsc.up.nic.in notification recruitment 2026'],
    sourceType: 'official',
    enabled: true,
    priority: 2,
    rateLimitPerMinute: 10,
  },
  {
    id: 'upsssc',
    name: 'UPSSSC',
    baseUrl: 'https://upsssc.gov.in',
    searchQueries: ['site:upsssc.gov.in advertisement recruitment 2026'],
    sourceType: 'official',
    enabled: true,
    priority: 2,
    rateLimitPerMinute: 10,
  },
  {
    id: 'bpsc',
    name: 'BPSC (Bihar PSC)',
    baseUrl: 'https://bpsc.bih.nic.in',
    searchQueries: ['site:bpsc.bih.nic.in advertisement 2026'],
    sourceType: 'official',
    enabled: true,
    priority: 2,
    rateLimitPerMinute: 10,
  },
  {
    id: 'rrb',
    name: 'Railway Recruitment Boards (RRB)',
    baseUrl: 'https://www.rrbcdg.gov.in',
    searchQueries: ['"Railway Recruitment Board" CEN recruitment notification 2026 site:gov.in'],
    sourceType: 'official',
    enabled: true,
    priority: 1,
    rateLimitPerMinute: 10,
  },
  {
    id: 'police',
    name: 'State Police Recruitment Boards',
    baseUrl: 'https://uppbpb.gov.in',
    searchQueries: ['police constable SI recruitment notification 2026 site:gov.in'],
    sourceType: 'official',
    enabled: true,
    priority: 2,
    rateLimitPerMinute: 10,
  },
  {
    id: 'ibps',
    name: 'Banking Recruitment (IBPS / SBI)',
    baseUrl: 'https://www.ibps.in',
    searchQueries: ['site:ibps.in CRP PO Clerk recruitment 2026'],
    sourceType: 'official',
    enabled: true,
    priority: 2,
    rateLimitPerMinute: 10,
  },
  {
    id: 'employment-news',
    name: 'Employment News',
    baseUrl: 'https://employmentnews.gov.in',
    searchQueries: ['site:employmentnews.gov.in recruitment vacancy 2026'],
    sourceType: 'official',
    enabled: true,
    priority: 2,
    rateLimitPerMinute: 10,
  },
  {
    id: 'sarkari-result',
    name: 'Sarkari Result',
    baseUrl: 'https://sarkariresult.com.cm',
    searchQueries: ['site:sarkariresult.com.cm latest job online form 2026'],
    sourceType: 'aggregator',
    enabled: true,
    priority: 3,
    rateLimitPerMinute: 8,
  },
  {
    id: 'free-job-alert',
    name: 'Free Job Alert',
    baseUrl: 'https://www.freejobalert.com',
    searchQueries: ['site:freejobalert.com government jobs notification 2026'],
    sourceType: 'aggregator',
    enabled: true,
    priority: 3,
    rateLimitPerMinute: 8,
  },
]

export async function ensureDefaultSources(): Promise<void> {
  const db = getAdminDb()
  const snap = await db.collection('job_sources').limit(1).get()
  if (!snap.empty) return

  const now = new Date().toISOString()
  const batch = db.batch()
  for (const src of DEFAULT_JOB_SOURCES) {
    const ref = db.collection('job_sources').doc(src.id)
    batch.set(ref, {
      ...src,
      lastDiscoveredAt: null,
      createdAt: now,
      updatedAt: now,
      serverCreatedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}

export async function listJobSources(): Promise<JobSource[]> {
  await ensureDefaultSources()
  const db = getAdminDb()
  const snap = await db.collection('job_sources').orderBy('priority', 'asc').get()
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<JobSource, 'id'>) }))
}

export async function toggleJobSource(id: string, enabled: boolean): Promise<void> {
  const db = getAdminDb()
  await db.collection('job_sources').doc(id).update({
    enabled,
    updatedAt: new Date().toISOString(),
  })
}
