import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

// check both Thor and Cap
for (const page of ["Thor Odinson (Earth-616)", "Steven Rogers (Earth-616)"]) {
    console.log(`\n=== ${page} ===\n`);

    const res = await axios.get(API_URL, {
        params: { action: "parse", page, prop: "wikitext", format: "json" },
    });
    const lines = res.data.parse.wikitext["*"].split("\n");

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^\|\s*Powers\s*=/i)) {
            // print 30 lines around the Powers field
            for (let j = i; j < Math.min(lines.length, i + 30); j++) {
                console.log(`${j}: ${lines[j]}`);
            }
            break;
        }
    }
}
