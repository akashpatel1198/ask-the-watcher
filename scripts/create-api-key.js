// Creates an API key and inserts its hash into Supabase api_keys table.
// Usage: node scripts/create-api-key.js [email] [tier]
// Prints the raw key — store it securely, it cannot be recovered.

import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const email = process.argv[2] || null;
const tier = process.argv[3] || "free";

const rawKey = crypto.randomUUID();
const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

const { error } = await supabase
  .from("api_keys")
  .insert({ key_hash: hash, user_email: email, tier });

if (error) {
  console.error("Failed to insert API key:", error.message);
  process.exit(1);
}

console.log(`API key created successfully.`);
console.log(`Key:   ${rawKey}`);
console.log(`Email: ${email || "(none)"}`);
console.log(`Tier:  ${tier}`);
console.log(`\nStore this key — it cannot be recovered.`);
