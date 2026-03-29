// Phase 3 — Entity seeder
// Reads scraped JSON from scripts/data/ and inserts into SQLite entity tables.
// Uses INSERT OR REPLACE keyed on wiki_page_title (idempotent — safe to re-run).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

// Entity table → JSON file mapping (order doesn't matter)
const ENTITIES = [
  { table: "series", file: "scrape_series.json" },
  { table: "events", file: "scrape_events.json" },
  { table: "teams", file: "scrape_teams.json" },
  { table: "comics", file: "scrape_comics.json" },
  { table: "characters", file: "scrape_characters.json" },
];

/**
 * Get column names for a table from SQLite (excludes auto-increment `id`).
 */
function getColumns(table) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return info
    .filter((col) => col.name !== "id")
    .map((col) => col.name);
}

/**
 * Build a prepared INSERT OR REPLACE statement for a table.
 * Columns are derived from the DB schema, not the JSON — any extra JSON keys are ignored,
 * any missing JSON keys become null.
 */
function buildInsert(table, columns) {
  const colList = columns.join(", ");
  const placeholders = columns.map((c) => `@${c}`).join(", ");
  return db.prepare(
    `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Seeding entity tables...\n");

let totalInserted = 0;

for (const { table, file } of ENTITIES) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP ${table} — ${file} not found`);
    continue;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const columns = getColumns(table);
  const insert = buildInsert(table, columns);

  // Run all inserts for this entity in a single transaction
  const insertAll = db.transaction((rows) => {
    let count = 0;
    for (const row of rows) {
      // Build params object: map each DB column to the JSON value (or null)
      const params = {};
      for (const col of columns) {
        params[col] = row[col] ?? null;
      }
      insert.run(params);
      count++;
    }
    return count;
  });

  const count = insertAll(rows);
  console.log(`  ${table}: ${count.toLocaleString()} rows inserted`);
  totalInserted += count;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\nDone! ${totalInserted.toLocaleString()} total rows inserted.`);

// Verify counts
console.log("\nVerification:");
for (const { table } of ENTITIES) {
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
  console.log(`  ${table}: ${count.toLocaleString()} rows`);
}

db.close();
