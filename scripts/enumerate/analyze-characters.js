// Analyze character pages from Category:Characters.
// Paginates the full category, batch-fetches byte sizes, prints histogram.
// Saves raw title+size data to enumerate/output/ for enumerate-characters.js to consume.
//
// Resumable — saves progress frequently. Re-run safely if interrupted.
//
// Usage: node scripts/enumerate/analyze-characters.js
//
// WARNING: ~98,000 pages — this will take a while.
// Pagination: ~197 batches × 800ms ≈ ~3 min
// Size lookups: ~1,960 batches × 800ms ≈ ~26 min
// Total: ~30–35 min

import axios from "axios";
import { writeFile, readFile, mkdir } from "fs/promises";
import { delay } from "../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/enumerate/output";
const TITLES_CACHE = `${OUT_DIR}/.titles_characters.json`;
const SIZES_PATH = `${OUT_DIR}/sizes_characters.json`;
const PROGRESS_PATH = `${OUT_DIR}/.progress_characters.json`;
await mkdir(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Paginate Category:Characters → collect all page titles (resumable)
// ---------------------------------------------------------------------------

async function fetchAllCategoryMembers(category) {
  // Check for cached titles from a previous run
  try {
    const cached = JSON.parse(await readFile(TITLES_CACHE, "utf8"));
    console.log(`  Loaded ${cached.length.toLocaleString()} cached titles from previous run`);
    return cached;
  } catch { /* no cache, fetch fresh */ }

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
    if (batch % 20 === 0 || !res.data.continue?.cmcontinue) {
      console.log(`  Pagination batch ${batch}: ${titles.length.toLocaleString()} pages so far`);
    }

    cmcontinue = res.data.continue?.cmcontinue;
    if (!cmcontinue) break;
    await delay();
  }

  // Cache titles so pagination doesn't need to rerun
  await writeFile(TITLES_CACHE, JSON.stringify(titles));
  return titles;
}

// ---------------------------------------------------------------------------
// 2. Batch-fetch byte sizes (50 titles per API call, resumable)
// ---------------------------------------------------------------------------

async function fetchByteSizes(titles) {
  // Load any existing progress
  let sizes = new Map();
  try {
    const progress = JSON.parse(await readFile(PROGRESS_PATH, "utf8"));
    sizes = new Map(progress);
    console.log(`  Resuming from ${sizes.size.toLocaleString()} already-fetched sizes`);
  } catch { /* fresh start */ }

  const batchSize = 50;
  let skipped = 0;

  for (let i = 0; i < titles.length; i += batchSize) {
    // Skip batches we already have
    const batch = titles.slice(i, i + batchSize);
    if (batch.every((t) => sizes.has(t))) {
      skipped += batch.length;
      continue;
    }

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

    // Save progress every 50 batches (~2,500 titles)
    if ((i / batchSize) % 50 === 0 && i > 0) {
      await writeFile(PROGRESS_PATH, JSON.stringify([...sizes.entries()]));
      console.log(`  Size lookup: ${sizes.size.toLocaleString()}/${titles.length.toLocaleString()} (checkpoint saved)`);
    } else if (i % (batchSize * 20) === 0 && i > 0) {
      console.log(`  Size lookup: ${sizes.size.toLocaleString()}/${titles.length.toLocaleString()}`);
    }

    await delay();
  }

  if (skipped > 0) {
    console.log(`  Skipped ${skipped.toLocaleString()} already-cached titles`);
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

console.log("Analyzing characters from Category:Characters...\n");

const allTitles = await fetchAllCategoryMembers("Category:Characters");
console.log(`\nTotal pages in category: ${allTitles.length.toLocaleString()}`);

console.log("\nFetching byte sizes...");
const sizes = await fetchByteSizes(allTitles);

// Write final output
const cache = [...sizes.entries()];
await writeFile(SIZES_PATH, JSON.stringify(cache));
console.log(`\nSaved ${cache.length.toLocaleString()} title+size pairs to ${SIZES_PATH}`);

printHistogram(sizes);
console.log("\nNext step — filter and write page list:");
console.log(`  node scripts/enumerate/enumerate-characters.js <min-bytes>`);
