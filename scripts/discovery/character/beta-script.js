// Beta scrape script for characters.
// Fetches from wiki → parses → cleans → maps to schema → outputs DB-ready JSON.
// Hardcoded to 9 sample characters. The real Phase 3 script will paginate a category instead.

import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { parseInfobox, cleanWikitext, resolveImageUrl, delay } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/character/output";
await mkdir(OUT_DIR, { recursive: true });

const CHARACTERS = [
  "Peter Parker (Earth-616)",
  "Thor Odinson (Earth-616)",
  "Steven Rogers (Earth-616)",
  "Anthony Stark (Earth-616)",
  "Reed Richards (Earth-616)",
  "Victor von Doom (Earth-616)",
  "Bruce Banner (Earth-616)",
  "James Howlett (Earth-616)",
  "Scott Summers (Earth-616)",
];

// Map from raw infobox field names → schema column names.
// Fields not listed here are dropped.
const FIELD_MAP = {
  // Core identity
  Name: "name",
  CurrentAlias: "current_alias",
  Aliases: "aliases",
  Codenames: "codenames",
  Nicknames: "nicknames",
  EditorialNames: "editorial_names",

  // Biographical
  Overview: "overview",
  History: "history",
  Personality: "personality",
  Origin: "origin",
  Identity: "identity",
  Gender: "gender",
  PlaceOfBirth: "place_of_birth",
  Occupation: "occupation",
  Education: "education",
  BaseOfOperations: "base_of_operations",

  // Powers & abilities
  Powers: "powers",
  Abilities: "abilities",
  Weaknesses: "weaknesses",
  UnusualFeatures: "unusual_features",

  // Equipment
  Equipment: "equipment",
  Weapons: "weapons",
  Transportation: "transportation",

  // Family
  Parents: "parents",
  Children: "children",
  Siblings: "siblings",
  Spouses: "spouses",
  Relatives: "relatives",

  // Misc
  Impersonations: "impersonations",
  Quotation: "quotation",
  Speaker: "quotation_speaker",
  Trivia: "trivia",
  Notes: "notes",
};

for (const page of CHARACTERS) {
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
  const imageField = infobox.Image || infobox.Image1;
  if (imageField) {
    row.image_url = await resolveImageUrl(imageField);
    await delay();
  } else {
    row.image_url = null;
  }

  // 4. Clean and map all schema fields
  for (const [rawField, schemaCol] of Object.entries(FIELD_MAP)) {
    if (infobox[rawField] != null && infobox[rawField] !== "") {
      const cleaned = cleanWikitext(String(infobox[rawField]));
      row[schemaCol] = cleaned === "" ? null : cleaned;
    } else {
      row[schemaCol] = null;
    }
  }

  // 5. Write output
  const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
  const outPath = `${OUT_DIR}/beta_${filename}.json`;
  await writeFile(outPath, JSON.stringify(row, null, 2));

  const populated = Object.values(row).filter((v) => v !== null).length;
  const total = Object.keys(row).length;
  console.log(`  → beta_${filename}.json (${populated}/${total} fields populated)`);

  await delay();
}

console.log("\nDone!");
