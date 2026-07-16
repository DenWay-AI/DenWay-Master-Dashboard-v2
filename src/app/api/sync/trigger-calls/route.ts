import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST() {
  const projectRoot = path.resolve(process.cwd())

  const child = spawn('npx', ['tsx', 'scripts/syncGhlCalls.ts'], {
    cwd: projectRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  })
  child.unref()

  return NextResponse.json({ status: 'started' })
}
