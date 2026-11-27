'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Landmark, ArrowRight } from 'lucide-react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { getFirebaseAuth } from '@/lib/firebase/client'

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get('next') ?? '/'
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/'

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setMessage('')

    try {
      const auth = getFirebaseAuth()
      const credential =
        mode === 'login'
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password)

      const idToken = await credential.user.getIdToken()
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!res.ok) {
        setMessage('Could not establish your session. Please try again.')
        setPending(false)
        return
      }

      setPending(false)
      router.push(next)
      router.refresh()
    } catch (err: unknown) {
      setPending(false)
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/too-many-requests') {
        setMessage('Please wait a moment before trying again.')
      } else if (code === 'auth/email-already-in-use') {
        setMessage('An account with this email already exists.')
      } else if (mode === 'login') {
        setMessage('Invalid email or password.')
      } else {
        setMessage('Unable to create your account. Please check your details.')
      }
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Landmark />
          </span>
          <span>
            Sarkari<span className="brand-accent"> Naukari</span>
          </span>
        </Link>
        <span className="section-kicker">ASPIRANT ACCOUNT</span>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p>
          {mode === 'login'
            ? 'Sign in to save jobs and manage your applications.'
            : 'Register to save opportunities and get started.'}
        </p>
        {params.get('error') === 'unauthorized' && (
          <div className="form-alert">This account does not have administrator access.</div>
        )}
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {message && (
            <div role="status" className="form-alert">
              {message}
            </div>
          )}
          <Button className="auth-submit" type="submit" size="lg" disabled={pending}>
            {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}{' '}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              New here? <button onClick={() => setMode('signup')}>Create an account</button>
            </>
          ) : (
            <>
              Already registered? <button onClick={() => setMode('login')}>Sign in</button>
            </>
          )}
        </div>
        <Link className="auth-back" href="/">
          Back to Sarkari Naukari
        </Link>
      </div>
    </main>
  )
}
