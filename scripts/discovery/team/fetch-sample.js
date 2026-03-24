import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { parseInfobox } from "../../../lib/scraper-utils.js";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/team/output";
await mkdir(OUT_DIR, { recursive: true });

// Mix of popular marquee teams + smaller/obscure ones
const teams = [
    // Popular
    "Avengers (Earth-616)",
    "X-Men (Earth-616)",
    "Fantastic Four (Earth-616)",
    "Guardians of the Galaxy (Earth-616)",
    "S.H.I.E.L.D. (Earth-616)",
    "Hydra (Earth-616)",
    // Mid-tier / well-known but smaller
    "Sinister Six (Earth-616)",
    "Brotherhood of Mutants (Earth-616)",
    "Defenders (Earth-616)",
    "Thunderbolts (Earth-616)",
    // Obscure
    "198 (Earth-616)",
    "3Peace (Earth-616)",
    "8-Ball's Gang (Earth-616)",
    "A-Force (Earth-616)",
];

// Track field frequency across all sampled teams
const fieldCounts = {};
let successCount = 0;

for (const page of teams) {
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
        console.log(`  !! Failed: ${err.response?.status || err.message}`);
    }
}

// Print field frequency summary
console.log(`\n=== Field Frequency (across ${successCount} teams) ===\n`);
const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
for (const [field, count] of sorted) {
    const pct = Math.round((count / successCount) * 100);
    console.log(`  ${field}: ${count}/${successCount} (${pct}%)`);
}

console.log("\nDone!");
