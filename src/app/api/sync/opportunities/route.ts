import { NextResponse } from 'next/server'
import { syncB2bOpportunities } from '@/lib/sync/ghlOpportunitiesSync'

async function run() {
  try {
    const result = await syncB2bOpportunities()
    return NextResponse.json(result, { status: result.errors.length ? 207 : 200 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export const GET = run
export const POST = run
