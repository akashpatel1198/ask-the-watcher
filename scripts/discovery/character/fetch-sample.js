import axios from "axios";
import { writeFile, mkdir } from "fs/promises";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/character/output";
await mkdir(OUT_DIR, { recursive: true });

const characters = [
    "Peter Parker (Earth-616)",
    "Thor Odinson (Earth-616)",
    "Steven Rogers (Earth-616)",
    "Anthony Stark (Earth-616)",
    "Reed Richards (Earth-616)",
    "Victor von Doom (Earth-616)",
    "Bruce Banner (Earth-616)",
    "James Howlett (Earth-616)",
    "Scott Summers (Earth-616)",
];

function parseInfobox(wikitext) {
    const fields = {};
    let currentField = null;

    for (const line of wikitext.split("\n")) {
        // new field: "| FieldName = ..."
        const fieldMatch = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
        if (fieldMatch) {
            currentField = fieldMatch[1];
            const value = fieldMatch[2].trim();
            fields[currentField] = value;
        } else if (currentField) {
            // keep appending any line that isn't the start of a new field
            // stop on lines that are just "}}" (end of template)
            if (line.match(/^\}\}\s*$/)) {
                currentField = null;
            } else {
                fields[currentField] += "\n" + line;
            }
        }
    }

    // clean up: trim values, remove empty ones, strip {{Clear}} artifacts
    for (const key of Object.keys(fields)) {
        fields[key] = fields[key].replace(/^\{\{[Cc]lear\}\}\s*/, "").trim();
        if (!fields[key]) delete fields[key];
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

    const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
    const path = `${OUT_DIR}/${filename}.json`;
    await writeFile(path, JSON.stringify(infobox, null, 2));
    console.log(`  -> ${path} (${Object.keys(infobox).length} fields)`);
}

console.log("\nDone!");
