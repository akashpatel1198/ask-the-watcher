// Phase 1 — Teams / Groups scraper
// Scrapes team data from marvel.fandom.com/wiki/Category:Teams
// Outputs to scripts/data/teams.json

import axios from "axios";
import * as cheerio from "cheerio";
import { writeFile } from "fs/promises";

const BASE_URL = "https://marvel.fandom.com";
const CATEGORY_URL = `${BASE_URL}/wiki/Category:Teams`;
const DELAY_MS = 800;

// TODO: Implement
// 1. Fetch category listing page
// 2. Extract individual team page URLs
// 3. For each team page, extract fields from infobox
// 4. Handle pagination (?from= query param)
// 5. Write results to scripts/data/teams.json
