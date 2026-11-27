import { cookies } from 'next/headers'
import { firebaseConfig } from './config'

export const SESSION_COOKIE_NAME = 'fb_token'

export type AuthUser = {
  uid: string
  email: string | null
  idToken: string
}

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }

type FirestoreDocument = {
  name: string
  fields?: Record<string, FirestoreValue>
  createTime?: string
  updateTime?: string
}

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) }
    return { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } }
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v)
      }
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(value) }
}

function fromFirestoreValue(val: FirestoreValue): unknown {
  if ('nullValue' in val) return null
  if ('booleanValue' in val) return val.booleanValue
  if ('integerValue' in val) return Number(val.integerValue)
  if ('doubleValue' in val) return Number(val.doubleValue)
  if ('stringValue' in val) return val.stringValue
  if ('timestampValue' in val) return val.timestampValue
  if ('arrayValue' in val) {
    return (val.arrayValue.values ?? []).map(fromFirestoreValue)
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val.mapValue.fields ?? {})) {
      out[k] = fromFirestoreValue(v)
    }
    return out
  }
  return null
}

function docToObject<T extends Record<string, unknown>>(doc: FirestoreDocument): T & { id: string } {
  const id = doc.name.split('/').pop() ?? ''
  const out: Record<string, unknown> = { id }
  for (const [k, v] of Object.entries(doc.fields ?? {})) {
    out[k] = fromFirestoreValue(v)
  }
  return out as T & { id: string }
}

function toFirestoreFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v)
    }
  }
  return fields
}

function authHeaders(idToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (idToken) headers.Authorization = `Bearer ${idToken}`
  return headers
}

export async function verifyIdToken(idToken: string): Promise<AuthUser | null> {
  if (!idToken) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { users?: Array<{ localId: string; email?: string }> }
    const user = data.users?.[0]
    if (!user?.localId) return null
    return {
      uid: user.localId,
      email: user.email ?? null,
      idToken,
    }
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifyIdToken(token)
}

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? 'akkupatel055@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
)

export async function isAdminUser(user: AuthUser | null): Promise<boolean> {
  if (!user) return false
  if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return true
  }
  const doc = await fsGetDoc('admin_users', user.uid, user.idToken)
  return Boolean(doc)
}

export async function fsGetDoc<T extends Record<string, unknown> = Record<string, unknown>>(
  collection: string,
  id: string,
  idToken?: string,
): Promise<(T & { id: string }) | null> {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/${collection}/${encodeURIComponent(id)}`, {
      headers: authHeaders(idToken),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const doc = (await res.json()) as FirestoreDocument
    return docToObject<T>(doc)
  } catch {
    return null
  }
}

export async function fsListDocs<T extends Record<string, unknown> = Record<string, unknown>>(
  collection: string,
  idToken?: string,
  pageSize = 500,
): Promise<Array<T & { id: string }>> {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/${collection}?pageSize=${pageSize}`, {
      headers: authHeaders(idToken),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { documents?: FirestoreDocument[] }
    return (data.documents ?? []).map((doc) => docToObject<T>(doc))
  } catch {
    return []
  }
}

export async function fsQueryPublicJobs<T extends Record<string, unknown> = Record<string, unknown>>(
  limit = 500,
): Promise<Array<T & { id: string }>> {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'jobs' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'IN',
              value: {
                arrayValue: {
                  values: [{ stringValue: 'published' }, { stringValue: 'closed' }],
                },
              },
            },
          },
          limit,
        },
      }),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const rows = (await res.json()) as Array<{ document?: FirestoreDocument }>
    return rows
      .filter((row): row is { document: FirestoreDocument } => Boolean(row.document))
      .map((row) => docToObject<T>(row.document))
  } catch {
    return []
  }
}

export async function fsCreateDoc<T extends Record<string, unknown> = Record<string, unknown>>(
  collection: string,
  data: Record<string, unknown>,
  idToken?: string,
  docId?: string,
): Promise<T & { id: string }> {
  const url = docId
    ? `${FIRESTORE_BASE_URL}/${collection}?documentId=${encodeURIComponent(docId)}`
    : `${FIRESTORE_BASE_URL}/${collection}`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Firestore create failed (${res.status}): ${errText}`)
  }
  const doc = (await res.json()) as FirestoreDocument
  return docToObject<T>(doc)
}

export async function fsSetDoc<T extends Record<string, unknown> = Record<string, unknown>>(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  idToken?: string,
): Promise<T & { id: string }> {
  const res = await fetch(`${FIRESTORE_BASE_URL}/${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(idToken),
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Firestore set failed (${res.status}): ${errText}`)
  }
  const doc = (await res.json()) as FirestoreDocument
  return docToObject<T>(doc)
}

export async function fsUpdateDoc<T extends Record<string, unknown> = Record<string, unknown>>(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  idToken?: string,
): Promise<T & { id: string }> {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined)
  const params = new URLSearchParams()
  for (const [k] of entries) {
    params.append('updateMask.fieldPaths', k)
  }
  const res = await fetch(
    `${FIRESTORE_BASE_URL}/${collection}/${encodeURIComponent(id)}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: authHeaders(idToken),
      body: JSON.stringify({ fields: toFirestoreFields(Object.fromEntries(entries)) }),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Firestore update failed (${res.status}): ${errText}`)
  }
  const doc = (await res.json()) as FirestoreDocument
  return docToObject<T>(doc)
}

export async function fsDeleteDoc(
  collection: string,
  id: string,
  idToken?: string,
): Promise<void> {
  const res = await fetch(`${FIRESTORE_BASE_URL}/${collection}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Firestore delete failed (${res.status}): ${errText}`)
  }
}
