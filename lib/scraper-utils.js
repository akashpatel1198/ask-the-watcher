// Shared utilities for scraping scripts

import axios from "axios";

const DEFAULT_DELAY_MS = 800;

/**
 * Delay between requests to be respectful to the wiki
 */
export function delay(ms = DEFAULT_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a page and return the HTML string
 */
export async function fetchPage(url) {
  const { data } = await axios.get(url);
  return data;
}

// TODO: Add more shared helpers as patterns emerge during Phase 1
// - Category page pagination
// - Infobox field extraction
// - Error handling / retry logic
