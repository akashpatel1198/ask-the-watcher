// Filter character pages by byte size and write the page list for scraping.
// Reads pre-computed sizes from analyze-characters.js output.
//
// Usage: node scripts/enumerate/enumerate-characters.js <min-bytes>
//   e.g. node scripts/enumerate/enumerate-characters.js 4000

import { writeFile, readFile } from "fs/promises";

const SIZES_PATH = "scripts/enumerate/output/sizes_characters.json";
const OUT_PATH = "scripts/data/pages_characters.json";

const threshold = Number(process.argv[2]);
if (!threshold) {
  console.error("Usage: node scripts/enumerate/enumerate-characters.js <min-bytes>");
  console.error("  Run analyze-characters.js first to generate size data.");
  process.exit(1);
}

// Load cached sizes
let cache;
try {
  cache = JSON.parse(await readFile(SIZES_PATH, "utf8"));
} catch {
  console.error(`No size data found at ${SIZES_PATH} — run analyze-characters.js first.`);
  process.exit(1);
}

const sizes = new Map(cache);

// Print histogram for reference
const buckets = [500, 1000, 2000, 3000, 5000, 10000, 20000, 50000, 100000, Infinity];
const counts = new Array(buckets.length).fill(0);
for (const bytes of sizes.values()) {
  for (let i = 0; i < buckets.length; i++) {
    if (bytes < buckets[i]) { counts[i]++; break; }
  }
}
console.log("Byte size distribution:");
let prevBound = 0;
for (let i = 0; i < buckets.length; i++) {
  const upper = buckets[i] === Infinity ? "∞" : buckets[i].toLocaleString();
  console.log(`  ${prevBound.toLocaleString().padStart(7)}–${String(upper).padStart(7)} bytes: ${counts[i]} pages`);
  prevBound = buckets[i];
}

// Filter
const filtered = [...sizes.entries()]
  .filter(([, bytes]) => bytes >= threshold)
  .map(([title]) => title);

console.log(`\nFiltered: ${filtered.length.toLocaleString()} pages (≥ ${threshold} bytes) out of ${sizes.size.toLocaleString()}`);

// Write as JSON array, one title per line
const json = "[\n" + filtered.map((t) => `  ${JSON.stringify(t)}`).join(",\n") + "\n]\n";
await writeFile(OUT_PATH, json);
console.log(`Written to ${OUT_PATH}`);
