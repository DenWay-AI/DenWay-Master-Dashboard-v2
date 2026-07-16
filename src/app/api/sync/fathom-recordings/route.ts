import { NextResponse } from 'next/server'
import { syncFathomRecordings } from '@/lib/sync/fathomSync'

async function run() {
  try {
    const result = await syncFathomRecordings()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export const GET = run
export const POST = run
