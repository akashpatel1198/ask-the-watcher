// Creates an API key and inserts its hash into the api_keys table.
// Usage: node scripts/create-api-key.js [email] [tier]
// Prints the raw key — store it securely, it cannot be recovered.

import crypto from "crypto";
import db from "../lib/db.js";

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL UNIQUE,
    user_email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    tier TEXT DEFAULT 'free'
  )
`);

const email = process.argv[2] || null;
const tier = process.argv[3] || "free";

const rawKey = crypto.randomUUID();
const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

db.prepare("INSERT INTO api_keys (key_hash, user_email, tier) VALUES (?, ?, ?)").run(
  hash,
  email,
  tier
);

console.log(`API key created successfully.`);
console.log(`Key:   ${rawKey}`);
console.log(`Email: ${email || "(none)"}`);
console.log(`Tier:  ${tier}`);
console.log(`\nStore this key — it cannot be recovered.`);
