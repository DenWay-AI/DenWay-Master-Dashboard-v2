import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

if (!process.env.GHL_AGENCY_TOKEN && !process.env.GHL_ACCESS_TOKEN) {
  console.error('Missing GHL_AGENCY_TOKEN or GHL_ACCESS_TOKEN environment variable')
  process.exit(1)
}

const GHL_TOKEN = process.env.GHL_AGENCY_TOKEN ?? process.env.GHL_ACCESS_TOKEN!

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// CLI args schema
const cliArgsSchema = z.object({
  locationId: z.string().min(1, 'locationId is required'),
})

type CLIArgs = z.infer<typeof cliArgsSchema>

// Parse CLI args — falls back to DENWAY_GHL_LOCATION_ID env var
function parseCLIArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=')
      if (key && value) {
        parsed[key] = value
      }
    }
  }

  if (!parsed.locationId && process.env.DENWAY_GHL_LOCATION_ID) {
    parsed.locationId = process.env.DENWAY_GHL_LOCATION_ID
  }

  const result = cliArgsSchema.safeParse(parsed)
  if (!result.success) {
    console.error('Invalid CLI arguments:')
    result.error.errors.forEach((err) => {
      console.error(`  --${err.path.join('.')}: ${err.message}`)
    })
    console.error('\nUsage: npm run sync:ghl:users -- --locationId=...')
    console.error('       or set DENWAY_GHL_LOCATION_ID in .env.local')
    process.exit(1)
  }

  return result.data
}

// Fetch users from GHL API
async function fetchGhlUsers(locationId: string): Promise<any[]> {
  const url = `https://services.leadconnectorhq.com/users/?locationId=${locationId}`
  
  console.log(`   Requesting URL: ${url}`)
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Version': '2021-07-28',
      'Authorization': `Bearer ${GHL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GHL API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  
  // GHL API response structure may vary - handle common patterns
  // Assumption: users are in data.users or data array
  if (Array.isArray(data)) {
    return data
  } else if (data.users && Array.isArray(data.users)) {
    return data.users
  } else if (data.data && Array.isArray(data.data)) {
    return data.data
  } else {
    console.warn('Unexpected GHL API response structure, returning empty array')
    return []
  }
}

// Build name from user object
function buildUserName(user: any): string {
  if (user.name) {
    return user.name
  }
  // Fallback to first + last name if name is not available
  const parts = []
  if (user.firstName) parts.push(user.firstName)
  if (user.lastName) parts.push(user.lastName)
  if (parts.length > 0) {
    return parts.join(' ')
  }
  // Final fallback
  return user.email || `User ${user.id}` || 'Unknown User'
}

async function syncGhlUsers() {
  const args = parseCLIArgs()
  const syncRunId = randomUUID()

  console.log('🔄 Starting GHL users sync...')
  console.log(`   Location ID: ${args.locationId}`)

  // Create sync run record
  const { data: syncRun, error: syncRunError } = await supabase
    .from('sync_runs')
    .insert({
      id: syncRunId,
      provider: 'ghl_users',
      status: 'success', // Will update to failure if needed
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (syncRunError) {
    console.error('Error creating sync run:', syncRunError)
    process.exit(1)
  }

  try {
    // Fetch users from GHL
    const users = await fetchGhlUsers(args.locationId)
    console.log(`   Fetched ${users.length} users from GHL`)

    if (users.length === 0) {
      console.log('   No users found in GHL for this location')
    }

    // Process and upsert users
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const user of users) {
      try {
        if (!user.id) {
          throw new Error('User missing id field')
        }

        const userName = buildUserName(user)

        // Prepare rep data
        const repData = {
          ghl_user_id: user.id,
          name: userName,
        }

        // Check if rep already exists by ghl_user_id
        const { data: existingRep, error: checkError } = await supabase
          .from('reps')
          .select('id')
          .eq('ghl_user_id', user.id)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is OK
          throw new Error(`Error checking existing rep: ${checkError.message}`)
        }

        if (existingRep) {
          // Update existing rep
          const { error: updateError } = await supabase
            .from('reps')
            .update({ name: userName })
            .eq('id', existingRep.id)

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`)
          }
          successCount++
        } else {
          // Insert new rep
          const { error: insertError } = await supabase
            .from('reps')
            .insert(repData)

          if (insertError) {
            throw new Error(`Insert failed: ${insertError.message}`)
          }
          successCount++
        }
      } catch (error) {
        errorCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`User ${user.id || 'unknown'}: ${errorMsg}`)
        console.error(`   ⚠️  Error processing user ${user.id || 'unknown'}:`, errorMsg)
      }
    }

    // Update sync run with success
    await supabase
      .from('sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        message: `Synced ${successCount} users. ${errorCount} errors.`,
      })
      .eq('id', syncRunId)

    console.log('')
    console.log('✅ Sync completed successfully!')
    console.log(`   Processed: ${users.length} users`)
    console.log(`   Success: ${successCount}`)
    console.log(`   Errors: ${errorCount}`)

    if (errors.length > 0) {
      console.log('')
      console.log('Error details:')
      errors.slice(0, 10).forEach((err) => console.log(`   - ${err}`))
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`)
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('')
    console.error('❌ Sync failed:', errorMessage)

    // Update sync run with failure
    await supabase
      .from('sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failure',
        message: errorMessage,
      })
      .eq('id', syncRunId)

    process.exit(1)
  }
}

syncGhlUsers().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
