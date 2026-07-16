import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { getGhlToken } from "./ghlToken";

type Client = {
  id: string;
  name: string;
  status: string;
  ghl_location_id: string | null;
};

// Spawn a child process with an injected GHL token in the environment
async function runCommand(
  cmd: string,
  args: string[],
  ghlToken?: string
): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env }
  if (ghlToken) env.GHL_ACCESS_TOKEN = ghlToken

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => (stdout += d.toString()))
    child.stderr.on("data", (d) => (stderr += d.toString()))
    child.on("error", (err) => reject(err))
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr })
      reject(new Error(`Command failed (${code}): ${cmd} ${args.join(" ")}\n${stderr || stdout}`))
    })
  })
}

function requireEnvVar(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing variable: ${name}`);
  return v;
}

// Fetch calendars from GHL API using a per-client token
async function fetchGhlCalendars(locationId: string, token: string): Promise<any[]> {
  const url = `https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Version: "2021-04-15",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHL API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) return data;
  if (data.calendars && Array.isArray(data.calendars)) return data.calendars;
  if (data.data && Array.isArray(data.data)) return data.data;
  return [];
}

// Get date range for sync. Accepts --days=N CLI arg (default 90).
// End date is always +30 days from today so future-booked appointments are included.
function getSyncDateRange(): { start: string; end: string } {
  const daysArg = process.argv.find(a => a.startsWith('--days='))
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : 90

  const end = new Date();
  end.setDate(end.getDate() + 30); // include future appointments
  const start = new Date();
  start.setDate(start.getDate() - days);

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? requireEnvVar("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = requireEnvVar("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Create sync run with required fields
  const { data: runRow, error: runErr } = await supabase
    .from("sync_runs")
    .insert({
      provider: "syncAll",
      status: "success", // Will update to failure if any dataset fails
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runErr) throw runErr;
  const syncRunId = runRow.id as string;

  console.log(`Starting sync run: ${syncRunId}`);

  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select("id,name,status,ghl_location_id")
    .in("status", ["active", "onboarding"]);
  if (clientErr) throw clientErr;

  for (const account of (clients ?? []) as Client[]) {
    if (!account.ghl_location_id) {
      console.log(`Skipping client (no GHL location ID): ${account.name} (${account.id})`);
      continue;
    }

    const locationId = account.ghl_location_id;
    console.log(`\nClient: ${account.name} (${account.id}) | GHL locationId=${locationId}`);

    // Get per-client OAuth token (falls back gracefully with a warning)
    let clientToken: string | undefined
    try {
      clientToken = await getGhlToken(account.id)
    } catch (e: any) {
      console.warn(`  ⚠ No OAuth token for ${account.name}: ${e.message}`)
      console.warn(`    → Connect this client's GHL account via Settings → GHL Integration`)
      continue
    }

    // Dataset 1: GHL users
    await runDataset({
      supabase,
      syncRunId,
      accountId: account.id,
      dataset: "ghl_users",
      fn: async () => {
        await runCommand("tsx", ["scripts/syncGhlUsers.ts", `--locationId=${locationId}`], clientToken);
      },
    });

    // Dataset 2: GHL calendars - fetch all calendars for this location
    let calendars: any[] = [];
    await runDataset({
      supabase,
      syncRunId,
      accountId: account.id,
      dataset: "ghl_calendars",
      fn: async () => {
        calendars = await fetchGhlCalendars(locationId, clientToken!);
        console.log(`   Found ${calendars.length} calendars`);
      },
    });

    // Dataset 3: GHL calendar events - sync events from each calendar
    const dateRange = getSyncDateRange();
    for (const calendar of calendars) {
      await runDataset({
        supabase,
        syncRunId,
        accountId: account.id,
        dataset: `ghl_calendar_events:${calendar.id}`,
        fn: async () => {
          await runCommand("tsx", [
            "scripts/syncGhlCalendarEvents.ts",
            `--locationId=${locationId}`,
            `--calendarId=${calendar.id}`,
            `--start=${dateRange.start}`,
            `--end=${dateRange.end}`,
          ], clientToken);
        },
      });
    }

  }

  // GHL calls: runs once for all clients (no per-client breakdown)
  console.log("\n→ Syncing GHL calls for all clients…")
  try {
    await runCommand("tsx", ["scripts/syncGhlCalls.ts"])
    console.log("✅ ghl_calls success")
  } catch (e: any) {
    console.error(`❌ ghl_calls error: ${e.message}`)
  }

  // Meta ads: runs once for all clients (uses META_ACCESS_TOKEN)
  if (process.env.META_ACCESS_TOKEN) {
    console.log("\n→ Syncing Meta ads for all clients…")
    try {
      await runCommand("tsx", ["scripts/syncMeta.ts"])
      console.log("✅ meta_ads success")
    } catch (e: any) {
      console.error(`❌ meta_ads error: ${e.message}`)
    }
  } else {
    console.log("\n⚠ Skipping Meta ads sync — META_ACCESS_TOKEN not set")
  }

  // Update sync run with completion time
  await supabase
    .from("sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      message: `Completed sync for ${(clients ?? []).length} clients`,
    })
    .eq("id", syncRunId);

  console.log(`\nDone. sync_run_id=${syncRunId}`);
}

async function runDataset(args: {
  supabase: ReturnType<typeof createClient>;
  syncRunId: string;
  accountId: string;
  dataset: string;
  fn: () => Promise<void>;
}) {
  const { supabase, syncRunId, accountId, dataset, fn } = args;

  try {
    await fn();

    const { error } = await supabase.from("sync_run_items").insert({
      sync_run_id: syncRunId,
      account_id: accountId,
      dataset,
      status: "success",
      processed_count: 0,
      success_count: 0,
      error_count: 0,
      error_message: null,
    });

    if (error) throw error;
    console.log(`✅ ${dataset} success`);
  } catch (e: any) {
    const message = e?.message ?? String(e);

    const { error } = await supabase.from("sync_run_items").insert({
      sync_run_id: syncRunId,
      account_id: accountId,
      dataset,
      status: "error",
      processed_count: 0,
      success_count: 0,
      error_count: 1,
      error_message: message,
    });

    if (error) throw error;
    console.error(`❌ ${dataset} error: ${message}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
