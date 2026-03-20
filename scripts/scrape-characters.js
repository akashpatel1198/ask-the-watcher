// Phase 1 — Character scraper
// Scrapes character data from marvel.fandom.com/wiki/Category:Characters
// Outputs to scripts/data/characters.json

import axios from "axios";
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
