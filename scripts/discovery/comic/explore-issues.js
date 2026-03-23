import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// Search for some well-known individual issues
const searches = [
    "Amazing Fantasy Vol 1 15",         // Spider-Man's first appearance
    "Amazing Spider-Man Vol 1 300",     // First Venom
    "Uncanny X-Men Vol 1 137",          // Dark Phoenix Saga
    "Incredible Hulk Vol 1 181",        // First Wolverine
    "Giant-Size X-Men Vol 1 1",         // New X-Men team
    "Avengers Vol 1 1",                 // First Avengers
    "Fantastic Four Vol 1 1",           // First FF
    "Iron Man Vol 1 128",               // Demon in a Bottle
    "X-Men Vol 1 1",                    // First X-Men
    "Secret Wars Vol 1 8",              // Black suit Spider-Man
];

for (const query of searches) {
    const res = await axios.get(API_URL, {
        params: { action: "opensearch", search: query, limit: 3, format: "json" },
    });
    console.log(`"${query}":`);
    res.data[1].forEach((t) => console.log(`  ${t}`));
    console.log();
}
