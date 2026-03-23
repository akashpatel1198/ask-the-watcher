import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// 1. Grab first 30 pages from the Comics category to see naming patterns
console.log("=== First 30 pages in Category:Comics ===\n");
const listRes = await axios.get(API_URL, {
    params: {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:Comics",
        cmlimit: 30,
        format: "json",
    },
});
listRes.data.query.categorymembers.forEach((p) => console.log(`  ${p.title}`));

// 2. Check if there are subcategories (series vs issues?)
console.log("\n=== Subcategories of Category:Comics ===\n");
const subRes = await axios.get(API_URL, {
    params: {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:Comics",
        cmtype: "subcat",
        cmlimit: 30,
        format: "json",
    },
});
subRes.data.query.categorymembers.forEach((p) => console.log(`  ${p.title}`));

// 3. Search for a few well-known series to see how they're titled
console.log("\n=== Searching for well-known comics ===\n");
const searches = [
    "Amazing Spider-Man",
    "Uncanny X-Men",
    "Avengers Vol 1",
    "Secret Wars",
];
for (const query of searches) {
    const res = await axios.get(API_URL, {
        params: { action: "opensearch", search: query, limit: 5, format: "json" },
    });
    console.log(`"${query}":`);
    res.data[1].forEach((t) => console.log(`  ${t}`));
    console.log();
}
