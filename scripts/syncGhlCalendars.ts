import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";

function requireEnvVar(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required variable: ${name}`);
  return v;
}

const GHL_ACCESS_TOKEN = process.env.GHL_AGENCY_TOKEN ?? requireEnvVar("GHL_ACCESS_TOKEN");
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? requireEnvVar("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnvVar("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// CLI args schema
const cliArgsSchema = z.object({
  locationId: z.string().min(1, "locationId is required"),
});

function parseCLIArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.substring(2).split("=");
      if (key && value) {
        parsed[key] = value;
      }
    }
  }

  if (!parsed.locationId && process.env.DENWAY_GHL_LOCATION_ID) {
    parsed.locationId = process.env.DENWAY_GHL_LOCATION_ID;
  }

  const result = cliArgsSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Invalid CLI arguments:");
    result.error.errors.forEach((err) => {
      console.error(`  --${err.path.join(".")}: ${err.message}`);
    });
    console.error("\nUsage: npm run sync:ghl:calendars -- --locationId=<ghl_location_id>");
    console.error("       or set DENWAY_GHL_LOCATION_ID in .env.local");
    process.exit(1);
  }

  return result.data;
}

// Fetch calendars from GHL API
async function fetchGhlCalendars(locationId: string): Promise<any[]> {
  const url = `https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`;

  console.log(`   Fetching calendars from: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Version: "2021-04-15",
      Authorization: `Bearer ${GHL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHL API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Handle different response structures
  if (Array.isArray(data)) {
    return data;
  } else if (data.calendars && Array.isArray(data.calendars)) {
    return data.calendars;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else {
    console.warn("Unexpected GHL API response structure:", JSON.stringify(data).slice(0, 200));
    return [];
  }
}

async function main() {
  const args = parseCLIArgs();
  const syncRunId = randomUUID();

  console.log("🔄 Starting GHL calendars sync...");
  console.log(`   Location ID: ${args.locationId}`);

  // Create sync run record
  const { error: syncRunError } = await supabase.from("sync_runs").insert({
    id: syncRunId,
    provider: "ghl_calendars",
    status: "success",
    started_at: new Date().toISOString(),
  });

  if (syncRunError) {
    console.error("Error creating sync run:", syncRunError);
    process.exit(1);
  }

  try {
    const calendars = await fetchGhlCalendars(args.locationId);
    console.log(`   Fetched ${calendars.length} calendars from GHL`);

    if (calendars.length === 0) {
      console.log("   No calendars found for this location");
    } else {
      console.log("\n📅 Calendars found:");
      calendars.forEach((cal, i) => {
        console.log(`   ${i + 1}. ${cal.name || "Unnamed"} (ID: ${cal.id})`);
        if (cal.description) {
          console.log(`      Description: ${cal.description}`);
        }
      });
    }

    // Find client by ghl_location_id
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("ghl_location_id", args.locationId)
      .single();

    if (clientError || !client) {
      console.warn(`\n⚠️  No client found for locationId: ${args.locationId}`);
      console.warn("   Calendar IDs are shown above - use them with sync:ghl script");
    } else {
      // Store calendar IDs in client config (if we had a config column)
      // For now, just log them
      console.log(`\n✅ Client found: ${client.id}`);
      console.log("\n📋 To sync events from a calendar, run:");
      calendars.forEach((cal) => {
        console.log(
          `   npm run sync:ghl -- --locationId=${args.locationId} --calendarId=${cal.id} --start=2025-01-01 --end=2025-12-31`
        );
      });
    }

    // Update sync run
    await supabase
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        message: `Found ${calendars.length} calendars`,
      })
      .eq("id", syncRunId);

    console.log("\n✅ Calendars sync complete!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Sync failed:", errorMessage);

    await supabase
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failure",
        message: errorMessage,
      })
      .eq("id", syncRunId);

    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
