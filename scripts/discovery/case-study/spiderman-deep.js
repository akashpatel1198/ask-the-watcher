import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

const characters = [
    "Peter Parker (Earth-616)",
    "Ai Apaec (Earth-616)",
    "William Braddock (Earth-833)",
];

for (const page of characters) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(page);
    console.log("=".repeat(60));

    // 1. Intro section (section=0 = everything before first heading)
    const introRes = await axios.get(API_URL, {
        params: {
            action: "parse",
            page,
            prop: "wikitext",
            section: 0,
            format: "json",
        },
    });
    const introText = introRes.data.parse.wikitext["*"];
    // grab text outside the infobox template — everything after the closing }}
    const afterInfobox = introText.split(/\}\}/g).pop().trim();
    console.log("\n--- INTRO ---");
    console.log(afterInfobox.slice(0, 500) || "(no intro text)");

    // 2. Section headings (so we can see what sections exist)
    const sectionsRes = await axios.get(API_URL, {
        params: {
            action: "parse",
            page,
            prop: "sections",
            format: "json",
        },
    });
    const sections = sectionsRes.data.parse.sections;
    console.log("\n--- SECTIONS ---");
    sections.forEach((s) => console.log(`  ${"  ".repeat(s.toclevel - 1)}${s.line}`));

    // 3. Powers section (find the section index, then fetch it)
    const powersSection = sections.find(
        (s) => s.line === "Powers" || s.line === "Powers and Abilities"
    );
    if (powersSection) {
        const powersRes = await axios.get(API_URL, {
            params: {
                action: "parse",
                page,
                prop: "wikitext",
                section: powersSection.index,
                format: "json",
            },
        });
        const powersText = powersRes.data.parse.wikitext["*"];
        console.log("\n--- POWERS ---");
        console.log(powersText.slice(0, 800));
    } else {
        console.log("\n--- POWERS ---");
        console.log("(no Powers section found)");
    }

    // 4. Abilities section
    const abilitiesSection = sections.find((s) => s.line === "Abilities");
    if (abilitiesSection) {
        const abilitiesRes = await axios.get(API_URL, {
            params: {
                action: "parse",
                page,
                prop: "wikitext",
                section: abilitiesSection.index,
                format: "json",
            },
        });
        const abilitiesText = abilitiesRes.data.parse.wikitext["*"];
        console.log("\n--- ABILITIES ---");
        console.log(abilitiesText.slice(0, 800));
    } else {
        console.log("\n--- ABILITIES ---");
        console.log("(no Abilities section found)");
    }
}
