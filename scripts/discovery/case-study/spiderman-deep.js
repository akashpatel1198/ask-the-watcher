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

    // 1. Sections list
    const sectionsRes = await axios.get(API_URL, {
        params: { action: "parse", page, prop: "sections", format: "json" },
    });
    const sections = sectionsRes.data.parse.sections;

    // 2. Intro (section 0)
    const introRaw = await fetchSection(page, 0);
    const afterInfobox = introRaw?.split(/\}\}/g).pop().trim() || "";

    // 3. Grab specific sections by name
    const targetSections = ["Powers", "Abilities", "Weaknesses", "Powers and Abilities"];
    const sectionData = {};
    for (const s of sections) {
        if (targetSections.includes(s.line)) {
            sectionData[s.line] = await fetchSection(page, s.index);
        }
    }

    // 4. Build output
    const result = {
        page,
        intro: afterInfobox,
        sections: sections.map((s) => ({
            heading: s.line,
            level: s.toclevel,
            index: s.index,
        })),
        ...sectionData,
    };

    const filename = page.replace(/[\s()]/g, "_").replace(/_+/g, "_");
    const path = `${OUT_DIR}/${filename}.json`;
    await writeFile(path, JSON.stringify(result, null, 2));
    console.log(`  -> ${path}`);
}

console.log("\nDone!");
