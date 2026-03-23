import axios from "axios";
import { writeFile, mkdir } from "fs/promises";

const API_URL = "https://marvel.fandom.com/api.php";
const PAGE = "Peter Parker (Earth-616)";
const OUT_DIR = "scripts/discovery/case-study/output";
await mkdir(OUT_DIR, { recursive: true });

// 1. Full wikitext — first 15k chars to search for intro blurb
const wikiRes = await axios.get(API_URL, {
    params: { action: "parse", page: PAGE, prop: "wikitext", format: "json" },
});
const wikitext = wikiRes.data.parse.wikitext["*"];

// 2. Section 0 as rendered HTML — first 15k chars to find intro past infobox
const htmlRes = await axios.get(API_URL, {
    params: { action: "parse", page: PAGE, prop: "text", section: 0, format: "json" },
});
const html = htmlRes.data.parse.text["*"];

// 3. Extract sections from wikitext by heading markers
const sectionRegex = /^(={2,})\s*(.+?)\s*\1/gm;
const sectionMatches = [];
let match;
while ((match = sectionRegex.exec(wikitext)) !== null) {
    sectionMatches.push({ heading: match[2], level: match[1].length, position: match.index });
}

// grab content between Powers/Abilities/Weaknesses headings
function extractSection(name) {
    const start = sectionMatches.find((s) => s.heading === name);
    if (!start) return null;
    const contentStart = start.position + wikitext.slice(start.position).indexOf("\n") + 1;
    const next = sectionMatches.find((s) => s.position > start.position);
    const contentEnd = next ? next.position : wikitext.length;
    return wikitext.slice(contentStart, contentEnd).trim();
}

const result = {
    wikitext_first_15k: wikitext.slice(0, 15000),
    html_section0_first_15k: html.slice(0, 15000),
    powers_from_wikitext: extractSection("Powers"),
    abilities_from_wikitext: extractSection("Abilities"),
    weaknesses_from_wikitext: extractSection("Weaknesses"),
};

const path = `${OUT_DIR}/debug_spiderman_2.json`;
await writeFile(path, JSON.stringify(result, null, 2));
console.log(`Written to ${path}`);
