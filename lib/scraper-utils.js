// Shared utilities for scraping scripts

import axios from "axios";

const DEFAULT_DELAY_MS = 800;

/**
 * Delay between requests to be respectful to the wiki
 */
export function delay(ms = DEFAULT_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a page and return the HTML string
 */
export async function fetchPage(url) {
  const { data } = await axios.get(url);
  return data;
}

/**
 * Resolve a wiki image filename to its full CDN URL.
 * Uses the MediaWiki imageinfo API.
 *
 * @param {string} filename - e.g., "Peter_Parker_(Earth-616)_from_Amazing_Spider-Man_Vol_5_15_Cover.jpg"
 * @returns {string|null} Full image URL, or null if not found
 */
export async function resolveImageUrl(filename) {
  if (!filename) return null;
  const cleaned = filename.replace(/^\s*(?:File:|Image:)/i, "").trim();
  if (!cleaned) return null;

  const { data } = await axios.get("https://marvel.fandom.com/api.php", {
    params: {
      action: "query",
      titles: `File:${cleaned}`,
      prop: "imageinfo",
      iiprop: "url",
      format: "json",
    },
  });

  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  if (page.imageinfo && page.imageinfo[0]) {
    return page.imageinfo[0].url;
  }
  return null;
}

// Multi-line templates that are page-layout chrome, not entity data.
// When these appear as the start of a field value, the entire field is junk.
const LAYOUT_TEMPLATES = ["{{Navigation", "{{MessageBox", "{{Conversation", "{{Eisner Award", "{{navigation", "{{messageBox", "{{conversation", "{{eisner award"];

/**
 * Parse infobox fields from raw wikitext.
 *
 * Extracts "| FieldName = Value" pairs, handles multi-line values,
 * and strips layout template artifacts ({{Navigation}}, {{MessageBox}}, {{Clear}}).
 */
export function parseInfobox(wikitext) {
  const fields = {};
  let currentField = null;
  let insideLayoutTemplate = false;

  for (const line of wikitext.split("\n")) {
    // Detect entry into a layout template — skip its fields entirely
    if (/^\{\{(Navigation|MessageBox|Conversation|Eisner Award)/i.test(line)) {
      insideLayoutTemplate = true;
      currentField = null;
      continue;
    }

    // Detect exit from a layout template
    if (insideLayoutTemplate) {
      if (line.match(/\}\}\s*$/)) {
        insideLayoutTemplate = false;
      }
      continue;
    }

    const fieldMatch = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
    if (fieldMatch) {
      currentField = fieldMatch[1];
      const value = fieldMatch[2].trim();
      fields[currentField] = value;
    } else if (currentField) {
      if (line.match(/^\}\}\s*$/)) {
        currentField = null;
      } else {
        fields[currentField] += "\n" + line;
      }
    }
  }

  for (const key of Object.keys(fields)) {
    // Strip {{Clear}} artifacts
    fields[key] = fields[key].replace(/^\{\{[Cc]lear\}\}\s*/, "").trim();

    // Remove trailing layout templates ({{Navigation..., {{MessageBox...)
    // These leak in from page-level templates that span across field boundaries
    for (const tmpl of LAYOUT_TEMPLATES) {
      const idx = fields[key].indexOf(tmpl);
      if (idx !== -1) {
        fields[key] = fields[key].slice(0, idx).trim();
      }
    }

    // Remove stray closing braces left from split layout templates
    fields[key] = fields[key].replace(/^\}\}\s*/, "").trim();

    if (!fields[key]) delete fields[key];
  }

  return fields;
}

/**
 * Extract wiki page titles from raw wikitext.
 *
 * Finds all [[Page|Display]] and [[Page]] link patterns and returns the
 * page title portion as an array of strings, normalized with underscores.
 * Used to build join table foreign keys before cleanWikitext() strips the links.
 *
 * Skips File:, Image:, and Category: links (not entity references).
 *
 * @param {string} raw - Raw wikitext string
 * @returns {string[]} Deduplicated array of page titles (e.g., ["Peter_Parker_(Earth-616)"])
 */
export function extractWikiLinks(raw) {
  if (!raw || typeof raw !== "string") return [];
  const titles = new Set();
  const pattern = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    const page = match[1].trim();
    if (/^(File|Image|Category):/i.test(page)) continue;
    titles.add(page.replace(/ /g, "_"));
  }
  return [...titles];
}

/**
 * Clean raw wikitext markup into plain text.
 *
 * Handles: HTML tags, wiki links, templates, bold/italic markup.
 * Designed for infobox field values scraped from marvel.fandom.com.
 */
export function cleanWikitext(raw) {
  if (!raw || typeof raw !== "string") return raw;

  let text = raw;

  // --- HTML cleanup ---

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Remove <ref>...</ref> blocks (including multiline, with attributes)
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  // Remove self-closing <ref ... />
  text = text.replace(/<ref[^/]*\/>/gi, "");
  // Remove <references ... />
  text = text.replace(/<references[^>]*\/>/gi, "");

  // <br> / <br/> → newline
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // <nowiki>text</nowiki> → text
  text = text.replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, "$1");

  // <h1>–<h6> → inner text
  text = text.replace(/<h(\d)[^>]*>([\s\S]*?)<\/h\1>/gi, "$2");

  // Strip any remaining HTML tags
  text = text.replace(/<\/?[a-z][^>]*>/gi, "");

  // --- Wiki image syntax (must run before wiki link resolution) ---

  // [[File:...|thumb|...]] or [[Image:...|thumb|...]] → remove entirely
  text = text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");
  // Stray "thumb|..." remnants from partially parsed image tags
  text = text.replace(/\bthumb\|[^\n]*/g, "");
  text = text.replace(/\bthumb\b/g, "");

  // --- Category tags ---

  // [[Category:...]] → remove entirely
  text = text.replace(/\[\[Category:[^\]]*\]\]/gi, "");

  // --- Wiki section headers ---

  // ===Header=== or ==Header== → just the inner text
  text = text.replace(/^(={2,6})\s*(.*?)\s*\1\s*$/gm, "$2");

  // --- Wiki links (resolve before templates, since templates often wrap links) ---

  // [[Page|Display]] → Display
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  // [[Page]] → Page
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // --- Incomplete multi-line templates (leaked from infobox parser) ---

  // {{Navigation... and {{MessageBox... appear at the end of fields without
  // a closing }}. Strip from the opening {{ to end of string.
  text = text.replace(/\{\{(Navigation|MessageBox)\b[\s\S]*/gi, "");

  // --- Templates (multiple passes to handle nesting, innermost first) ---

  for (let i = 0; i < 10; i++) {
    const before = text;
    text = resolveTemplates(text);
    if (text === before) break;
  }

  // --- Orphaned closing braces/brackets (from split multi-line templates/links) ---

  // Any }} still present after template resolution has no matching {{ — remove it
  text = text.replace(/\}\}/g, "");
  // Any ]] still present after link resolution has no matching [[ — remove it
  text = text.replace(/\]\]/g, "");

  // --- Bold / italic markup ---

  // Bold+italic (5 quotes) before bold (3) before italic (2)
  text = text.replace(/'{5}([\s\S]*?)'{5}/g, "$1");
  text = text.replace(/'{3}([\s\S]*?)'{3}/g, "$1");
  text = text.replace(/'{2}([\s\S]*?)'{2}/g, "$1");

  // --- External links ---

  // [url display text] → display text
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1");
  // [url] → (remove bare bracketed URLs)
  text = text.replace(/\[https?:\/\/[^\]]+\]/g, "");
  // Bare URLs left as-is

  // --- Whitespace cleanup ---

  // Strip trailing commas (left behind when list items are removed)
  text = text.replace(/,\s*$/gm, "");

  // Collapse 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");
  // Trim trailing whitespace per line
  text = text.replace(/[ \t]+$/gm, "");
  // Trim leading/trailing whitespace
  text = text.trim();

  return text;
}

// Templates we remove entirely (citations, annotations, layout)
const REMOVE_TEMPLATES = new Set([
  "r",
  "citation",
  "chronology",
  "1stfull",
  "1st full",
  "clear",
  "c",
  "main",
  "see also",
  "further",
  "expand section",
  "incomplete",
  "citation needed",
]);

// Prefixes — any template whose name starts with these gets removed
const REMOVE_PREFIXES = ["cite", "navigation", "eisner"];

// Templates that extract their first content argument
// {{name|content}} → content, {{name|content|extra}} → content
const EXTRACT_FIRST_ARG = new Set([
  "1st",
  "a",
  "m",
  "referenced",
  "recaponly",
  "recap only",
  "only dies",
  "destruction",
  "center",
  "power",
  "1stchron",
]);

// ---------------------------------------------------------------------------
// Production scrape runner
// ---------------------------------------------------------------------------

const API_URL = "https://marvel.fandom.com/api.php";
const SAVE_INTERVAL = 50; // flush every N pages

/**
 * Fetch wikitext with exponential backoff on 429/5xx.
 * Returns { wikitext, error } — one will be null.
 */
async function fetchWithBackoff(pageTitle, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(API_URL, {
        params: { action: "parse", page: pageTitle, prop: "wikitext", format: "json" },
      });

      if (res.data.error || !res.data.parse?.wikitext) {
        return { wikitext: null, error: res.data.error?.info || "redirect or missing page" };
      }
      return { wikitext: res.data.parse.wikitext["*"], error: null };
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 || (status >= 500 && status < 600)) {
        const backoffMs = DEFAULT_DELAY_MS * Math.pow(2, attempt + 1);
        console.log(`  ⏳ ${status} on "${pageTitle}" — retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await delay(backoffMs);
        continue;
      }
      return { wikitext: null, error: err.response?.status ? `HTTP ${status}` : err.message };
    }
  }
  return { wikitext: null, error: "max retries exceeded" };
}

/**
 * Production scrape runner. Handles resumability, incremental saves, failure tracking,
 * and backoff. Each entity's scrape script provides the entity-specific logic via config.
 *
 * @param {object} config
 * @param {string}   config.entity         — entity name (e.g., "characters")
 * @param {string}   config.pagesFile      — path to pages_*.json
 * @param {string}   config.outDir         — output directory (e.g., "scripts/data")
 * @param {function} config.processPage    — async (pageTitle, wikitext) => { row, joins }
 *   row: DB-ready object (or null to skip)
 *   joins: { tableName: [joinRow, ...], ... } (optional)
 */
export async function runScraper(config) {
  const { entity, pagesFile, outDir, processPage } = config;
  const { readFile, writeFile, mkdir } = await import("fs/promises");
  await mkdir(outDir, { recursive: true });

  // --- File paths ---
  const entityOutPath = `${outDir}/scrape_${entity}.json`;
  const progressPath = `${outDir}/.progress_${entity}.json`;
  const failurePath = `${outDir}/.failures_${entity}.json`;

  // --- Load page list ---
  const allPages = JSON.parse(await readFile(pagesFile, "utf8"));

  // --- Check --retry-failures flag ---
  const retryMode = process.argv.includes("--retry-failures");

  let pages;
  if (retryMode) {
    const failures = JSON.parse(await readFile(failurePath, "utf8").catch(() => "[]"));
    pages = failures.map((f) => f.page_title);
    console.log(`[${entity}] Retry mode — ${pages.length} failed pages to retry`);
    // Clear failure log for this retry run (will re-populate if they fail again)
    await writeFile(failurePath, "[]");
  } else {
    pages = allPages;
  }

  // --- Load existing state ---
  const progress = new Set(JSON.parse(await readFile(progressPath, "utf8").catch(() => "[]")));
  const existingRows = JSON.parse(await readFile(entityOutPath, "utf8").catch(() => "[]"));
  const failures = JSON.parse(await readFile(failurePath, "utf8").catch(() => "[]"));

  // --- Load existing join data ---
  // Scan outDir for any joins_*.json files belonging to this entity's join tables
  const joinAccumulators = {};

  const rows = existingRows;
  let processed = 0;
  const skipped = pages.filter((p) => progress.has(p.replace(/ /g, "_"))).length;

  console.log(`[${entity}] ${pages.length} total pages, ${skipped} already done, ${pages.length - skipped} to process`);

  // --- Flush helper ---
  async function flush() {
    await writeFile(entityOutPath, JSON.stringify(rows, null, 2));
    await writeFile(progressPath, JSON.stringify([...progress]));
    await writeFile(failurePath, JSON.stringify(failures, null, 2));

    // Flush join files
    for (const [tableName, joinRows] of Object.entries(joinAccumulators)) {
      const joinPath = `${outDir}/joins_${tableName}.json`;
      // Merge with any existing data on disk (in case of resume from a different run)
      const existing = JSON.parse(await readFile(joinPath, "utf8").catch(() => "[]"));
      // Only write if we have new data beyond what's on disk
      if (joinRows.length > existing.length) {
        await writeFile(joinPath, JSON.stringify(joinRows, null, 2));
      }
    }

    console.log(`  💾 Saved: ${rows.length} rows, ${progress.size} progress, ${failures.length} failures`);
  }

  // --- Main loop ---
  for (const pageTitle of pages) {
    const wikiPageTitle = pageTitle.replace(/ /g, "_");

    // Skip if already done
    if (progress.has(wikiPageTitle)) continue;

    console.log(`[${progress.size + 1}/${pages.length}] ${pageTitle}`);

    // 1. Fetch with backoff
    const { wikitext, error } = await fetchWithBackoff(pageTitle);
    if (error) {
      console.log(`  !! ${error} — skipping`);
      failures.push({ page_title: pageTitle, error, timestamp: new Date().toISOString() });
      progress.add(wikiPageTitle);
      await delay();
      processed++;
      if (processed % SAVE_INTERVAL === 0) await flush();
      continue;
    }

    // 2. Parse infobox
    const infobox = parseInfobox(wikitext);
    if (Object.keys(infobox).length === 0) {
      console.log(`  !! Empty infobox (redirect?) — skipping`);
      failures.push({ page_title: pageTitle, error: "empty infobox", timestamp: new Date().toISOString() });
      progress.add(wikiPageTitle);
      await delay();
      processed++;
      if (processed % SAVE_INTERVAL === 0) await flush();
      continue;
    }

    // 3. Entity-specific processing
    try {
      const result = await processPage(pageTitle, wikitext, infobox);
      if (result && result.row) {
        rows.push(result.row);

        // Accumulate joins
        if (result.joins) {
          for (const [tableName, joinRows] of Object.entries(result.joins)) {
            if (!joinAccumulators[tableName]) {
              // Load existing join data from disk on first encounter
              const joinPath = `${outDir}/joins_${tableName}.json`;
              joinAccumulators[tableName] = JSON.parse(await readFile(joinPath, "utf8").catch(() => "[]"));
            }
            joinAccumulators[tableName].push(...joinRows);
          }
        }

        const populated = Object.values(result.row).filter((v) => v !== null).length;
        const total = Object.keys(result.row).length;
        console.log(`  ✓ ${populated}/${total} fields`);
      }
    } catch (err) {
      console.log(`  !! processPage error: ${err.message} — skipping`);
      failures.push({ page_title: pageTitle, error: err.message, timestamp: new Date().toISOString() });
    }

    progress.add(wikiPageTitle);
    processed++;

    if (processed % SAVE_INTERVAL === 0) await flush();
    await delay();
  }

  // --- Final flush ---
  await flush();
  console.log(`\n[${entity}] Done! ${rows.length} rows, ${failures.length} failures`);
}

/**
 * Resolve innermost {{...}} templates in a single pass.
 * Called repeatedly to handle nesting.
 */
function resolveTemplates(text) {
  return text.replace(/\{\{([^{}]*)\}\}/g, (_match, inner) => {
    const parts = inner.split("|");
    const name = parts[0].trim();
    const nameLower = name.toLowerCase();

    // Remove templates
    if (REMOVE_TEMPLATES.has(nameLower)) return "";
    if (REMOVE_PREFIXES.some((p) => nameLower.startsWith(p))) return "";

    // {{cl|Title}} → Title, {{cl|Title|Short}} → Short
    if (nameLower === "cl" || nameLower === "sld") {
      if (parts.length > 2) return parts[parts.length - 1].trim();
      return (parts[1] || "").trim();
    }

    // {{apn|Name|prev|next}} → Name
    if (nameLower === "apn") {
      return (parts[1] || "").trim();
    }

    // {{Quote|text|speaker|source}} → text
    if (nameLower === "quote") {
      return (parts[1] || "").trim();
    }

    // {{WP|WikiTitle|Display}} → Display
    if (nameLower === "wp") {
      return parts.length > 2 ? parts[2].trim() : (parts[1] || "").trim();
    }

    // {{Glossary:Term|Display}} → Display
    if (nameLower.startsWith("glossary:")) {
      return parts.length > 1 ? parts[1].trim() : name.split(":")[1].trim();
    }

    // Extract first content arg
    if (EXTRACT_FIRST_ARG.has(nameLower)) {
      return (parts[1] || "").trim();
    }

    // Unknown template with args — extract first arg as best guess
    if (parts.length > 1) {
      return parts[1].trim();
    }

    // Unknown template with no args — remove
    return "";
  });
}
