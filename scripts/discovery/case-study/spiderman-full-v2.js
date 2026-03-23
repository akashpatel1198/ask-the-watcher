import axios from "axios";
import { writeFile, mkdir } from "fs/promises";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/case-study/output";
await mkdir(OUT_DIR, { recursive: true });

const characters = [
    "Peter Parker (Earth-616)",
    "Ai Apaec (Earth-616)",
    "William Braddock (Earth-833)",
];

function parseInfobox(wikitext) {
    const fields = {};
    let currentField = null;

    for (const line of wikitext.split("\n")) {
        // new field starts with "| FieldName ="
        const fieldMatch = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
        if (fieldMatch) {
            currentField = fieldMatch[1];
            const value = fieldMatch[2].trim();
            fields[currentField] = value;
        } else if (currentField && (line.startsWith("*") || line.startsWith("**"))) {
            // continuation line (bullet points belonging to current field)
            fields[currentField] += "\n" + line;
        } else if (line.match(/^\}\}/) || line.match(/^\|/)) {
            // end of field or template boundary
            currentField = null;
        }
    }

    // remove empty fields
    for (const key of Object.keys(fields)) {
        if (!fields[key].trim()) delete fields[key];
    }

    return fields;
}

for (const page of characters) {
    console.log(`Fetching ${page}...`);

    const res = await axios.get(API_URL, {
        params: { action: "parse", page, prop: "wikitext", format: "json" },
    });
    const wikitext = res.data.parse.wikitext["*"];
    const infobox = parseInfobox(wikitext);

    const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_") + "_v2";
    const path = `${OUT_DIR}/${filename}.json`;
    await writeFile(path, JSON.stringify(infobox, null, 2));
    console.log(`  -> ${path} (${Object.keys(infobox).length} fields)`);
}

console.log("\nDone!");
