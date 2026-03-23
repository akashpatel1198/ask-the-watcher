import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// 1. How many pages in Series Categories?
console.log("=== Series Categories count ===\n");
const countRes = await axios.get(API_URL, {
    params: {
        action: "query",
        prop: "categoryinfo",
        titles: "Category:Series Categories",
        format: "json",
    },
});
const countPage = Object.values(countRes.data.query.pages)[0];
console.log(`  ${countPage.categoryinfo?.pages ?? "unknown"} pages`);
console.log(`  ${countPage.categoryinfo?.subcats ?? "unknown"} subcategories`);

// 2. First 30 from Series Categories to see what's in there
console.log("\n=== First 30 in Category:Series Categories ===\n");
const seriesRes = await axios.get(API_URL, {
    params: {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:Series Categories",
        cmlimit: 30,
        format: "json",
    },
});
seriesRes.data.query.categorymembers.forEach((p) => console.log(`  [${p.ns === 14 ? "subcat" : "page"}] ${p.title}`));

// 3. Compare infobox: a series page vs an issue page
console.log("\n=== Infobox: Amazing Spider-Man Vol 1 (SERIES) ===\n");
const seriesWiki = await axios.get(API_URL, {
    params: { action: "parse", page: "Amazing Spider-Man Vol 1", prop: "wikitext", format: "json" },
});
const seriesLines = seriesWiki.data.parse.wikitext["*"].split("\n");
for (const line of seriesLines) {
    const match = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
    if (match && match[2].trim()) {
        console.log(`  ${match[1]} = ${match[2].trim().slice(0, 120)}`);
    }
}

console.log("\n=== Infobox: Amazing Spider-Man Vol 1 1 (ISSUE) ===\n");
const issueWiki = await axios.get(API_URL, {
    params: { action: "parse", page: "Amazing Spider-Man Vol 1 1", prop: "wikitext", format: "json" },
});
const issueLines = issueWiki.data.parse.wikitext["*"].split("\n");
for (const line of issueLines) {
    const match = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
    if (match && match[2].trim()) {
        console.log(`  ${match[1]} = ${match[2].trim().slice(0, 120)}`);
    }
}
