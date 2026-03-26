// Beta scrape script for teams.
// Fetches from wiki → parses → cleans → maps to schema → outputs DB-ready JSON.
// Hardcoded to 15 sample teams. The real Phase 3 script will paginate a category instead.

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
  "Hellfire Club (Earth-616)",
  // Obscure
  "198 (Earth-616)",
  "3Peace (Earth-616)",
  "8-Ball's Gang (Earth-616)",
  "A-Force (Earth-616)",
];

// Map from raw infobox field names → schema column names.
// Only simple 1-to-1 fields. Leaders and FormerMembers handled separately.
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

// ---------------------------------------------------------------------------
// Navigation template extraction
// ---------------------------------------------------------------------------
// Some team infobox fields (Leaders, FormerMembers) use {{Navigation}} blocks
// to organize data by role/section. Our parseInfobox() strips these as layout
// chrome. This function extracts them directly from raw wikitext for a given
// field name.

function extractFieldWithNavigation(wikitext, fieldName) {
  // Find "| FieldName = ..." in the wikitext
  const fieldPattern = new RegExp(`^\\|\\s*${fieldName}\\s*=\\s*(.*)`, "m");
  const fieldMatch = wikitext.match(fieldPattern);
  if (!fieldMatch) return null;

  // Grab everything from the field start until the next top-level "| Field ="
  const startIdx = wikitext.indexOf(fieldMatch[0]);
  const afterField = wikitext.slice(startIdx + fieldMatch[0].length);

  // Collect lines until we hit the next top-level "| FieldName =" or "}}" closing the infobox
  const lines = afterField.split("\n");
  const initialValue = fieldMatch[1].trim();
  const content = [initialValue];

  // Count braces in the initial captured text so depth is correct
  const initialOpens = (initialValue.match(/\{\{/g) || []).length;
  const initialCloses = (initialValue.match(/\}\}/g) || []).length;
  let braceDepth = initialOpens - initialCloses;

  for (const line of lines) {
    // Track template nesting FIRST so depth is current for this line
    const opens = (line.match(/\{\{/g) || []).length;
    const closes = (line.match(/\}\}/g) || []).length;
    braceDepth += opens - closes;
    if (braceDepth < 0) braceDepth = 0;

    // Stop at next top-level infobox field (uppercase key after |)
    if (braceDepth === 0 && /^\|\s*[A-Z]/.test(line)) break;

    content.push(line);
  }

  const raw = content.join("\n");

  // Extract body content from {{Navigation}} blocks
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
    // Also grab any plain text before the first {{Navigation}}
    const beforeNav = raw.slice(0, raw.indexOf("{{Navigation")).trim();
    const plainText = beforeNav ? cleanWikitext(beforeNav) : null;
    const parts = plainText ? [plainText, ...bodies] : bodies;
    return parts.join("\n") || null;
  }

  // No Navigation blocks — fall back to standard cleaning
  const cleaned = cleanWikitext(raw);
  return cleaned || null;
}

// ---------------------------------------------------------------------------
// "See also" redirect follower for member fields
// ---------------------------------------------------------------------------
// Some teams (e.g. Avengers) have FormerMembers = "See also: [[List of ...]]"
// instead of actual member data. We detect this and fetch the linked page,
// parsing member names from wikitables.

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

    // Extract character names from wikitable first column
    // Format: ||'''[[Page (Earth-616)|Display Name]]''' or ||[[Page|Name]]
    const members = [];
    const rowPattern = /^\|\|?\s*(?:''')?(?:\[\[([^\]|]+?)(?:\|([^\]]+))?\]\])(?:''')?/gm;
    let m;
    while ((m = rowPattern.exec(wt)) !== null) {
      // Use display name if available, otherwise page name
      const name = m[2] || m[1];
      // Skip if it looks like a page reference rather than a character
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

// ---------------------------------------------------------------------------
// FormerMembers handler
// ---------------------------------------------------------------------------

async function buildFormerMembers(infobox, wikitext) {
  // First try extracting with Navigation support (some teams nest members in Navigation blocks)
  const withNav = extractFieldWithNavigation(wikitext, "FormerMembers");

  if (withNav) {
    // Check if the result is just a "See also" redirect
    if (SEE_ALSO_PATTERN.test(withNav)) {
      // Check if there's actual member data after the redirect header
      const afterRedirect = withNav.replace(/^.*?(?:See also|More information)[:\s]*[^\n]*\n*/i, "").trim();
      if (afterRedirect && afterRedirect.length > 30) {
        // Has real data after the redirect (like X-Men)
        return afterRedirect;
      }
      // Pure redirect — follow it
      const followed = await followMemberRedirect(infobox.FormerMembers || withNav);
      return followed;
    }
    return withNav;
  }

  // Fall back to standard infobox field
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

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

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

  // 5. Leaders — extract from raw wikitext to capture {{Navigation}} blocks
  row.leaders = extractFieldWithNavigation(wikitext, "Leaders");

  // 6. FormerMembers — handle "See also" redirects + Navigation blocks
  row.former_members = await buildFormerMembers(infobox, wikitext);

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
