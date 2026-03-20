// Phase 1 — Comics / Issues scraper
// Scrapes comic data from marvel.fandom.com/wiki/Category:Comics
// Outputs to scripts/data/comics.json

import axios from "axios";
import * as cheerio from "cheerio";
import { writeFile } from "fs/promises";

const BASE_URL = "https://marvel.fandom.com";
const CATEGORY_URL = `${BASE_URL}/wiki/Category:Comics`;
const DELAY_MS = 800;

// TODO: Implement
// 1. Fetch category listing page
// 2. Extract individual comic page URLs
// 3. For each comic page, extract fields from infobox
// 4. Handle pagination (?from= query param)
// 5. Write results to scripts/data/comics.json
