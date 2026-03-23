import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

const searches = [
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

for (const query of searches) {
    const response = await axios.get(API_URL, {
        params: {
            action: "opensearch",
            search: query,
            limit: 3,
            format: "json",
        },
    });

    const titles = response.data[1];
    console.log(`\n"${query}":`);
    titles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
}
