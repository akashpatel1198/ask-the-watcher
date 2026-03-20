// Phase 1 — Story Events scraper
// Scrapes event data from marvel.fandom.com/wiki/Category:Events
// Outputs to scripts/data/events.json

import axios from "axios";
import * as cheerio from "cheerio";
import { writeFile } from "fs/promises";

const BASE_URL = "https://marvel.fandom.com";
const CATEGORY_URL = `${BASE_URL}/wiki/Category:Events`;
const DELAY_MS = 800;

// TODO: Implement
// 1. Fetch category listing page
// 2. Extract individual event page URLs
// 3. For each event page, extract fields from infobox
// 4. Handle pagination (?from= query param)
// 5. Write results to scripts/data/events.json
