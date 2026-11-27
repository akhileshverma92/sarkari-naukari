import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, verifyIdToken } from '@/lib/firebase/server'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string }
    const idToken = body.idToken?.trim()
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }
    const user = await verifyIdToken(idToken)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, idToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60, // 1 hour (Firebase ID token lifetime)
    })
    return NextResponse.json({ ok: true, uid: user.uid })
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  return NextResponse.json({ ok: true })
}
