import { NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/automation/cron-auth'
import { runVerifyJobsJob } from '@/lib/automation/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runVerifyJobsJob(false)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 },
    )
  }
}
