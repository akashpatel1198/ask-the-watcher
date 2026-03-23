import axios from "axios";
import { writeFile, mkdir } from "fs/promises";

const API_URL = "https://marvel.fandom.com/api.php";
const OUT_DIR = "scripts/discovery/comic/output";
await mkdir(OUT_DIR, { recursive: true });

const issues = [
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

for (const page of issues) {
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
