import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  // Record the sync run
  const { data: run, error: runErr } = await supabase
    .from('sync_runs')
    .insert({
      provider: 'manual',
      status: 'success',
      started_at: new Date().toISOString(),
      message: clientId ? `Manual sync triggered for client ${clientId}` : 'Manual full sync triggered',
    })
    .select('id')
    .single()

  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 })

  // Spawn the sync script in the background (non-blocking)
  const projectRoot = path.resolve(process.cwd())
  const args = clientId
    ? ['tsx', 'scripts/syncAll.ts', '--clientId', clientId]
    : ['tsx', 'scripts/syncAll.ts']

  const child = spawn('npx', args, {
    cwd: projectRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  })
  child.unref()

  return NextResponse.json({ syncRunId: run.id, status: 'running' })
}
