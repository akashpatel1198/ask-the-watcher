import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";
const PAGE = "Peter Parker (Earth-616)";

const res = await axios.get(API_URL, {
    params: { action: "parse", page: PAGE, prop: "wikitext", format: "json" },
});
const lines = res.data.parse.wikitext["*"].split("\n");

for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\|\s*Powers\s*=/i)) {
        // print 30 lines of context around it
        for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 30); j++) {
            console.log(`${j}: ${lines[j]}`);
        }
        break;
    }
}
