import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { parseInfobox } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/series/output";
await mkdir(OUT_DIR, { recursive: true });

const series = [
    // Major long-running series
    "Amazing Spider-Man Vol 1",
    "Uncanny X-Men Vol 1",
    "Avengers Vol 1",
    "Fantastic Four Vol 1",
    "Incredible Hulk Vol 1",
    "Iron Man Vol 1",
    "Thor Vol 1",
    "Captain America Vol 1",
    "X-Men Vol 1",
    "Daredevil Vol 1",
    "New Mutants Vol 1",
    "Secret Wars Vol 1",
    // Mid-tier / shorter runs
    "Moon Knight Vol 1",
    "Power Pack Vol 1",
    // Obscure / limited series
    "Sleepwalker Vol 1",
    "Darkhawk Vol 1",
];

// Track field frequency across all sampled series
const fieldCounts = {};
let successCount = 0;

for (const page of series) {
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
console.log(`\n=== Field Frequency (across ${successCount} series) ===\n`);
const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
for (const [field, count] of sorted) {
    const pct = Math.round((count / successCount) * 100);
    console.log(`  ${field}: ${count}/${successCount} (${pct}%)`);
}

console.log("\nDone!");
