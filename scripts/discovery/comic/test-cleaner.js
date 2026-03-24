import { readFile, readdir, writeFile } from "fs/promises";
import { cleanWikitext } from "../../../lib/scraper-utils.js";

const OUT_DIR = "scripts/discovery/comic/output";
const RESULT_PATH = "scripts/discovery/comic/output/cleaner-results.json";

// Patterns that shouldn't survive cleaning
const RESIDUAL_PATTERNS = [
  { name: "template", pattern: /\{\{/ },
  { name: "wiki-link", pattern: /\[\[/ },
  { name: "ref-tag", pattern: /<ref/i },
  { name: "stray-close-bracket", pattern: /\]\]/ },
  { name: "stray-close-brace", pattern: /\}\}/ },
];

const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".json") && f !== "cleaner-results.json");
const results = [];
let totalFields = 0;
let changedFields = 0;
let flaggedFields = 0;
let errorFields = 0;

for (const file of files) {
  const raw = JSON.parse(await readFile(`${OUT_DIR}/${file}`, "utf8"));
  const entry = { file, fields: [] };

  for (const [field, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    totalFields++;

    let cleaned;
    let error = null;
    try {
      cleaned = cleanWikitext(value);
    } catch (e) {
      error = e.message;
      cleaned = value;
      errorFields++;
    }

    const changed = cleaned !== value;
    const residual = error
      ? []
      : RESIDUAL_PATTERNS.filter((p) => p.pattern.test(cleaned)).map((p) => p.name);

    if (!changed && !error && residual.length === 0) continue;

    if (changed) changedFields++;
    if (residual.length > 0) flaggedFields++;

    let status = "CLEANED";
    if (error) status = "ERROR";
    else if (residual.length > 0) status = "FLAGGED";

    entry.fields.push({
      field,
      status,
      ...(error && { error }),
      ...(residual.length > 0 && { residual }),
      before: value,
      after: cleaned,
    });
  }

  results.push(entry);
}

const output = {
  summary: {
    files: files.length,
    totalFields,
    changedFields,
    flaggedFields,
    errorFields,
  },
  results,
};

await writeFile(RESULT_PATH, JSON.stringify(output, null, 2));
console.log(`Results written to ${RESULT_PATH}`);
console.log(`  ${files.length} files, ${totalFields} fields, ${changedFields} changed, ${flaggedFields} flagged, ${errorFields} errors`);
