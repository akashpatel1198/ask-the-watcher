// Production scrape script for series.
// Reads pages_series.json → fetches → parses → cleans → outputs scrape_series.json

import { parseInfobox, cleanWikitext, resolveImageUrl, delay, runScraper } from "../lib/scraper-utils.js";

const FIELD_MAP = {
  format: "format",
  type: "type",
  status: "status",
  genres: "genres",
  featured: "featured",
  PreviousVol: "previous_volume",
  Notes: "notes",
};

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

function buildSeeAlso(infobox) {
  const parts = [];
  if (infobox.SeeAlso) {
    const cleaned = cleanWikitext(String(infobox.SeeAlso));
    if (cleaned) parts.push(cleaned);
  }
  for (let i = 1; i <= 10; i++) {
    const nameKey = `AnnualName${i}`;
    const yearKey = `AnnualYear${i}`;
    if (infobox[nameKey]) {
      const name = cleanWikitext(String(infobox[nameKey]));
      const year = infobox[yearKey] ? cleanWikitext(String(infobox[yearKey])) : null;
      if (name) parts.push(year ? `${name} (${year})` : name);
    }
  }
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

await runScraper({
  entity: "series",
  pagesFile: "scripts/data/pages_series.json",
  outDir: "scripts/data",
  async processPage(pageTitle, wikitext, infobox) {
    const row = {};

    row.wiki_page_title = pageTitle.replace(/ /g, "_");

    // Image
    if (infobox.volume_logo) {
      row.image_url = await resolveImageUrl(infobox.volume_logo);
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

    // Creators
    row.writers = mergeCreatorsWithCounts(infobox, "writer");
    row.pencilers = mergeCreatorsWithCounts(infobox, "penciler");

    // See also
    row.see_also = buildSeeAlso(infobox);

    return { row };
  },
});
