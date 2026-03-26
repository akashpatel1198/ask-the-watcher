// Beta scrape script for events.
// Fetches from wiki → parses → cleans → maps to schema → outputs DB-ready JSON.
// Hardcoded to 14 sample events. The real Phase 3 script will paginate a category instead.

import axios from "axios";
import { writeFile, readFile, mkdir } from "fs/promises";
import { parseInfobox, cleanWikitext, resolveImageUrl, delay, extractWikiLinks } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/event/output";
const JOINS_DIR = "scripts/discovery/joins/output";
await mkdir(OUT_DIR, { recursive: true });

const EVENTS = [
  // Major crossover events
  "Civil War (Event)",
  "Secret Wars (1984 Event)",
  "Secret Wars (2015 Event)",
  "Infinity Gauntlet (Event)",
  "House of M (Event)",
  "Secret Invasion (Event)",
  // Mid-tier
  "Annihilation (Event)",
  "Age of Apocalypse (Event)",
  "Atlantis Attacks",
  "Armor Wars I",
  // Obscure / smaller
  "Blood Hunt",
  "Acts of Evil",
  "Battle of the Atom",
  "'Nuff Said",
];

// Map from raw infobox field names → schema column names.
// Only simple 1-to-1 fields. Reading order, tie-ins, and gallery fields handled separately.
const FIELD_MAP = {
  Name: "name",
  Aliases: "aliases",
  Creators: "creators",
  Synopsis: "synopsis",
  Reality: "reality",
  Locations: "locations",
  Protagonists: "protagonists",
  Antagonists: "antagonists",
  Others: "others",
  First: "first_issue",
  Last: "last_issue",
  Quotation: "quotation",
  Speaker: "quotation_speaker",
  Notes: "notes",
  Trivia: "trivia",
  Recommended: "recommended",
};

// Collapse Part1–PartN into a newline-separated reading order
function buildReadingOrder(infobox) {
  const parts = [];
  for (let i = 1; i <= 50; i++) {
    const key = `Part${i}`;
    if (infobox[key] != null && infobox[key] !== "") {
      const cleaned = cleanWikitext(String(infobox[key]));
      if (cleaned) parts.push(cleaned);
    }
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

// Clean wiki gallery markup into a newline-separated list of issue titles.
// Gallery format: "Image.jpg|{{cl|Issue Title}}\n..."
// We extract the text after the | pipe in each gallery line.
function cleanGallery(raw) {
  if (!raw || typeof raw !== "string") return null;

  const lines = raw.split("\n");
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip gallery tags and empty lines
    if (!trimmed || trimmed.startsWith("<gallery") || trimmed.startsWith("</gallery") || trimmed.startsWith("==")) continue;

    // Gallery line format: "Image.jpg|{{cl|Title}}" or "Image.jpg|{{cl|Title Vol 1 1}}-{{cl|Title Vol 1 3|3}}"
    const pipeIdx = trimmed.indexOf("|");
    if (pipeIdx !== -1) {
      const afterPipe = trimmed.slice(pipeIdx + 1).trim();
      const cleaned = cleanWikitext(afterPipe);
      if (cleaned) items.push(cleaned);
    }
  }
  return items.length > 0 ? items.join("\n") : null;
}

for (const page of EVENTS) {
  console.log(`Fetching ${page}...`);

  // 1. Fetch wikitext
  const res = await axios.get(API_URL, {
    params: { action: "parse", page, prop: "wikitext", format: "json" },
  });
  const wikitext = res.data.parse.wikitext["*"];

  // 2. Parse infobox
  const infobox = parseInfobox(wikitext);

  // 3. Build DB-ready row
  const row = {};

  // wiki_page_title
  row.wiki_page_title = page.replace(/ /g, "_");

  // image_url — resolve from Image field
  if (infobox.Image) {
    row.image_url = await resolveImageUrl(infobox.Image);
    await delay();
  } else {
    row.image_url = null;
  }

  // 4. Clean and map all simple fields
  for (const [rawField, schemaCol] of Object.entries(FIELD_MAP)) {
    if (infobox[rawField] != null && infobox[rawField] !== "") {
      const cleaned = cleanWikitext(String(infobox[rawField]));
      row[schemaCol] = cleaned === "" ? null : cleaned;
    } else {
      row[schemaCol] = null;
    }
  }

  // 5. Build reading order from Part1–PartN
  row.reading_order = buildReadingOrder(infobox);

  // 6. Clean gallery fields
  row.tie_ins = cleanGallery(infobox.TieIns);
  row.prelude = cleanGallery(infobox.Prelude);

  // 7. Write output
  const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
  const outPath = `${OUT_DIR}/beta_${filename}.json`;
  await writeFile(outPath, JSON.stringify(row, null, 2));

  const populated = Object.values(row).filter((v) => v !== null).length;
  const total = Object.keys(row).length;
  console.log(`  → beta_${filename}.json (${populated}/${total} fields populated)`);

  // 8. Extract character_events and event_comics join rows
  try {
    const eventTitle = row.wiki_page_title;
    const charJoinRows = [];
    const comicJoinRows = [];

    // character_events — from Protagonists / Antagonists / Others
    for (const charTitle of extractWikiLinks(String(infobox.Protagonists || ""))) {
      charJoinRows.push({ character_wiki_page_title: charTitle, event_wiki_page_title: eventTitle, role: "protagonist" });
    }
    for (const charTitle of extractWikiLinks(String(infobox.Antagonists || ""))) {
      charJoinRows.push({ character_wiki_page_title: charTitle, event_wiki_page_title: eventTitle, role: "antagonist" });
    }
    for (const charTitle of extractWikiLinks(String(infobox.Others || ""))) {
      charJoinRows.push({ character_wiki_page_title: charTitle, event_wiki_page_title: eventTitle, role: "other" });
    }

    // event_comics — from Part1–PartN
    // Part fields use {{cl|Title}} templates (not wiki links), so clean and underscore.
    // extractWikiLinks is tried first in case some parts use [[Page|Display]] format.
    for (let i = 1; i <= 50; i++) {
      const raw = String(infobox[`Part${i}`] || "");
      if (!raw) break;
      const links = extractWikiLinks(raw);
      const titles = links.length > 0
        ? links
        : [cleanWikitext(raw).replace(/ /g, "_")].filter(Boolean);
      for (const comicTitle of titles) {
        comicJoinRows.push({ event_wiki_page_title: eventTitle, comic_wiki_page_title: comicTitle, reading_order: i, type: "main" });
      }
    }

    // event_comics — from TieIns gallery (already cleaned by cleanGallery → underscore)
    if (infobox.TieIns) {
      const cleaned = cleanGallery(String(infobox.TieIns));
      if (cleaned) {
        for (const title of cleaned.split("\n").filter(Boolean)) {
          comicJoinRows.push({ event_wiki_page_title: eventTitle, comic_wiki_page_title: title.replace(/ /g, "_"), reading_order: null, type: "tie_in" });
        }
      }
    }

    if (charJoinRows.length > 0) {
      const joinPath = `${JOINS_DIR}/beta_joins_character_events.json`;
      const existing = JSON.parse(await readFile(joinPath, "utf8").catch(() => "[]"));
      await writeFile(joinPath, JSON.stringify([...existing, ...charJoinRows], null, 2));
      console.log(`  → +${charJoinRows.length} character_events join rows`);
    }
    if (comicJoinRows.length > 0) {
      const joinPath = `${JOINS_DIR}/beta_joins_event_comics.json`;
      const existing = JSON.parse(await readFile(joinPath, "utf8").catch(() => "[]"));
      await writeFile(joinPath, JSON.stringify([...existing, ...comicJoinRows], null, 2));
      console.log(`  → +${comicJoinRows.length} event_comics join rows`);
    }
  } catch (err) {
    console.log(`  !! Join extraction failed: ${err.message}`);
  }

  await delay();
}

console.log("\nDone!");
