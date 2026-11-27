import { cert, getApp, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore'

export class FirebaseAdminConfigError extends Error {
  constructor(
    message = 'FIREBASE_SERVICE_ACCOUNT is not configured on the server.',
  ) {
    super(message)
    this.name = 'FirebaseAdminConfigError'
  }
}

function parseServiceAccount(): ServiceAccount | null {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT?.trim() ||
    process.env.NEXT_FIREBASE_SERVICE_ACCOUNT?.trim()
  if (raw) {
    try {
      const jsonStr = raw.startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf8')
      const parsed = JSON.parse(jsonStr) as ServiceAccount & {
        project_id?: string
        client_email?: string
        private_key?: string
      }
      return {
        projectId: parsed.projectId ?? parsed.project_id,
        clientEmail: parsed.clientEmail ?? parsed.client_email,
        privateKey: (parsed.privateKey ?? parsed.private_key)?.replace(/\\n/g, '\n'),
      }
    } catch {
      throw new FirebaseAdminConfigError(
        'FIREBASE_SERVICE_ACCOUNT is invalid JSON or base64 JSON.',
      )
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey }
  }

  return null
}

export function isFirebaseAdminConfigured(): boolean {
  try {
    return parseServiceAccount() !== null
  } catch {
    return false
  }
}

export function getAdminDb(): Firestore {
  const existing = getApps()
  if (existing.length > 0) {
    return getFirestore(getApp())
  }

  const serviceAccount = parseServiceAccount()
  if (!serviceAccount) {
    throw new FirebaseAdminConfigError()
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
  })
  return getFirestore(app)
}

export { FieldValue }

export async function acquireExecutionLock(
  lockId: string,
  ttlMs = 4 * 60 * 1000,
): Promise<boolean> {
  const db = getAdminDb()
  const lockRef = db.collection('automation_locks').doc(lockId)
  const now = Date.now()

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef)
    const data = snap.data() as { expiresAt?: number } | undefined
    if (snap.exists && data?.expiresAt && data.expiresAt > now) {
      return false
    }
    tx.set(lockRef, {
      lockId,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      updatedAt: FieldValue.serverTimestamp(),
    })
    return true
  })
}

export async function releaseExecutionLock(lockId: string): Promise<void> {
  try {
    const db = getAdminDb()
    await db.collection('automation_locks').doc(lockId).delete()
  } catch {
    // Best-effort release
  }
}
