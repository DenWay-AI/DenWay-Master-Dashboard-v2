import { NextResponse } from 'next/server'
import { syncB2bContacts } from '@/lib/sync/ghlContactsSync'

async function handler() {
  try {
    const result = await syncB2bContacts()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
