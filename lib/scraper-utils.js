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

  // --- Orphaned closing braces (from split multi-line templates) ---

  // Any }} still present after template resolution has no matching {{ — remove it
  text = text.replace(/\}\}/g, "");

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
