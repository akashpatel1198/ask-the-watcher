import axios from "axios";
import { writeFile, mkdir } from "fs/promises";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/event/output";
await mkdir(OUT_DIR, { recursive: true });

// Mix of popular crossover events + smaller/obscure ones + real-world events
const events = [
    // Major crossover events
    "Civil War (Event)",
    "Secret Wars (1984 Event)",
    "Secret Wars (2015 Event)",
    "Infinity Gauntlet (Event)",
    "House of M (Event)",
    "Secret Invasion (Event)",
    // Mid-tier
    "Annihilation (Event)",
    "Age of Apocalypse (Event)",
    "Atlantis Attacks",
    "Armor Wars I",
    // Obscure / smaller
    "Blood Hunt",
    "Acts of Evil",
    "Battle of the Atom",
    "'Nuff Said",
];

function parseInfobox(wikitext) {
    const fields = {};
    let currentField = null;

    for (const line of wikitext.split("\n")) {
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
        fields[key] = fields[key].replace(/^\{\{[Cc]lear\}\}\s*/, "").trim();
        if (!fields[key]) delete fields[key];
    }

    return fields;
}

// Track field frequency across all sampled events
const fieldCounts = {};
let successCount = 0;

for (const page of events) {
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
console.log(`\n=== Field Frequency (across ${successCount} events) ===\n`);
const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
for (const [field, count] of sorted) {
    const pct = Math.round((count / successCount) * 100);
    console.log(`  ${field}: ${count}/${successCount} (${pct}%)`);
}

console.log("\nDone!");
