// Production scrape script for characters.
// Reads pages_characters.json → fetches → parses → cleans → outputs scrape_characters.json
// Characters don't produce joins directly — joins come from comics/teams/events referencing characters.

import { cleanWikitext, resolveImageUrl, delay, runScraper } from "../lib/scraper-utils.js";

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

await runScraper({
  entity: "characters",
  pagesFile: "scripts/data/pages_characters.json",
  outDir: "scripts/data",
  async processPage(pageTitle, wikitext, infobox) {
    const row = {};

    row.wiki_page_title = pageTitle.replace(/ /g, "_");

    // Image
    const imageField = infobox.Image || infobox.Image1;
    if (imageField) {
      row.image_url = await resolveImageUrl(imageField);
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

    return { row };
  },
});
