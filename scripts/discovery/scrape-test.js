import axios from "axios";

const API_URL = "https://marvel.fandom.com/api.php";

try {
    const response = await axios.get(API_URL, {
        params: {
            action: "query",
            list: "categorymembers",
            cmtitle: "Category:Characters",
            cmlimit: 50,
            format: "json",
        },
    });
    console.log("status:", response.status);

    const raw = JSON.stringify(response.data, null, 2);
    console.log(raw.slice(0, 3000));
} catch (error) {
    console.log("error:", error.message);
}

console.log("\nscript ended");
