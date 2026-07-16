import { NextResponse } from 'next/server'
import { syncB2bAppointments } from '@/lib/sync/b2bGhlSync'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const daysBack: number = Number(body.daysBack) || 30
    const daysForward: number = Number(body.daysForward) || 7
    const calendarIds: string[] | undefined = body.calendarIds ?? undefined

    const result = await syncB2bAppointments({ daysBack, daysForward, calendarIds })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// Historical backfill endpoint — GET /api/sync/b2b-appointments?backfill=1
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const backfill = searchParams.get('backfill') === '1'
  const daysBack = backfill ? 730 : 30

  try {
    const result = await syncB2bAppointments({ daysBack, daysForward: 14 })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
