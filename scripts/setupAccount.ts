import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function requireEnvVar(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required variable: ${name}`);
  return v;
}

// CLI args schema
const cliArgsSchema = z.object({
  locationId: z.string().min(1, "locationId is required"),
  accountName: z.string().optional(),
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

  const result = cliArgsSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Invalid CLI arguments:");
    result.error.errors.forEach((err) => {
      console.error(`  --${err.path.join(".")}: ${err.message}`);
    });
    console.error("\nUsage: npm run setup:account -- --locationId=<ghl_location_id> [--accountName=<name>]");
    process.exit(1);
  }

  return result.data;
}

async function main() {
  const args = parseCLIArgs();
  
  const SUPABASE_URL = requireEnvVar("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = requireEnvVar("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const accountName = args.accountName || "DenWay";
  const accountId = "a0000000-0000-0000-0000-000000000001";

  console.log("🔧 Setting up account...");
  console.log(`   Account Name: ${accountName}`);
  console.log(`   GHL Location ID: ${args.locationId}`);

  // Upsert account
  const { error: accountError } = await supabase
    .from("accounts")
    .upsert({
      id: accountId,
      type: "DENWAY_B2B",
      name: accountName,
      is_active: true,
    }, {
      onConflict: "id",
    });

  if (accountError) {
    console.error("❌ Failed to create account:", accountError.message);
    process.exit(1);
  }

  console.log("✅ Account created/updated");

  // Upsert account source (GHL)
  const { error: sourceError } = await supabase
    .from("account_sources")
    .upsert({
      account_id: accountId,
      source: "GHL",
      external_id: args.locationId,
      is_active: true,
    }, {
      onConflict: "account_id,source",
    });

  if (sourceError) {
    console.error("❌ Failed to create account source:", sourceError.message);
    process.exit(1);
  }

  console.log("✅ GHL source linked");

  // Also update/create the client record for backwards compatibility
  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("ghl_location_id", args.locationId)
    .single();

  if (!existingClient) {
    const { error: clientError } = await supabase
      .from("clients")
      .insert({
        name: accountName,
        ghl_location_id: args.locationId,
        status: "active",
      });

    if (clientError) {
      console.error("⚠️  Failed to create client (non-critical):", clientError.message);
    } else {
      console.log("✅ Client record created for backwards compatibility");
    }
  } else {
    console.log("✅ Client record already exists");
  }

  console.log("\n🎉 Setup complete! You can now run:");
  console.log("   npm run sync:all");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
