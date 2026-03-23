import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// The series are subcategories named "Category:X Comic Books"
// but the actual series PAGES are named like "X Vol 1"
// Let's search for some well-known series pages to build our sample list

const searches = [
    "Amazing Spider-Man Vol 1",
    "Uncanny X-Men Vol 1",
    "Avengers Vol 1",
    "Fantastic Four Vol 1",
    "Incredible Hulk Vol 1",
    "Iron Man Vol 1",
    "Thor Vol 1",
    "Captain America Vol 1",
    "X-Men Vol 1",
    "Daredevil Vol 1",
    "New Mutants Vol 1",
    "Secret Wars Vol 1",
];

const found = [];

for (const query of searches) {
    const res = await axios.get(API_URL, {
        params: { action: "opensearch", search: query, limit: 3, format: "json" },
    });
    const titles = res.data[1];
    console.log(`"${query}":`);
    titles.forEach((t) => console.log(`  ${t}`));
    console.log();

    // take the first exact-ish match (the Vol page, not an issue)
    const match = titles.find((t) => t === query || t.match(/^.+ Vol \d+$/));
    if (match) found.push(match);
}

console.log("=== Matched series pages ===\n");
found.forEach((t) => console.log(`  ${t}`));
