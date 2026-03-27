// Enumerate event pages from Category:Events.
// No filtering needed — only ~384 pages, keep all.
// Writes page list to scripts/data/pages_events.json.
//
// Usage: node scripts/enumerate/enumerate-events.js

import axios from "axios";
import { writeFile } from "fs/promises";
import { delay } from "../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_PATH = "scripts/data/pages_events.json";

// ---------------------------------------------------------------------------
// Paginate Category:Events → collect all page titles
// ---------------------------------------------------------------------------

const titles = [];
let cmcontinue = undefined;
let batch = 0;

while (true) {
  const params = {
    action: "query",
    list: "categorymembers",
    cmtitle: "Category:Events",
    cmlimit: 500,
    cmtype: "page",
    format: "json",
  };
  if (cmcontinue) params.cmcontinue = cmcontinue;

  const res = await axios.get(API_URL, { params });
  const members = res.data.query.categorymembers;
  for (const m of members) titles.push(m.title);

  batch++;
  console.log(`  Batch ${batch}: +${members.length} pages (total: ${titles.length})`);

  cmcontinue = res.data.continue?.cmcontinue;
  if (!cmcontinue) break;
  await delay();
}

console.log(`\nTotal: ${titles.length} event pages`);

// Write as JSON array, one title per line
const json = "[\n" + titles.map((t) => `  ${JSON.stringify(t)}`).join(",\n") + "\n]\n";
await writeFile(OUT_PATH, json);
console.log(`Written to ${OUT_PATH}`);
