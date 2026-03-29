// Migration: add appearance_type to comic_characters primary key
// Recreates the table with PK (comic_wiki_page_title, character_wiki_page_title, appearance_type)
// to match how character_teams and character_events handle their role column.

import db from "../lib/db.js";

console.log("Migrating comic_characters PK...\n");

const count = db.prepare("SELECT COUNT(*) as count FROM comic_characters").get();
console.log(`  Current rows: ${count.count.toLocaleString()}`);

db.exec(`
  DROP TABLE IF EXISTS comic_characters;

  CREATE TABLE comic_characters (
    comic_wiki_page_title TEXT NOT NULL,
    character_wiki_page_title TEXT NOT NULL,
    appearance_type TEXT,
    PRIMARY KEY (comic_wiki_page_title, character_wiki_page_title, appearance_type)
  );

  CREATE INDEX IF NOT EXISTS idx_comic_characters_comic ON comic_characters (comic_wiki_page_title);
  CREATE INDEX IF NOT EXISTS idx_comic_characters_character ON comic_characters (character_wiki_page_title);
`);

console.log("  Table recreated with 3-column PK.");

const verify = db.prepare("PRAGMA table_info(comic_characters)").all();
console.log("  Columns:", verify.map((c) => `${c.name}${c.pk ? " (PK)" : ""}`).join(", "));

console.log("\nDone. Re-run seed-joins.js to repopulate.");

db.close();
