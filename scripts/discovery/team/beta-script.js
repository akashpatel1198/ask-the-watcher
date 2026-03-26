// Beta scrape script for teams.
// Fetches from wiki → parses → cleans → maps to schema → outputs DB-ready JSON.
// Hardcoded to 14 sample teams. The real Phase 3 script will paginate a category instead.

import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { parseInfobox, cleanWikitext, resolveImageUrl, delay } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/team/output";
await mkdir(OUT_DIR, { recursive: true });

const TEAMS = [
  // Popular
  "Avengers (Earth-616)",
  "X-Men (Earth-616)",
  "Fantastic Four (Earth-616)",
  "Guardians of the Galaxy (Earth-616)",
  "S.H.I.E.L.D. (Earth-616)",
  "Hydra (Earth-616)",
  // Mid-tier / well-known but smaller
  "Sinister Six (Earth-616)",
  "Brotherhood of Evil Mutants (Earth-616)",
  "Defenders (Earth-616)",
  "Thunderbolts (Earth-616)",
  // Obscure
  "198 (Earth-616)",
  "3Peace (Earth-616)",
  "8-Ball's Gang (Earth-616)",
  "A-Force (Earth-616)",
];

// Map from raw infobox field names → schema column names.
// Only simple 1-to-1 fields. Leaders handled separately due to "Formerly:" sections.
const FIELD_MAP = {
  Name: "name",
  Aliases: "aliases",
  Status: "status",
  Identity: "identity",
  Reality: "reality",
  Origin: "origin",
  Creators: "creators",
  CurrentMembers: "current_members",
  FormerMembers: "former_members",
  Allies: "allies",
  Enemies: "enemies",
  BaseOfOperations: "base_of_operations",
  PlaceOfFormation: "place_of_formation",
  Weapons: "weapons",
  Transportation: "transportation",
  Equipment: "equipment",
  First: "first_appearance",
  Last: "last_appearance",
  Quotation: "quotation",
  Speaker: "quotation_speaker",
  Notes: "notes",
  Trivia: "trivia",
};

// Leaders field sometimes has a "Formerly:" block on a separate line.
// We keep the full text (current + formerly) as-is after cleaning.
function cleanLeaders(infobox) {
  if (infobox.Leaders == null || infobox.Leaders === "") return null;
  const cleaned = cleanWikitext(String(infobox.Leaders));
  return cleaned || null;
}

for (const page of TEAMS) {
  console.log(`Fetching ${page}...`);

  // 1. Fetch wikitext
  let res;
  try {
    res = await axios.get(API_URL, {
      params: { action: "parse", page, prop: "wikitext", format: "json" },
    });
  } catch (err) {
    console.log(`  !! Failed to fetch: ${err.response?.status || err.message}`);
    await delay();
    continue;
  }

  if (res.data.error || !res.data.parse?.wikitext) {
    console.log(`  !! No wikitext returned (${res.data.error?.info || "redirect or missing page"}) — skipping`);
    await delay();
    continue;
  }
  const wikitext = res.data.parse.wikitext["*"];

  // 2. Parse infobox
  const infobox = parseInfobox(wikitext);

  // Skip if infobox is empty (e.g. S.H.I.E.L.D. redirect)
  if (Object.keys(infobox).length === 0) {
    console.log(`  !! Empty infobox — skipping`);
    await delay();
    continue;
  }

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

  // 5. Leaders — handled separately (has Formerly: sections)
  row.leaders = cleanLeaders(infobox);

  // 6. Write output
  const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
  const outPath = `${OUT_DIR}/beta_${filename}.json`;
  await writeFile(outPath, JSON.stringify(row, null, 2));

  const populated = Object.values(row).filter((v) => v !== null).length;
  const total = Object.keys(row).length;
  console.log(`  → beta_${filename}.json (${populated}/${total} fields populated)`);

  await delay();
}

console.log("\nDone!");
