import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

const response = await axios.get(API_URL, {
    params: {
        action: "parse",
        page: "Peter Parker (Earth-616)",
        prop: "wikitext",
        format: "json",
    },
});

const wikitext = response.data.parse.wikitext["*"];

// skip wiki meta/presentation fields
const skip = new Set([
    "body", "title", "header", "Overview", "Quotation", "Speaker",
    "QuoteSource", "History", "Personality", "Notes", "Trivia",
    "Marvel", "Wikipedia", "Links", "Message",
]);

for (const line of wikitext.split("\n")) {
    const match = line.match(/^\|\s*(.+?)\s*=\s*(.*)/);
    if (!match) continue;

    const [, field, value] = match;
    if (skip.has(field)) continue;

    const trimmed = value.trim();
    if (!trimmed) continue;

    console.log(`\n--- ${field} ---`);
    if (field == "Abilities") {
        console.log(trimmed)
    } else {
        console.log(trimmed.slice(0, 300));
    }
    
}
