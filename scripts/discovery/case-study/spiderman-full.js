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
    for (const line of wikitext.split("\n")) {
        const match = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
        if (match) {
            const value = match[2].trim();
            if (value) fields[match[1]] = value;
        }
    }
    return fields;
}

async function fetchSection(page, sectionIndex) {
    try {
        const res = await axios.get(API_URL, {
            params: {
                action: "parse",
                page,
                prop: "wikitext",
                section: sectionIndex,
                format: "json",
            },
        });
        return res.data.parse.wikitext["*"];
    } catch {
        return null;
    }
}

for (const page of characters) {
    console.log(`Fetching ${page}...`);

    // 1. Full wikitext for infobox
    const fullRes = await axios.get(API_URL, {
        params: {
            action: "parse",
            page,
            prop: "wikitext|sections",
            format: "json",
        },
    });
    const wikitext = fullRes.data.parse.wikitext["*"];
    const sections = fullRes.data.parse.sections;
    const infobox = parseInfobox(wikitext);

    // 2. Fetch target sections
    const targetNames = ["Powers", "Abilities", "Weaknesses", "Powers and Abilities"];
    const sectionContent = {};
    for (const s of sections) {
        if (targetNames.includes(s.line)) {
            sectionContent[s.line] = await fetchSection(page, s.index);
        }
    }

    // 3. Build output
    const result = {
        page,
        infobox,
        sectionContent,
    };

    const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_") + "_full";
    const path = `${OUT_DIR}/${filename}.json`;
    await writeFile(path, JSON.stringify(result, null, 2));
    console.log(`  -> ${path}`);
}

console.log("\nDone!");
