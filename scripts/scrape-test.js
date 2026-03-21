import * as cheerio from "cheerio";
import { writeFile } from "fs/promises";

const BASE_URL = "https://marvel.fandom.com";
const CATEGORY_URL = `${BASE_URL}/wiki/Category:Characters`;
const DELAY_MS = 800;

// TODO: Implement
// 1. Fetch category listing page
// 2. Extract individual character page URLs
// 3. For each character page, extract fields from infobox
// 4. Handle pagination (?from= query param)
// 5. Write results to scripts/data/characters.json
try {
    const response = await fetch(CATEGORY_URL, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
    });
    console.log("status", response.status);
    const html = await response.text();
    console.log("html length", html.length);
} catch (error) {
    console.log("error:", error.message);
}

console.log("script ended");