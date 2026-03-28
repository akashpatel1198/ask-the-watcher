// Production scrape script for events.
// Reads pages_events.json → fetches → parses → cleans → outputs scrape_events.json + joins

import { parseInfobox, cleanWikitext, resolveImageUrl, delay, extractWikiLinks, runScraper } from "../lib/scraper-utils.js";

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

function cleanGallery(raw) {
  if (!raw || typeof raw !== "string") return null;
  const lines = raw.split("\n");
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("<gallery") || trimmed.startsWith("</gallery") || trimmed.startsWith("==")) continue;
    const pipeIdx = trimmed.indexOf("|");
    if (pipeIdx !== -1) {
      const afterPipe = trimmed.slice(pipeIdx + 1).trim();
      const cleaned = cleanWikitext(afterPipe);
      if (cleaned) items.push(cleaned);
    }
  }
  return items.length > 0 ? items.join("\n") : null;
}

await runScraper({
  entity: "events",
  pagesFile: "scripts/data/pages_events.json",
  outDir: "scripts/data",
  async processPage(pageTitle, wikitext, infobox) {
    const row = {};
    const joins = {};

    row.wiki_page_title = pageTitle.replace(/ /g, "_");

    // Image
    if (infobox.Image) {
      row.image_url = await resolveImageUrl(infobox.Image);
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

    // Reading order
    row.reading_order = buildReadingOrder(infobox);

    // Gallery fields
    row.tie_ins = cleanGallery(infobox.TieIns);
    row.prelude = cleanGallery(infobox.Prelude);

    // --- Joins ---
    const eventTitle = row.wiki_page_title;

    // character_events
    const charJoinRows = [];
    for (const charTitle of extractWikiLinks(String(infobox.Protagonists || ""))) {
      charJoinRows.push({ character_wiki_page_title: charTitle, event_wiki_page_title: eventTitle, role: "protagonist" });
    }
    for (const charTitle of extractWikiLinks(String(infobox.Antagonists || ""))) {
      charJoinRows.push({ character_wiki_page_title: charTitle, event_wiki_page_title: eventTitle, role: "antagonist" });
    }
    for (const charTitle of extractWikiLinks(String(infobox.Others || ""))) {
      charJoinRows.push({ character_wiki_page_title: charTitle, event_wiki_page_title: eventTitle, role: "other" });
    }
    if (charJoinRows.length > 0) {
      joins.character_events = charJoinRows;
      console.log(`  → +${charJoinRows.length} character_events joins`);
    }

    // event_comics — from Part1–PartN
    const comicJoinRows = [];
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

    // event_comics — from TieIns gallery
    if (infobox.TieIns) {
      const cleaned = cleanGallery(String(infobox.TieIns));
      if (cleaned) {
        for (const title of cleaned.split("\n").filter(Boolean)) {
          comicJoinRows.push({ event_wiki_page_title: eventTitle, comic_wiki_page_title: title.replace(/ /g, "_"), reading_order: null, type: "tie_in" });
        }
      }
    }

    if (comicJoinRows.length > 0) {
      joins.event_comics = comicJoinRows;
      console.log(`  → +${comicJoinRows.length} event_comics joins`);
    }

    return { row, joins };
  },
});
