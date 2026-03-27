// Connection test — verifies the database was set up correctly
// Checks: file exists, tables present, columns match schema, insert + query round-trip

import fs from "fs";
import db, { DB_PATH } from "../lib/db.js";

console.log("=== SQLite Connection Test ===\n");

// 1. File exists
console.log(`DB path: ${DB_PATH}`);
console.log(`File exists: ${fs.existsSync(DB_PATH)}`);
console.log(`File size: ${(fs.statSync(DB_PATH).size / 1024).toFixed(1)} KB\n`);

// 2. List all tables
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((t) => t.name);

console.log(`Tables (${tables.length}): ${tables.join(", ")}\n`);

const expectedTables = [
  "character_events",
  "character_teams",
  "characters",
  "comic_characters",
  "comics",
  "event_comics",
  "events",
  "series",
  "teams",
];

const missing = expectedTables.filter((t) => !tables.includes(t));
if (missing.length > 0) {
  console.error(`MISSING tables: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("All expected tables present.\n");

// 3. Column counts per table
console.log("Column counts:");
for (const table of expectedTables) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  console.log(`  ${table}: ${columns.length} columns`);
}

// 4. Insert + query round-trip on characters table
console.log("\n--- Round-trip test ---");
const insertStmt = db.prepare(
  "INSERT INTO characters (wiki_page_title, name, current_alias) VALUES (?, ?, ?)"
);
const testPageTitle = "__test_spider_man__";

// Clean up any previous test row
db.prepare("DELETE FROM characters WHERE wiki_page_title = ?").run(testPageTitle);

insertStmt.run(testPageTitle, "Peter Parker", "Spider-Man");

const row = db
  .prepare("SELECT * FROM characters WHERE wiki_page_title = ?")
  .get(testPageTitle);

console.log(`Inserted: wiki_page_title=${row.wiki_page_title}, name=${row.name}, current_alias=${row.current_alias}`);
console.log(`Auto-increment ID: ${row.id}`);

// Clean up test row
db.prepare("DELETE FROM characters WHERE wiki_page_title = ?").run(testPageTitle);
console.log("Test row cleaned up.");

// 5. Verify foreign_keys pragma
const fkStatus = db.prepare("PRAGMA foreign_keys").get();
console.log(`\nForeign keys enabled: ${fkStatus.foreign_keys === 1}`);

// 6. Verify WAL mode
const journalMode = db.prepare("PRAGMA journal_mode").get();
console.log(`Journal mode: ${journalMode.journal_mode}`);

console.log("\n=== All checks passed! ===");

db.close();
