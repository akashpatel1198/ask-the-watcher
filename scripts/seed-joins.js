// Phase 3 — Join table seeder
// Reads join JSON from scripts/data/ and inserts into SQLite join tables.
// Validates both FK sides exist before inserting. Logs failures with details.
//
// Run AFTER seed-entities.js — both sides of every join must exist first.
//
// Outputs: scripts/data/seed_joins_report.json
//   { table, inserted, skipped, failures: [{ row, missing: { side_a, side_b } }] }

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

// Join table definitions: which entity tables each FK references
const JOINS = [
  {
    table: "character_teams",
    file: "joins_character_teams.json",
    fks: [
      { col: "character_wiki_page_title", entity_table: "characters" },
      { col: "team_wiki_page_title", entity_table: "teams" },
    ],
    extra_cols: ["role"],
  },
  {
    table: "character_events",
    file: "joins_character_events.json",
    fks: [
      { col: "character_wiki_page_title", entity_table: "characters" },
      { col: "event_wiki_page_title", entity_table: "events" },
    ],
    extra_cols: ["role"],
  },
  {
    table: "comic_characters",
    file: "joins_comic_characters.json",
    fks: [
      { col: "comic_wiki_page_title", entity_table: "comics" },
      { col: "character_wiki_page_title", entity_table: "characters" },
    ],
    extra_cols: ["appearance_type"],
  },
  {
    table: "event_comics",
    file: "joins_event_comics.json",
    fks: [
      { col: "event_wiki_page_title", entity_table: "events" },
      { col: "comic_wiki_page_title", entity_table: "comics" },
    ],
    extra_cols: ["reading_order", "type"],
  },
];

/**
 * Build a Set of all wiki_page_title values in a given entity table.
 * Used for fast FK existence checks (avoids per-row queries).
 */
function loadEntityKeys(entityTable) {
  const rows = db
    .prepare(`SELECT wiki_page_title FROM ${entityTable}`)
    .all();
  return new Set(rows.map((r) => r.wiki_page_title));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Seeding join tables...\n");

// Pre-load all entity key sets
const entityKeys = {};
const entityTables = ["characters", "comics", "series", "teams", "events"];
for (const t of entityTables) {
  entityKeys[t] = loadEntityKeys(t);
  console.log(`  Loaded ${entityKeys[t].size.toLocaleString()} keys from ${t}`);
}
console.log();

const report = [];

for (const { table, file, fks, extra_cols } of JOINS) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP ${table} — ${file} not found`);
    continue;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Build INSERT statement
  const allCols = [...fks.map((f) => f.col), ...extra_cols];
  const colList = allCols.join(", ");
  const placeholders = allCols.map((c) => `@${c}`).join(", ");
  const insert = db.prepare(
    `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`
  );

  const failures = [];
  let inserted = 0;

  const insertAll = db.transaction((rows) => {
    for (const row of rows) {
      // Check both FK sides
      const missing = {};
      for (const fk of fks) {
        const val = row[fk.col];
        if (!val || !entityKeys[fk.entity_table].has(val)) {
          missing[fk.col] = val || null;
        }
      }

      if (Object.keys(missing).length > 0) {
        failures.push({ row, missing });
        continue;
      }

      // Build params
      const params = {};
      for (const col of allCols) {
        params[col] = row[col] ?? null;
      }
      insert.run(params);
      inserted++;
    }
  });

  insertAll(rows);

  const tableReport = {
    table,
    total: rows.length,
    inserted,
    skipped: failures.length,
    failures,
  };
  report.push(tableReport);

  console.log(
    `  ${table}: ${inserted.toLocaleString()} inserted, ${failures.length.toLocaleString()} skipped (${rows.length.toLocaleString()} total)`
  );
}

// ---------------------------------------------------------------------------
// Write report
// ---------------------------------------------------------------------------

const reportPath = path.join(DATA_DIR, "seed_joins_report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReport written to ${reportPath}`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("\nVerification:");
for (const { table } of JOINS) {
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
  console.log(`  ${table}: ${count.toLocaleString()} rows`);
}

// Quick stats on failures
console.log("\nFailure breakdown:");
for (const entry of report) {
  if (entry.skipped === 0) {
    console.log(`  ${entry.table}: no failures`);
    continue;
  }

  // Count how many failed due to side A only, side B only, or both
  const fkCols = JOINS.find((j) => j.table === entry.table).fks.map((f) => f.col);
  let sideAOnly = 0;
  let sideBOnly = 0;
  let both = 0;

  for (const f of entry.failures) {
    const missingA = fkCols[0] in f.missing;
    const missingB = fkCols[1] in f.missing;
    if (missingA && missingB) both++;
    else if (missingA) sideAOnly++;
    else sideBOnly++;
  }

  console.log(
    `  ${entry.table}: ${sideAOnly} missing ${fkCols[0]} only, ${sideBOnly} missing ${fkCols[1]} only, ${both} missing both`
  );
}

db.close();
