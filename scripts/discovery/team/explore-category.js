import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// 1. Category count for Teams
console.log("=== Category:Teams — page count ===\n");
const countRes = await axios.get(API_URL, {
    params: {
        action: "query",
        prop: "categoryinfo",
        titles: "Category:Teams",
        format: "json",
    },
});
const countPage = Object.values(countRes.data.query.pages)[0];
console.log(`  ${countPage.categoryinfo?.pages ?? "unknown"} pages`);
console.log(`  ${countPage.categoryinfo?.subcats ?? "unknown"} subcategories`);

// 2. First 30 pages in Category:Teams to see naming patterns
console.log("\n=== First 30 pages in Category:Teams ===\n");
const listRes = await axios.get(API_URL, {
    params: {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:Teams",
        cmlimit: 30,
        format: "json",
    },
});
listRes.data.query.categorymembers.forEach((p) =>
    console.log(`  [${p.ns === 14 ? "subcat" : "page"}] ${p.title}`)
);

// 3. Subcategories of Category:Teams
console.log("\n=== Subcategories of Category:Teams ===\n");
const subRes = await axios.get(API_URL, {
    params: {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:Teams",
        cmtype: "subcat",
        cmlimit: 30,
        format: "json",
    },
});
subRes.data.query.categorymembers.forEach((p) => console.log(`  ${p.title}`));

// 4. Search for well-known teams to see how they're titled on the wiki
console.log("\n=== Searching for well-known teams ===\n");
const searches = [
    "Avengers",
    "X-Men",
    "Fantastic Four",
    "Guardians of the Galaxy",
    "S.H.I.E.L.D.",
    "Hydra",
    "Brotherhood of Mutants",
    "Sinister Six",
];
for (const query of searches) {
    const res = await axios.get(API_URL, {
        params: { action: "opensearch", search: query, limit: 5, format: "json" },
    });
    console.log(`"${query}":`);
    res.data[1].forEach((t) => console.log(`  ${t}`));
    console.log();
}

// 5. Peek at one team page infobox to see field structure
console.log("=== Infobox: Avengers (Earth-616) ===\n");
const wikiRes = await axios.get(API_URL, {
    params: {
        action: "parse",
        page: "Avengers (Earth-616)",
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
