import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// 1. Category count for Events
console.log("=== Category:Events — page count ===\n");
const countRes = await axios.get(API_URL, {
    params: {
        action: "query",
        prop: "categoryinfo",
        titles: "Category:Events",
        format: "json",
    },
});
const countPage = Object.values(countRes.data.query.pages)[0];
console.log(`  ${countPage.categoryinfo?.pages ?? "unknown"} pages`);
console.log(`  ${countPage.categoryinfo?.subcats ?? "unknown"} subcategories`);

// 2. Subcategories of Category:Events
console.log("\n=== Subcategories of Category:Events ===\n");
const subRes = await axios.get(API_URL, {
    params: {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:Events",
        cmtype: "subcat",
        cmlimit: 30,
        format: "json",
    },
});
subRes.data.query.categorymembers.forEach((p) => console.log(`  ${p.title}`));

// 3. First 50 pages in Category:Events to see naming patterns
//    (only ~384 total so 50 gives a good sample of naming conventions)
console.log("\n=== First 50 pages in Category:Events ===\n");
const listRes = await axios.get(API_URL, {
    params: {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:Events",
        cmtype: "page",
        cmlimit: 50,
        format: "json",
    },
});
listRes.data.query.categorymembers.forEach((p) => console.log(`  ${p.title}`));

// 4. Search for well-known events to see how they're titled
console.log("\n=== Searching for well-known events ===\n");
const searches = [
    "Secret Wars",
    "Civil War",
    "Infinity Gauntlet",
    "House of M",
    "Age of Apocalypse",
    "Secret Invasion",
    "Dark Reign",
    "Annihilation",
];
for (const query of searches) {
    const res = await axios.get(API_URL, {
        params: { action: "opensearch", search: query, limit: 5, format: "json" },
    });
    console.log(`"${query}":`);
    res.data[1].forEach((t) => console.log(`  ${t}`));
    console.log();
}

// 5. Peek at one event page infobox to see field structure
console.log("=== Infobox: Civil War (Event) ===\n");
const wikiRes = await axios.get(API_URL, {
    params: {
        action: "parse",
        page: "Civil War (Event)",
        prop: "wikitext",
        format: "json",
    },
});
const wikitext = wikiRes.data.parse.wikitext["*"];
for (const line of wikitext.split("\n")) {
    const match = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
    if (match && match[2].trim()) {
        console.log(`  ${match[1]} = ${match[2].trim().slice(0, 150)}`);
    }
}
