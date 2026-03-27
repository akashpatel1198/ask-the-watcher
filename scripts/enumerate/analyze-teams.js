// Analyze team pages from Category:Teams.
// Paginates the full category, batch-fetches byte sizes, prints histogram.
// Saves raw title+size data to enumerate/output/ for enumerate-teams.js to consume.
//
// Usage: node scripts/enumerate/analyze-teams.js

import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { delay } from "../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/enumerate/output";
const SIZES_PATH = `${OUT_DIR}/sizes_teams.json`;
await mkdir(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Paginate Category:Teams → collect all page titles
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
  const sizes = new Map();
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
// 3. Print byte size histogram
// ---------------------------------------------------------------------------

function printHistogram(sizes) {
  const buckets = [500, 1000, 2000, 3000, 5000, 10000, 20000, 50000, 100000, Infinity];
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
    console.log(`    ${prevBound.toLocaleString().padStart(7)}–${String(upper).padStart(7)} bytes: ${counts[i]} pages`);
    prevBound = buckets[i];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Analyzing teams from Category:Teams...\n");

const allTitles = await fetchAllCategoryMembers("Category:Teams");
console.log(`\nTotal pages in category: ${allTitles.length}`);

console.log("\nFetching byte sizes...");
const sizes = await fetchByteSizes(allTitles);

const cache = [...sizes.entries()];
await writeFile(SIZES_PATH, JSON.stringify(cache));
console.log(`\nSaved ${cache.length} title+size pairs to ${SIZES_PATH}`);

printHistogram(sizes);
console.log("\nNext step — filter and write page list:");
console.log(`  node scripts/enumerate/enumerate-teams.js <min-bytes>`);
