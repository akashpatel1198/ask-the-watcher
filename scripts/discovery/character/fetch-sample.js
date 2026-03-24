import axios from "axios";
import { writeFile, mkdir } from "fs/promises";
import { parseInfobox } from "../../../lib/scraper-utils.js";

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
