// Production scrape script for comics.
// Reads pages_comics.json → fetches → parses → cleans → outputs scrape_comics.json + joins

import { parseInfobox, cleanWikitext, resolveImageUrl, delay, extractWikiLinks, runScraper } from "../lib/scraper-utils.js";

const FIELD_MAP = {
  ReleaseDate: "release_date",
  Month: "month",
  Year: "year",
  Pages: "pages",
  OriginalPrice: "original_price",
  StoryTitle1: "story_title",
  Synopsis1: "synopsis",
  Storyline1: "storyline",
  Quotation: "quotation",
  Speaker: "quotation_speaker",
  Appearing1: "appearing",
  Notes: "notes",
  Trivia: "trivia",
  MarvelUnlimitedID: "marvel_unlimited_id",
};

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

await runScraper({
  entity: "comics",
  pagesFile: "scripts/data/pages_comics.json",
  outDir: "scripts/data",
  async processPage(pageTitle, wikitext, infobox) {
    const row = {};
    const joins = {};

    row.wiki_page_title = pageTitle.replace(/ /g, "_");

    // Image
    if (infobox.Image1) {
      row.image_url = await resolveImageUrl(infobox.Image1);
      await delay();
    } else {
      row.image_url = null;
    }

    // Simple fields
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

    // Merge creator credits
    row.writer = mergeCreators(infobox, "Writer");
    row.penciler = mergeCreators(infobox, "Penciler");
    row.inker = mergeCreators(infobox, "Inker");
    row.colorist = mergeCreators(infobox, "Colorist");
    row.letterer = mergeCreators(infobox, "Letterer");
    row.editor = mergeCreators(infobox, "Editor");
    row.cover_artists = mergeCoverArtists(infobox);

    // Variant covers
    row.variant_covers = await buildVariantCovers(infobox);

    // Derive series FK
    const seriesTitle = pageTitle.replace(/\s+\d+$/, "").replace(/ /g, "_");
    row.series_wiki_page_title = seriesTitle || null;

    // --- Joins: comic_characters ---
    const comicTitle = row.wiki_page_title;
    const appearingRows = parseAppearingForJoins(String(infobox.Appearing1 || ""));
    const joinRows = appearingRows.map((r) => ({ comic_wiki_page_title: comicTitle, ...r }));

    if (joinRows.length > 0) {
      joins.comic_characters = joinRows;
      console.log(`  → +${joinRows.length} comic_characters joins`);
    }

    return { row, joins };
  },
});
