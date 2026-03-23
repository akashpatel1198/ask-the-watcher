import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

const categories = [
    "Category:Characters",
    "Category:Comics",
    "Category:Events",
    "Category:Teams",
];

for (const category of categories) {
    const response = await axios.get(API_URL, {
        params: {
            action: "query",
            prop: "categoryinfo",
            titles: category,
            format: "json",
        },
    });

    const pages = response.data.query.pages;
    const page = Object.values(pages)[0];
    const count = page.categoryinfo?.pages ?? "unknown";

    console.log(`${category}: ${count} pages`);
}
