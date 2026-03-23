import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";
const PAGE = "Peter Parker (Earth-616)";

// 1. Debug sections — log the indices for Powers/Abilities/Weaknesses
console.log("=== SECTION INDICES ===\n");
const sectionsRes = await axios.get(API_URL, {
    params: { action: "parse", page: PAGE, prop: "sections", format: "json" },
});
const sections = sectionsRes.data.parse.sections;
const targets = ["Attributes", "Powers", "Abilities", "Weaknesses"];
for (const s of sections) {
    if (targets.includes(s.line)) {
        console.log(`  "${s.line}" -> index: ${s.index} (type: ${typeof s.index}, level: ${s.toclevel})`);
    }
}

// 2. Debug section fetch — try Powers directly and log raw response
const powersSection = sections.find((s) => s.line === "Powers");
if (powersSection) {
    console.log(`\n=== RAW API RESPONSE for Powers (index ${powersSection.index}) ===\n`);
    const powersRes = await axios.get(API_URL, {
        params: {
            action: "parse",
            page: PAGE,
            prop: "wikitext",
            section: powersSection.index,
            format: "json",
        },
    });
    console.log(JSON.stringify(powersRes.data, null, 2).slice(0, 500));
}

// 3. Debug intro — fetch section 0 as rendered HTML
console.log("\n=== INTRO HTML (section 0, first 1500 chars) ===\n");
const introRes = await axios.get(API_URL, {
    params: {
        action: "parse",
        page: PAGE,
        prop: "text",
        section: 0,
        format: "json",
    },
});
const html = introRes.data.parse.text["*"];
console.log(html.slice(0, 1500));
