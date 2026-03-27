// Schema migration script — creates all entity tables, join tables, and indexes
// Reads column definitions from schema/*.json files
// Outputs to data/marvel.db (created automatically by better-sqlite3)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.join(__dirname, "..", "schema");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSchema(filename) {
  return JSON.parse(fs.readFileSync(path.join(schemaDir, filename), "utf-8"));
}

/**
 * Extracts real columns from a schema JSON, skipping _meta / _section_* keys.
 * Returns an array of { name, type } objects.
 */
function extractColumns(schema) {
  const cols = [];
  for (const [key, val] of Object.entries(schema.columns)) {
    if (key.startsWith("_")) continue; // skip _meta, _section_*
    cols.push({ name: key, type: val.type });
  }
  return cols;
}

/**
 * Builds a CREATE TABLE statement from a list of columns.
 */
function buildCreateTable(tableName, columns) {
  const colDefs = columns.map((c) => `  ${c.name} ${c.type}`).join(",\n");
  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n${colDefs}\n);`;
}

// ---------------------------------------------------------------------------
// Entity tables
// ---------------------------------------------------------------------------

const entityFiles = [
  "characters.json",
  "comics.json",
  "series.json",
  "teams.json",
  "events.json",
];

console.log("Setting up database...\n");

for (const file of entityFiles) {
  const schema = readSchema(file);
  const columns = extractColumns(schema);

  // Add series_wiki_page_title FK column to comics table
  if (schema.table === "comics") {
    columns.push({ name: "series_wiki_page_title", type: "TEXT" });
  }

  const sql = buildCreateTable(schema.table, columns);
  console.log(`Creating table: ${schema.table}`);
  db.exec(sql);
}

// ---------------------------------------------------------------------------
// Join tables
// ---------------------------------------------------------------------------

const joinsSchema = readSchema("joins.json");

for (const [tableName, def] of Object.entries(joinsSchema.join_tables)) {
  const cols = [];
  const pkCols = def.primary_key || [];

  for (const [colName, colDef] of Object.entries(def.columns)) {
    cols.push({ name: colName, type: colDef.type });
  }

  const colDefs = cols.map((c) => `  ${c.name} ${c.type}`).join(",\n");
  const pkClause =
    pkCols.length > 0
      ? `,\n  PRIMARY KEY (${pkCols.join(", ")})`
      : "";

  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n${colDefs}${pkClause}\n);`;
  console.log(`Creating join table: ${tableName}`);
  db.exec(sql);
}

// ---------------------------------------------------------------------------
// Indexes — speed up common lookups and joins
// ---------------------------------------------------------------------------

const indexes = [
  // Entity table lookups by wiki_page_title (already UNIQUE, but explicit index)
  // SQLite auto-creates indexes for UNIQUE columns, so these are redundant but
  // listed here for clarity. We skip them and focus on non-obvious indexes.

  // Comics: lookup by series
  "CREATE INDEX IF NOT EXISTS idx_comics_series ON comics (series_wiki_page_title);",

  // Join table indexes — both sides of every join for fast lookups in either direction
  "CREATE INDEX IF NOT EXISTS idx_character_teams_character ON character_teams (character_wiki_page_title);",
  "CREATE INDEX IF NOT EXISTS idx_character_teams_team ON character_teams (team_wiki_page_title);",

  "CREATE INDEX IF NOT EXISTS idx_character_events_character ON character_events (character_wiki_page_title);",
  "CREATE INDEX IF NOT EXISTS idx_character_events_event ON character_events (event_wiki_page_title);",

  "CREATE INDEX IF NOT EXISTS idx_comic_characters_comic ON comic_characters (comic_wiki_page_title);",
  "CREATE INDEX IF NOT EXISTS idx_comic_characters_character ON comic_characters (character_wiki_page_title);",

  "CREATE INDEX IF NOT EXISTS idx_event_comics_event ON event_comics (event_wiki_page_title);",
  "CREATE INDEX IF NOT EXISTS idx_event_comics_comic ON event_comics (comic_wiki_page_title);",
];

console.log("\nCreating indexes...");
for (const sql of indexes) {
  db.exec(sql);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();

const indexList = db
  .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

console.log(`\nDone! Created ${tables.length} tables and ${indexList.length} indexes.`);
console.log("Tables:", tables.map((t) => t.name).join(", "));
console.log("Indexes:", indexList.map((i) => i.name).join(", "));

db.close();
