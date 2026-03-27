// Enumerate series pages from Category:Volumes.
// Paginates the full category, batch-fetches byte sizes, filters stubs,
// and writes filtered titles to scripts/data/pages_series.json.

import axios from "axios";
import { writeFile } from "fs/promises";
import { delay } from "../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_PATH = "scripts/data/pages_series.json";

// Minimum page byte size to keep. Pages below this are stubs/redirects.
// Tune this after reviewing the histogram output.
const MIN_BYTES = 2000;

// ---------------------------------------------------------------------------
// 1. Paginate Category:Volumes → collect all page titles
// ---------------------------------------------------------------------------

async function fetchAllCategoryMembers(category) {
  const titles = [];
  let cmcontinue = undefined;
  let batch = 0;

  while (true) {
    const params = {
      action: "query",
      list: "categorymembers",
      cmtitle: category,
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

  return titles;
}

// ---------------------------------------------------------------------------
// 2. Batch-fetch byte sizes (50 titles per API call)
// ---------------------------------------------------------------------------

async function fetchByteSizes(titles) {
  const sizes = new Map(); // title → bytes
  const batchSize = 50;

  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    const res = await axios.get(API_URL, {
      params: {
        action: "query",
        titles: batch.join("|"),
        prop: "revisions",
        rvprop: "size",
        format: "json",
      },
    });

    const pages = res.data.query.pages;
    for (const page of Object.values(pages)) {
      if (page.revisions?.[0]?.size != null) {
        sizes.set(page.title, page.revisions[0].size);
      }
    }

    if (i % (batchSize * 10) === 0 && i > 0) {
      console.log(`  Size lookup: ${i}/${titles.length}`);
    }
    await delay();
  }

  return sizes;
}

// ---------------------------------------------------------------------------
// 3. Print byte size histogram for tuning
// ---------------------------------------------------------------------------

function printHistogram(sizes) {
  const buckets = [500, 1000, 2000, 3000, 5000, 10000, 20000, 50000, Infinity];
  const counts = new Array(buckets.length).fill(0);

  for (const bytes of sizes.values()) {
    for (let i = 0; i < buckets.length; i++) {
      if (bytes < buckets[i]) { counts[i]++; break; }
    }
  }

  console.log("\n  Byte size distribution:");
  let prevBound = 0;
  for (let i = 0; i < buckets.length; i++) {
    const upper = buckets[i] === Infinity ? "∞" : buckets[i].toLocaleString();
    console.log(`    ${prevBound.toLocaleString().padStart(6)}–${String(upper).padStart(6)} bytes: ${counts[i]} pages`);
    prevBound = buckets[i];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Enumerating series from Category:Volumes...\n");

const allTitles = await fetchAllCategoryMembers("Category:Volumes");
console.log(`\nTotal pages in category: ${allTitles.length}`);

console.log("\nFetching byte sizes...");
const sizes = await fetchByteSizes(allTitles);

printHistogram(sizes);

// Filter
const filtered = allTitles.filter((t) => (sizes.get(t) || 0) >= MIN_BYTES);
console.log(`\nFiltered: ${filtered.length} pages (≥ ${MIN_BYTES} bytes) out of ${allTitles.length}`);

// Write as JSON array, one title per line for readability
const json = "[\n" + filtered.map((t) => `  ${JSON.stringify(t)}`).join(",\n") + "\n]\n";
await writeFile(OUT_PATH, json);
console.log(`Written to ${OUT_PATH}`);
