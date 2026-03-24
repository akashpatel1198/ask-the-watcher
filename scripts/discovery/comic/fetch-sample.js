import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { parseInfobox } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/comic/output";
await mkdir(OUT_DIR, { recursive: true });

const issues = [
    // Iconic / landmark issues
    "Amazing Fantasy Vol 1 15",
    "Amazing Spider-Man Vol 1 300",
    "X-Men Vol 1 137",
    "Incredible Hulk Vol 1 181",
    "Giant-Size X-Men Vol 1 1",
    "Avengers Vol 1 1",
    "Fantastic Four Vol 1 1",
    "Iron Man Vol 1 128",
    "X-Men Vol 1 1",
    "Marvel Super Heroes Secret Wars Vol 1 8",
    // Mid-tier
    "New Mutants Vol 1 98",
    "Avengers Vol 1 57",
    "Daredevil Vol 1 168",
    // Obscure / lesser-known
    "Sleepwalker Vol 1 2",
    "Darkhawk Vol 1 1",
    "Slingers Vol 1 1",
];

// Track field frequency across all sampled issues
const fieldCounts = {};
let successCount = 0;

for (const page of issues) {
    console.log(`Fetching ${page}...`);

    try {
        const res = await axios.get(API_URL, {
            params: { action: "parse", page, prop: "wikitext", format: "json" },
        });
        const wikitext = res.data.parse.wikitext["*"];
        const infobox = parseInfobox(wikitext);

        const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
        const path = `${OUT_DIR}/${filename}.json`;
        await writeFile(path, JSON.stringify(infobox, null, 2));

        const fieldNames = Object.keys(infobox);
        for (const f of fieldNames) {
            fieldCounts[f] = (fieldCounts[f] || 0) + 1;
        }

        console.log(`  -> ${path} (${fieldNames.length} fields)`);
        successCount++;
    } catch (err) {
        console.log(`  !! Failed: ${err.response?.data?.error?.info || err.message}`);
    }
}

// Print field frequency summary
console.log(`\n=== Field Frequency (across ${successCount} issues) ===\n`);
const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
for (const [field, count] of sorted) {
    const pct = Math.round((count / successCount) * 100);
    console.log(`  ${field}: ${count}/${successCount} (${pct}%)`);
}

console.log("\nDone!");
