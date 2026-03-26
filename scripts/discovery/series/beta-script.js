// Beta scrape script for series.
// Fetches from wiki → parses → cleans → maps to schema → outputs DB-ready JSON.
// Hardcoded to 16 sample series. The real Phase 3 script will paginate a category instead.

import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { parseInfobox, cleanWikitext, resolveImageUrl, delay } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/series/output";
await mkdir(OUT_DIR, { recursive: true });

const SERIES = [
  // Major long-running series
  "Amazing Spider-Man Vol 1",
  "Uncanny X-Men Vol 1",
  "Avengers Vol 1",
  "Fantastic Four Vol 1",
  "Incredible Hulk Vol 1",
  "Iron Man Vol 1",
  "Thor Vol 1",
  "Captain America Vol 1",
  "X-Men Vol 1",
  "Daredevil Vol 1",
  "New Mutants Vol 1",
  "Secret Wars Vol 1",
  // Mid-tier / shorter runs
  "Moon Knight Vol 1",
  "Power Pack Vol 1",
  // Obscure / limited series
  "Sleepwalker Vol 1",
  "Darkhawk Vol 1",
];

// Map from raw infobox field names → schema column names.
// Only simple 1-to-1 fields. Creators and see_also are handled separately.
const FIELD_MAP = {
  format: "format",
  type: "type",
  status: "status",
  genres: "genres",
  featured: "featured",
  PreviousVol: "previous_volume",
  Notes: "notes",
};

// Merge numbered creator fields with issue counts into a single string.
// e.g., writer1 + writer1_issues, writer2 + writer2_issues → "Stan Lee (112 issues)\nGerry Conway (39 issues)"
function mergeCreatorsWithCounts(infobox, prefix) {
  const values = [];
  for (let i = 1; i <= 30; i++) {
    const nameKey = `${prefix}${i}`;
    const issuesKey = `${prefix}${i}_issues`;
    if (infobox[nameKey] != null && infobox[nameKey] !== "") {
      const name = cleanWikitext(String(infobox[nameKey]));
      if (!name) continue;
      const issues = infobox[issuesKey];
      if (issues) {
        values.push(`${name} (${issues} issues)`);
      } else {
        values.push(name);
      }
    }
  }
  return values.length > 0 ? values.join("\n") : null;
}

// Collapse SeeAlso, AnnualName/Year, and SpecialName/Year into one field
function buildSeeAlso(infobox) {
  const parts = [];

  // SeeAlso field
  if (infobox.SeeAlso) {
    const cleaned = cleanWikitext(String(infobox.SeeAlso));
    if (cleaned) parts.push(cleaned);
  }

  // AnnualName1–AnnualNameN
  for (let i = 1; i <= 10; i++) {
    const nameKey = `AnnualName${i}`;
    const yearKey = `AnnualYear${i}`;
    if (infobox[nameKey]) {
      const name = cleanWikitext(String(infobox[nameKey]));
      const year = infobox[yearKey] ? cleanWikitext(String(infobox[yearKey])) : null;
      if (name) parts.push(year ? `${name} (${year})` : name);
    }
  }

  // SpecialName1–SpecialNameN
  for (let i = 1; i <= 10; i++) {
    const nameKey = `SpecialName${i}`;
    const yearKey = `SpecialYear${i}`;
    if (infobox[nameKey]) {
      const name = cleanWikitext(String(infobox[nameKey]));
      const year = infobox[yearKey] ? cleanWikitext(String(infobox[yearKey])) : null;
      if (name) parts.push(year ? `${name} (${year})` : name);
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

for (const page of SERIES) {
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

  // image_url — resolve from volume_logo field
  if (infobox.volume_logo) {
    row.image_url = await resolveImageUrl(infobox.volume_logo);
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

  // 5. Merge creators with issue counts
  row.writers = mergeCreatorsWithCounts(infobox, "writer");
  row.pencilers = mergeCreatorsWithCounts(infobox, "penciler");

  // 6. Build see_also (SeeAlso + Annuals + Specials)
  row.see_also = buildSeeAlso(infobox);

  // 7. Write output
  const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
  const outPath = `${OUT_DIR}/beta_${filename}.json`;
  await writeFile(outPath, JSON.stringify(row, null, 2));

  const populated = Object.values(row).filter((v) => v !== null).length;
  const total = Object.keys(row).length;
  console.log(`  → beta_${filename}.json (${populated}/${total} fields populated)`);

  await delay();
}

console.log("\nDone!");
