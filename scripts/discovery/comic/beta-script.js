// Beta scrape script for comics.
// Fetches from wiki → parses → cleans → maps to schema → outputs DB-ready JSON.
// Hardcoded to 16 sample comics. The real Phase 3 script will paginate a category instead.

import axios from "axios";
import { writeFile, readFile, mkdir } from "fs/promises";
import { parseInfobox, cleanWikitext, resolveImageUrl, delay, extractWikiLinks } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/comic/output";
const JOINS_DIR = "scripts/discovery/joins/output";
await mkdir(OUT_DIR, { recursive: true });

const COMICS = [
  // Iconic / landmark issues
  "Amazing Fantasy Vol 1 15",
  "Amazing Spider-Man Vol 1 300",
  "X-Men Vol 1 137",
  "Incredible Hulk Vol 1 181",
  "Giant-Size X-Men Vol 1 1",
  "Avengers Vol 1 1",
  "Fantastic Four Vol 1 1",
  "Iron Man Vol 1 128",
  "X-Men Vol 1 1",
  "Marvel Super Heroes Secret Wars Vol 1 8",
  // Mid-tier
  "New Mutants Vol 1 98",
  "Avengers Vol 1 57",
  "Daredevil Vol 1 168",
  // Obscure / lesser-known
  "Sleepwalker Vol 1 2",
  "Darkhawk Vol 1 1",
  "Slingers Vol 1 1",
];

// Map from raw infobox field names → schema column names.
// Fields not listed here are dropped.
const FIELD_MAP = {
  // Publication
  ReleaseDate: "release_date",
  Month: "month",
  Year: "year",
  Pages: "pages",
  OriginalPrice: "original_price",

  // Story
  StoryTitle1: "story_title",
  Synopsis1: "synopsis",
  Storyline1: "storyline",

  // Quote
  Quotation: "quotation",
  Speaker: "quotation_speaker",

  // Content
  Appearing1: "appearing",
  Notes: "notes",
  Trivia: "trivia",

  // External
  MarvelUnlimitedID: "marvel_unlimited_id",

  // Editor-in-Chief (handled separately due to hyphen in key)
};

// Parse the Appearing field into join rows, section-aware.
// Sections: "Featured Characters" → featured, "Supporting Characters" → supporting,
// "Antagonists" → antagonist, "Other Characters" → other. Lines outside known sections are skipped.
const APPEARING_SECTION_MAP = {
  "featured characters": "featured",
  "supporting characters": "supporting",
  "antagonists": "antagonist",
  "other characters": "other",
};

function parseAppearingForJoins(raw) {
  if (!raw) return [];
  const rows = [];
  let currentType = null;
  for (const line of raw.split("\n")) {
    const lower = line.toLowerCase().trim().replace(/'{2,}/g, "").trim().replace(/:$/, "");
    if (APPEARING_SECTION_MAP[lower] !== undefined) {
      currentType = APPEARING_SECTION_MAP[lower];
      continue;
    }
    if (currentType) {
      for (const title of extractWikiLinks(line)) {
        rows.push({ character_wiki_page_title: title, appearance_type: currentType });
      }
    }
  }
  return rows;
}

// Merge numbered creator fields into a single newline-separated string.
// e.g., Writer1_1, Writer1_2, Writer1_3 → "Writer A\nWriter B\nWriter C"
function mergeCreators(infobox, prefix) {
  const values = [];
  for (let i = 1; i <= 10; i++) {
    const key = `${prefix}1_${i}`;
    if (infobox[key] != null && infobox[key] !== "") {
      const cleaned = cleanWikitext(String(infobox[key]));
      if (cleaned) values.push(cleaned);
    }
  }
  return values.length > 0 ? values.join("\n") : null;
}

// Merge cover artist fields: Image1_Artist1 through Image1_Artist5
function mergeCoverArtists(infobox) {
  const values = [];
  for (let i = 1; i <= 10; i++) {
    const key = `Image1_Artist${i}`;
    if (infobox[key] != null && infobox[key] !== "") {
      const cleaned = cleanWikitext(String(infobox[key]));
      if (cleaned) values.push(cleaned);
    }
  }
  return values.length > 0 ? values.join("\n") : null;
}

// Build variant covers JSON array from Image2-5 fields
async function buildVariantCovers(infobox) {
  const variants = [];
  for (let i = 2; i <= 10; i++) {
    const imageKey = `Image${i}`;
    if (!infobox[imageKey]) continue;

    const imageUrl = await resolveImageUrl(infobox[imageKey]);
    await delay();

    const text = infobox[`Image${i}_Text`] || null;

    variants.push({
      image_url: imageUrl,
      text: text ? cleanWikitext(text) : null,
    });
  }
  return variants.length > 0 ? JSON.stringify(variants) : null;
}

for (const page of COMICS) {
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

  // image_url — resolve from Image1 field
  if (infobox.Image1) {
    row.image_url = await resolveImageUrl(infobox.Image1);
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

  // Editor-in-Chief (hyphenated key)
  if (infobox["Editor-in-Chief"] != null && infobox["Editor-in-Chief"] !== "") {
    row.editor_in_chief = cleanWikitext(String(infobox["Editor-in-Chief"]));
  } else {
    row.editor_in_chief = null;
  }

  // 5. Merge creator credits
  row.writer = mergeCreators(infobox, "Writer");
  row.penciler = mergeCreators(infobox, "Penciler");
  row.inker = mergeCreators(infobox, "Inker");
  row.colorist = mergeCreators(infobox, "Colorist");
  row.letterer = mergeCreators(infobox, "Letterer");
  row.editor = mergeCreators(infobox, "Editor");
  row.cover_artists = mergeCoverArtists(infobox);

  // 6. Build variant covers
  row.variant_covers = await buildVariantCovers(infobox);

  // 6b. Derive series_wiki_page_title FK from page title naming convention.
  // Comic page titles embed the series title: "Amazing Spider-Man Vol 1 300"
  // → strip trailing issue number → "Amazing Spider-Man Vol 1" → underscore.
  const seriesTitle = page.replace(/\s+\d+$/, "").replace(/ /g, "_");
  row.series_wiki_page_title = seriesTitle || null;

  // 7. Write output
  const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
  const outPath = `${OUT_DIR}/beta_${filename}.json`;
  await writeFile(outPath, JSON.stringify(row, null, 2));

  const populated = Object.values(row).filter((v) => v !== null).length;
  const total = Object.keys(row).length;
  console.log(`  → beta_${filename}.json (${populated}/${total} fields populated)`);

  // 8. Extract comic_characters join rows from raw Appearing1 field
  try {
    const comicTitle = row.wiki_page_title;
    const appearingRows = parseAppearingForJoins(String(infobox.Appearing1 || ""));
    const joinRows = appearingRows.map((r) => ({ comic_wiki_page_title: comicTitle, ...r }));

    if (joinRows.length > 0) {
      const joinPath = `${JOINS_DIR}/beta_joins_comic_characters.json`;
      const existing = JSON.parse(await readFile(joinPath, "utf8").catch(() => "[]"));
      await writeFile(joinPath, JSON.stringify([...existing, ...joinRows], null, 2));
      console.log(`  → +${joinRows.length} comic_characters join rows`);
    }
  } catch (err) {
    console.log(`  !! Join extraction failed: ${err.message}`);
  }

  await delay();
}

console.log("\nDone!");
