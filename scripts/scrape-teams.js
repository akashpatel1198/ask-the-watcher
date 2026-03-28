// Production scrape script for teams.
// Reads pages_teams.json → fetches → parses → cleans → outputs scrape_teams.json + joins

import axios from "axios";
import { parseInfobox, cleanWikitext, resolveImageUrl, delay, extractWikiLinks, runScraper } from "../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";

const FIELD_MAP = {
  Name: "name",
  Aliases: "aliases",
  Status: "status",
  Identity: "identity",
  Reality: "reality",
  Origin: "origin",
  Creators: "creators",
  CurrentMembers: "current_members",
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

// --- Raw field extractor (for join link extraction before cleaning) ---
function getRawField(wikitext, fieldName) {
  const fieldPattern = new RegExp(`^\\|\\s*${fieldName}\\s*=\\s*(.*)`, "m");
  const fieldMatch = wikitext.match(fieldPattern);
  if (!fieldMatch) return "";
  const startIdx = wikitext.indexOf(fieldMatch[0]);
  const afterField = wikitext.slice(startIdx + fieldMatch[0].length);
  const lines = afterField.split("\n");
  const initial = fieldMatch[1].trim();
  const content = [initial];
  let braceDepth = (initial.match(/\{\{/g) || []).length - (initial.match(/\}\}/g) || []).length;
  for (const line of lines) {
    braceDepth += (line.match(/\{\{/g) || []).length - (line.match(/\}\}/g) || []).length;
    if (braceDepth < 0) braceDepth = 0;
    if (braceDepth === 0 && /^\|\s*[A-Z]/.test(line)) break;
    content.push(line);
  }
  return content.join("\n");
}

// --- Navigation template extraction ---
function extractFieldWithNavigation(wikitext, fieldName) {
  const fieldPattern = new RegExp(`^\\|\\s*${fieldName}\\s*=\\s*(.*)`, "m");
  const fieldMatch = wikitext.match(fieldPattern);
  if (!fieldMatch) return null;

  const startIdx = wikitext.indexOf(fieldMatch[0]);
  const afterField = wikitext.slice(startIdx + fieldMatch[0].length);
  const lines = afterField.split("\n");
  const initialValue = fieldMatch[1].trim();
  const content = [initialValue];

  const initialOpens = (initialValue.match(/\{\{/g) || []).length;
  const initialCloses = (initialValue.match(/\}\}/g) || []).length;
  let braceDepth = initialOpens - initialCloses;

  for (const line of lines) {
    const opens = (line.match(/\{\{/g) || []).length;
    const closes = (line.match(/\}\}/g) || []).length;
    braceDepth += opens - closes;
    if (braceDepth < 0) braceDepth = 0;
    if (braceDepth === 0 && /^\|\s*[A-Z]/.test(line)) break;
    content.push(line);
  }

  const raw = content.join("\n");

  const bodies = [];
  const navPattern = /\{\{Navigation[^}]*\|\s*title\s*=\s*(.*?)\n.*?\|\s*body\s*=\s*([\s\S]*?)(?:\}\})/gi;
  let match;
  while ((match = navPattern.exec(raw)) !== null) {
    const title = cleanWikitext(match[1].trim());
    const body = cleanWikitext(match[2].trim());
    if (title && body) {
      bodies.push(`${title}: ${body}`);
    } else if (body) {
      bodies.push(body);
    }
  }

  if (bodies.length > 0) {
    const beforeNav = raw.slice(0, raw.indexOf("{{Navigation")).trim();
    const plainText = beforeNav ? cleanWikitext(beforeNav) : null;
    const parts = plainText ? [plainText, ...bodies] : bodies;
    return parts.join("\n") || null;
  }

  const cleaned = cleanWikitext(raw);
  return cleaned || null;
}

// --- "See also" redirect follower for member fields ---
const SEE_ALSO_PATTERN = /^(?:See also|More information)[:\s]*\[\[([^\]|]+)/i;

async function followMemberRedirect(fieldValue) {
  const match = fieldValue.match(SEE_ALSO_PATTERN);
  if (!match) return null;

  const linkedPage = match[1];
  console.log(`    ↳ Following member redirect → "${linkedPage}"...`);

  try {
    const res = await axios.get(API_URL, {
      params: { action: "parse", page: linkedPage, prop: "wikitext", format: "json" },
    });
    await delay();

    if (res.data.error || !res.data.parse?.wikitext) return null;
    const wt = res.data.parse.wikitext["*"];

    const members = [];
    const rowPattern = /^\|\|?\s*(?:''')?(?:\[\[([^\]|]+?)(?:\|([^\]]+))?\]\])(?:''')?/gm;
    let m;
    while ((m = rowPattern.exec(wt)) !== null) {
      const name = m[2] || m[1];
      const cleaned = cleanWikitext(name.replace(/\(Earth-\d+\)/g, "").trim());
      if (cleaned && !cleaned.includes("Vol ")) {
        members.push(cleaned);
      }
    }

    if (members.length > 0) {
      console.log(`    ↳ Extracted ${members.length} members from "${linkedPage}"`);
      return members.join("\n");
    }
  } catch (err) {
    console.log(`    ↳ Failed to follow redirect: ${err.message}`);
  }

  return null;
}

// --- FormerMembers handler ---
async function buildFormerMembers(infobox, wikitext) {
  const withNav = extractFieldWithNavigation(wikitext, "FormerMembers");

  if (withNav) {
    if (SEE_ALSO_PATTERN.test(withNav)) {
      const afterRedirect = withNav.replace(/^.*?(?:See also|More information)[:\s]*[^\n]*\n*/i, "").trim();
      if (afterRedirect && afterRedirect.length > 30) {
        return afterRedirect;
      }
      const followed = await followMemberRedirect(infobox.FormerMembers || withNav);
      return followed;
    }
    return withNav;
  }

  if (infobox.FormerMembers != null && infobox.FormerMembers !== "") {
    const raw = String(infobox.FormerMembers);
    if (SEE_ALSO_PATTERN.test(raw)) {
      const followed = await followMemberRedirect(raw);
      return followed;
    }
    const cleaned = cleanWikitext(raw);
    return cleaned || null;
  }

  return null;
}

await runScraper({
  entity: "teams",
  pagesFile: "scripts/data/pages_teams.json",
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

    // Leaders — extract from raw wikitext to capture {{Navigation}} blocks
    row.leaders = extractFieldWithNavigation(wikitext, "Leaders");

    // FormerMembers — handle "See also" redirects + Navigation blocks
    row.former_members = await buildFormerMembers(infobox, wikitext);

    // --- Joins: character_teams ---
    const teamTitle = row.wiki_page_title;
    const joinRows = [];

    for (const charTitle of extractWikiLinks(getRawField(wikitext, "Leaders"))) {
      joinRows.push({ character_wiki_page_title: charTitle, team_wiki_page_title: teamTitle, role: "leader" });
    }
    for (const charTitle of extractWikiLinks(String(infobox.CurrentMembers || ""))) {
      joinRows.push({ character_wiki_page_title: charTitle, team_wiki_page_title: teamTitle, role: "member" });
    }
    for (const charTitle of extractWikiLinks(getRawField(wikitext, "FormerMembers"))) {
      joinRows.push({ character_wiki_page_title: charTitle, team_wiki_page_title: teamTitle, role: "former_member" });
    }

    if (joinRows.length > 0) {
      joins.character_teams = joinRows;
      console.log(`  → +${joinRows.length} character_teams joins`);
    }

    return { row, joins };
  },
});
