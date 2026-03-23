import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

const pages = [
    "Peter Parker (Earth-616)",
    "Thor Odinson (Earth-616)",
    "Steven Rogers (Earth-616)",
    "Anthony Stark (Earth-616)",
    "Reed Richards (Earth-616)",
    "Victor von Doom (Earth-616)",
    "Bruce Banner (Earth-616)",
    "James Howlett (Earth-616)",
    "Scott Summers (Earth-616)",
];

// collect all field names and how often they appear
const fieldCounts = {};

for (const page of pages) {
    const response = await axios.get(API_URL, {
        params: {
            action: "parse",
            page,
            prop: "wikitext",
            format: "json",
        },
    });

    const wikitext = response.data.parse.wikitext["*"];

    // extract field names from the infobox template (lines like "| Field Name = ...")
    const fields = [];
    for (const line of wikitext.split("\n")) {
        const match = line.match(/^\|\s*(.+?)\s*=/);
        if (match) fields.push(match[1]);
    }

    console.log(`\n${page}: ${fields.length} fields`);

    for (const field of fields) {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    }
}

// sort by frequency
const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);

console.log(`\n${"=".repeat(50)}`);
console.log(`FIELD FREQUENCY (across ${pages.length} characters)`);
console.log(`${"=".repeat(50)}`);
for (const [field, count] of sorted) {
    console.log(`  ${count}/${pages.length}  ${field}`);
}
