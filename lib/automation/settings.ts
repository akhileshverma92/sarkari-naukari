import { FieldValue, getAdminDb } from '@/lib/firebase/admin'
import type { AutomationSettings, ScrapingLog } from './types'

const DEFAULT_SETTINGS: AutomationSettings = {
  enabled: true,
  autoPublishVerified: true,
  confidenceThreshold: 70,
  maxCandidatesPerRun: 3,
  maxVerifyPerRun: 5,
  firecrawlRequestsToday: 0,
  cloudflareAiRequestsToday: 0,
  usageResetDate: new Date().toISOString().slice(0, 10),
  lastDiscoveryAt: null,
  lastProcessAt: null,
  lastVerifyAt: null,
  lastStatusUpdateAt: null,
  updatedAt: new Date().toISOString(),
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const db = getAdminDb()
  const ref = db.collection('automation_settings').doc('default')
  const snap = await ref.get()
  const today = new Date().toISOString().slice(0, 10)

  if (!snap.exists) {
    await ref.set({ ...DEFAULT_SETTINGS, usageResetDate: today })
    return { ...DEFAULT_SETTINGS, usageResetDate: today }
  }

  const data = snap.data() as AutomationSettings
  if (data.usageResetDate !== today) {
    await ref.update({
      firecrawlRequestsToday: 0,
      cloudflareAiRequestsToday: 0,
      usageResetDate: today,
      updatedAt: new Date().toISOString(),
    })
    return {
      ...data,
      firecrawlRequestsToday: 0,
      cloudflareAiRequestsToday: 0,
      usageResetDate: today,
    }
  }

  return data
}

export async function updateAutomationSettings(
  patch: Partial<AutomationSettings>,
): Promise<AutomationSettings> {
  const db = getAdminDb()
  const ref = db.collection('automation_settings').doc('default')
  await getAutomationSettings()
  const next = {
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  await ref.update(next)
  const snap = await ref.get()
  return snap.data() as AutomationSettings
}

export async function incrementUsageCounter(
  field: 'firecrawlRequestsToday' | 'cloudflareAiRequestsToday',
  by = 1,
): Promise<void> {
  if (by <= 0) return
  const db = getAdminDb()
  await getAutomationSettings()
  await db
    .collection('automation_settings')
    .doc('default')
    .update({
      [field]: FieldValue.increment(by),
      updatedAt: new Date().toISOString(),
    })
}

export async function writeScrapingLog(
  log: Omit<ScrapingLog, 'id'>,
): Promise<string> {
  const db = getAdminDb()
  const ref = await db.collection('scraping_logs').add({
    ...log,
    serverCreatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function listScrapingLogs(limit = 25): Promise<ScrapingLog[]> {
  const db = getAdminDb()
  const snap = await db
    .collection('scraping_logs')
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ScrapingLog, 'id'>),
  }))
}
