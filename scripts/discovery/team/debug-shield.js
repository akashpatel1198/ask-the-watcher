import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// 1. Search for SHIELD to find the correct page title
console.log("=== Searching for SHIELD variants ===\n");
const searches = ["S.H.I.E.L.D.", "SHIELD", "S.H.I.E.L.D. Earth-616"];
for (const query of searches) {
    const res = await axios.get(API_URL, {
        params: { action: "opensearch", search: query, limit: 10, format: "json" },
    });
    console.log(`"${query}":`);
    res.data[1].forEach((t) => console.log(`  ${t}`));
    console.log();
}

// 2. Try parsing a few candidate page titles to see which one has an infobox
const candidates = [
    "S.H.I.E.L.D. (Earth-616)",
    "Strategic Homeland Intervention, Enforcement and Logistics Division (Earth-616)",
    "S.H.I.E.L.D.",
    "SHIELD (Earth-616)",
];

for (const page of candidates) {
    console.log(`\n=== Trying: "${page}" ===`);
    try {
        const res = await axios.get(API_URL, {
            params: { action: "parse", page, prop: "wikitext", format: "json" },
        });
        const wikitext = res.data.parse.wikitext["*"];
        const fieldLines = wikitext.split("\n").filter((l) => l.match(/^\|\s*(.+?)\s*=\s*(.*)/));
        if (fieldLines.length === 0) {
            console.log("  No infobox fields found (page exists but no template)");
            console.log("  First 300 chars:", wikitext.slice(0, 300));
        } else {
            console.log(`  Found ${fieldLines.length} infobox fields:`);
            for (const line of fieldLines.slice(0, 15)) {
                const m = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
                console.log(`  ${m[1]} = ${m[2].trim().slice(0, 120)}`);
            }
            if (fieldLines.length > 15) console.log(`  ... and ${fieldLines.length - 15} more`);
        }
    } catch (err) {
        console.log(`  Failed: ${err.response?.data?.error?.info || err.message}`);
    }
}
