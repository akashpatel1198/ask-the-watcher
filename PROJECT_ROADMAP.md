# Marvel Wiki API — Project Roadmap

## Tech Stack

| Layer | Tool |
|---|---|
| Language | Node.js (ESM) |
| Data Source | MediaWiki API (`marvel.fandom.com/api.php`) |
| HTTP Client | `axios` |
| Database | SQLite via `better-sqlite3` (local `.db` file) |
| API Framework | NestJS |
| API Docs | `@nestjs/swagger` (Swagger UI) |
| Auth | API Key (via NestJS Guard) |
| Rate Limiting | `@nestjs/throttler` |

---

## Data Entities

The following entities will be scraped, stored, and exposed via the API:

- **Characters**
- **Comic Issues**
- **Comic Series**
- **Teams / Groups**
- **Story Events**

> Schema and field selection will be driven by the Discovery phase findings.

### Category Scale (as of discovery)

| Category | Page Count |
|---|---|
| Characters | ~98,500 |
| Comic Issues | ~70,400 |
| Comic Series | ~569 |
| Events | ~384 |
| Teams | ~6,700 |

> **Target: "Ambitious" tier** — ~10,000 characters + ~20,000 comic issues + all teams/series/events. Estimated DB file size: **~1 GB** on disk (including indexes). Characters and Comic Issues need filtering; the rest are kept in full.

---

## Project Structure

```
/
├── scripts/
│   ├── discovery/                # Phase 1 — explore wiki data before building
│   │   ├── pre-testing/          # Early exploration scripts (category counts, search, field frequency)
│   │   ├── case-study/           # Deep dives on specific pages (Spider-Man variants)
│   │   │   └── output/           # (gitignored) JSON dumps from case study scripts
│   │   ├── character/            # Character entity discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled characters
│   │   ├── comic/                # Comic issue discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled issues
│   │   ├── series/               # Comic series discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled series
│   │   ├── team/                 # Team entity discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled teams
│   │   └── event/                # Event entity discovery
│   │       └── output/           # (gitignored) JSON dumps for sampled events
│   ├── scrape-characters.js      # Full scrape scripts (Phase 3)
│   ├── scrape-comics.js
│   ├── scrape-teams.js
│   ├── scrape-events.js
│   ├── seed-db.js
│   └── data/                     # (gitignored) JSON output from scrape scripts
├── lib/
│   ├── scraper-utils.js
│   └── db.js                     # Shared SQLite client (better-sqlite3)
├── data/
│   └── marvel.db                 # (gitignored) SQLite database file
├── src/                          # NestJS API (Phase 4)
│   ├── characters/
│   ├── comics/
│   ├── teams/
│   ├── events/
│   └── main.js
├── .env
└── PROJECT_ROADMAP.md
```

---

## Phase 1 — Discovery

> Goal: Use the MediaWiki API to understand what data is available for each entity type, how it's structured, and what's worth keeping. Output sample data to local JSON files. These findings will drive the database schema in Phase 2.

### Approach

We use `marvel.fandom.com/api.php` instead of HTML scraping. The wiki's MediaWiki API returns structured data (JSON) and doesn't block automated requests. Key endpoints:

- `action=query&list=categorymembers` — list pages in a category
- `action=parse&prop=wikitext` — get raw wikitext (contains infobox fields)
- `action=opensearch` — search for pages by title
- `action=query&prop=categoryinfo` — get category metadata (page counts)

### Key Findings So Far

**Infobox is the primary data source.** Each character/entity page has a wikitext infobox template with structured `| FieldName = Value` pairs. A custom parser extracts these, including multi-line fields (e.g., Powers spanning dozens of lines with sub-entries).

**Fields reliably available for Characters (9/9 sampled):**
Name, CurrentAlias, Aliases, Affiliation, Gender, Height, Weight, Eyes, Hair, Origin, Reality, PlaceOfBirth, Identity, Citizenship, Occupation, Education, Creators, First (first appearance), Powers, Abilities, Weaknesses, Equipment, Transportation, Weapons

**Fields sometimes available (varies by character):**
Overview (intro blurb), Codenames, Nicknames, Ancestors, Siblings, Spouses, Children, Relatives, Skin, Eyeballs

**Raw wikitext needs cleaning** — values contain wiki markup: `{{r|...}}` references, `{{Power|...}}` templates, `[[Link|Display Text]]` wiki links. A wikitext-to-clean-text parser will be needed before storing data.

**Comic Issues and Series are separate entities.** The wiki has both series pages (~569) and individual issue pages (~70k). Issues are the richer data source; series pages provide metadata about the run as a whole. Both are worth keeping as separate entities with a series→issues relationship.

**Fields reliably available for Comic Issues (10 sampled):**
ReleaseDate, Month, Year, Editor-in-Chief, Image1, StoryTitle1, Writer/Penciler/Inker/Colorist/Letterer (per story), Appearing (character list with appearance tags), Synopsis, Quotation/Speaker, Notes, Trivia

**The `Appearing` field is a relationship goldmine.** It categorizes characters as Featured/Supporting/Antagonist, tags first appearances and deaths, and uses wiki links that map directly to character page titles (natural foreign keys).

**Comic Series are a lightweight grouping entity.** Series pages (~569) use a different infobox template from issues. The bulk of their fields are numbered creator lists (`writer1`/`writer1_issues`, `penciler1`/`penciler1_issues`, etc.) — long-running series can have 100+ fields just from creator rosters. The core metadata is slim but useful.

**Fields reliably available for Comic Series (16 sampled — mix of major + mid-tier + obscure):**
volume_logo, format (ongoing/limited/one-shot/etc.), type, status (finished/active), genres, featured (main character — wiki link)

**Fields commonly available:**
writerN/writerN_issues, pencilerN/pencilerN_issues (numbered creator rosters with issue ranges), partN/partN_above (era/run divisions)

**Fields sometimes available:**
Notes, Accolades, year, SeeAlso, PreviousVol

**Key relationship fields for Comic Series:**
- `featured` → character wiki link — series↔character relationship (which character headlines the series).
- Series→issue relationship is derived from naming convention: issue page titles embed the series name (e.g., `Amazing Spider-Man Vol 1 300` belongs to `Amazing Spider-Man Vol 1`).
- Per-issue creator credits are richer on issue pages than the series-level creator roster — issue pages should be the primary source for credits.

**Teams: flat category, rich infobox, inline member lists.** All ~6,692 team pages live flat under `Category:Teams` (6 subcategories: by Status, Type, Identity, Reality, Unseen, Year of Debut). Pages follow the `Name (Earth-616)` convention. Infobox fields are consistent across popular and obscure teams.

**Fields reliably available for Teams (13 sampled — mix of popular + obscure):**
Name, Image, Status, Identity, Reality, BaseOfOperations, Creators, First (first appearance), History

**Fields commonly available (8+ of 13):**
FormerMembers, Leaders, Enemies, Origin, PlaceOfFormation, CurrentMembers, Allies, Weapons/Equipment/Transportation

**Fields sometimes available:**
Last (only on defunct teams — 5/13), Aliases, EditorialNames, Overview, Quotation/Speaker, Notes, Trivia

**Key relationship fields for Teams:**
- `CurrentMembers` / `FormerMembers` → character wiki links (`[[Peter Parker (Earth-616)|Spider-Man]]`) — natural foreign keys to character pages. Most teams have inline member lists; very large teams (e.g., Avengers) redirect to a separate "List of X members" page.
- `First` / `Last` → issue page titles (`Sleepwalker Vol 1 2`) — direct links to comic issue pages.
- `Allies` / `Enemies` → mix of team and character wiki links — potential team↔team or team↔character relations.
- `Leaders` → character wiki links, usually 1–2 people — could be a tagged role on a team↔character join table.

**Redirect edge case:** Some teams use redirect page titles (e.g., `S.H.I.E.L.D. (Earth-616)` redirects to `Strategic Homeland Intervention, Enforcement and Logistics Division (Earth-616)`). The full scraper will need to follow redirects to get the actual infobox data.

**Events: different infobox structure, rich synopses, ordered reading lists.** Only ~384 pages. Events don't use `(Earth-616)` suffixes — they use `(Event)` suffix or plain titles. Each event gets its own subcategory (425 subcategories total) for related comics. The infobox is structured as a "story card" rather than an entity card.

**Fields reliably available for Events (14 sampled — mix of major crossovers + obscure):**
Name, Image, First, Synopsis (100%), Reality (93%)

**Fields commonly available (8+ of 14):**
Part1–PartN (ordered reading list, 86%), Protagonists (79%), Trivia (79%), Aliases (71%), Antagonists (71%), Last (71%)

**Fields sometimes available:**
Locations (57%), TieIns (57%), Creators (50% — many events span multiple creative teams), Others (36%), Quotation/Speaker, Notes, Prelude

**The `Synopsis` field is exceptionally rich.** Every sampled event has a full plot summary — not just a blurb but a detailed narrative covering the entire event. This is significantly more substantial than team/character Overview fields and is ideal for API consumers.

**The `Part1`–`PartN` fields provide structured reading order.** Each part maps to an issue page title, giving an ordered event→comic relationship. Events range from 6 parts (Infinity Gauntlet) to 24+ parts (larger crossovers).

**Key relationship fields for Events:**
- `Protagonists` / `Antagonists` / `Others` → character AND team wiki links mixed together — can be parsed into event↔character and event↔team joins, tagged by role (protagonist/antagonist/other).
- `Part1`–`PartN` → ordered issue page titles — event↔comic join with explicit reading order.
- `First` / `Last` → issue page titles — bookend references.
- `TieIns` / `Prelude` → additional issue references via `{{cl|...}}` templates — supplementary event↔comic relations.

**Events are small enough (~384) to keep all without filtering.**

### Progress

- [x] Category counts for all 4 entity types
- [x] Character field frequency analysis (9 well-known characters)
- [x] Case study: Spider-Man variants (Peter Parker, Ai Apaec, William Braddock) — compared field coverage across popular vs. obscure pages
- [x] Working multi-line infobox parser (handles `{{Clear}}`, continuation lines, nested bullet points)
- [x] Sample JSON output for 9 characters
- [x] Comic discovery: explored category structure, separated issues and series as distinct entities
- [x] Comic issue discovery: sampled 10 iconic issues
- [x] Comic series discovery: sampled 12 series pages
- [x] Team discovery: explored category structure (flat, 6 subcategories)
- [x] Team discovery: sampled 14 teams (6 popular, 4 mid-tier, 4 obscure), field frequency analysis
- [x] Team discovery: identified relationship fields (members→characters, first/last→issues, allies/enemies)
- [x] Team discovery: debugged S.H.I.E.L.D. redirect edge case
- [x] Event discovery: explored category structure (~384 pages, 425 subcategories, no Earth-616 suffix)
- [x] Event discovery: sampled 14 events (6 major crossovers, 4 mid-tier, 4 obscure), field frequency analysis
- [x] Event discovery: identified relationship fields (protagonists/antagonists→characters+teams, PartN→ordered reading list, tie-ins)
- [x] Comic issue fetch-sample: added mid-tier/obscure issues (16 total), field frequency analysis — core fields hold at 100% across popular and obscure
- [x] Comic series fetch-sample: sampled 16 series (12 major + 4 mid-tier/obscure), field frequency analysis — 6 core metadata fields, rest is creator rosters
- [x] Wikitext-to-clean-text parser (`lib/scraper-utils.js` → `cleanWikitext()`)
- [x] Per-entity cleaner testing — all 5 entities pass with 0 flagged (character, comic, event, series, team)

### Wikitext Cleaner — Findings from Character Testing

**Empty-string fields after cleaning are expected and harmless.** Two categories:

1. **`*Ref` fields (`NameRef`, `CurrentAliasRef`, `CharRef`)** — These are wiki-internal citation fields. Their entire content is `<ref>` tags and `{{r|...}}` templates pointing to which comic first used a name. The actual names live in `Name`, `CurrentAlias`, etc. These `*Ref` fields carry no display content and won't map to any API field — they can be dropped during schema design in Phase 2.

2. **`{{Navigation` / `{{MessageBox`-only fields** — Some fields (Powers, Weaknesses, Equipment, etc.) contain only a leaked wiki page-layout template. These are navigation chrome or editor notices on the wiki page, not entity data. The real content for these fields lives in other characters' pages; these specific characters just don't have data for that field beyond the layout block. Safe to drop.

~~**Known upstream issue: `{{MessageBox}}` splitting across fields.** The infobox parser captures `{{MessageBox` as a field value (e.g., `History`) and its closing `}}` bleeds into the next field (`Message`), leaving a stray `}}` artifact. This is a `parseInfobox` issue to fix when the parser is refactored into a shared utility in Phase 3 — not a cleaner issue.~~

**RESOLVED:** `parseInfobox` refactored into `lib/scraper-utils.js` as a shared function. Now strips `{{Navigation`/`{{MessageBox` fragments and stray `}}` during parsing. All 6 discovery scripts updated to import from shared util instead of defining inline copies.

---

## Phase 2 — Schema Design + SQLite Setup

> Goal: Design a relational DB schema informed by Phase 1 findings, set up SQLite, and validate the schema.

### Database Choice: SQLite

**Why SQLite over Supabase/Postgres:**
- The API is read-heavy (scrape once, serve forever) — SQLite's ideal use case
- No storage limits — local file on disk, no free-tier constraints
- No network latency for queries — direct file reads
- Zero cost, zero external dependencies
- Estimated DB size: ~1 GB for the "Ambitious" target (10k characters, 20k comics, all others)

**Hosting:** Deploy the NestJS API + `.db` file together on a host with persistent disk (Fly.io, Railway, or a $4/mo VPS).

### Steps

1. **Add image URL support**
   - New `resolveImageUrl()` function in `lib/scraper-utils.js` — resolves wiki image filenames to full CDN URLs via MediaWiki `action=query&prop=imageinfo` API
   - Update `fetch-sample.js` scripts per entity to pull infobox images (`Image` or `Image1` field depending on entity)
   - Each entity schema will include an `image_url` column

2. **Design schema per entity** (one at a time)
   - Go through each entity's discovery data, pick fields to keep vs. drop
   - Output `schema/{entity}.json` files with column definitions, types, and notes on dropped fields
   - Entity order: characters → comics → series → teams → events
   - Each schema includes `image_url` from step 1

3. **Beta scripts per entity** — validate schema shape before building real scraper
   - Each entity gets a `beta-script.js` in its discovery directory
   - Full pipeline in one script: fetch from wiki → parse infobox → resolve image → clean via `cleanWikitext()` → map to schema columns → output `beta_*.json` files
   - Uses the same hardcoded sample pages from discovery (not full category scrape)
   - Output files are DB-ready rows — validates the schema works end-to-end
   - Cleaner issues found during beta testing are fixed in `cleanWikitext()` (e.g., wiki section headers `===`, `thumb|` image tags, `[[Category:]]` tags, orphaned `]]` brackets were all caught and fixed this way)

4. **Design join tables**
   - After all 5 entity schemas are finalized, define the relationship/join tables
   - New `extractWikiLinks()` function in `lib/scraper-utils.js` — extracts raw wiki page titles (e.g., `Peter_Parker_(Earth-616)`) from wikitext before cleaning. These page titles are the `wiki_page_title` unique key in every entity table, so they serve directly as foreign keys in join tables.
   - **4 join tables:**

     | Join Table | Entity A | Entity B | Extra Columns |
     |---|---|---|---|
     | `character_teams` | characters | teams | role (leader/member/former) |
     | `character_events` | characters | events | role (protagonist/antagonist/other) |
     | `comic_characters` | comics | characters | appearance_type (featured/supporting/antagonist) |
     | `event_comics` | events | comics | reading_order, type (main/tie-in) |

   - **1 FK column (not a join table):** `comics.series_wiki_page_title` → points to the series this issue belongs to (many-to-one: many comics belong to one series). Derived entirely from the comic's own page title — strip the trailing issue number (`Amazing_Spider-Man_Vol_1_300` → `Amazing_Spider-Man_Vol_1`). No cross-script dependency: the comic beta script sets this field independently. At seed time, if the derived value matches a row in the series table the FK is valid; if not (series not scraped or name mismatch), it is stored as `null`.
   - **Dropped relationships:**
     - `team_allies` (team↔team via Allies/Enemies) — low priority for API consumers
     - `series_characters` — the series→comic→character path via existing joins covers this; the `featured` text column on series is sufficient for "who headlines this series"
   - **Beta validation flow:**
     1. Comic beta script runs → derives `series_wiki_page_title` from page title, writes into each comic row JSON
     2. Series beta script runs independently (any order) → writes series row JSONs with their `wiki_page_title`
     3. Team, event, and comic beta scripts also append rows to `scripts/discovery/joins/output/beta_joins_*.json` (one file per join table, scaffolded as empty arrays)
     4. Validation script runs after all beta scripts → reads all entity JSONs and join JSONs, checks that FKs resolve to real `wiki_page_title` values, logs matches and mismatches

5. **Install `better-sqlite3`**
   - `npm install better-sqlite3`
   - Shared `lib/db.js` client

6. **Write schema migration script**
   - `scripts/setup-db.js` — creates tables, indexes, and join tables
   - Outputs to `data/marvel.db` (gitignored)

7. **Write connection test script**
   - `scripts/test-connection.js`
   - Confirms schema is created and queryable

### Progress

- [x] Image URL support added to `lib/scraper-utils.js` and character `fetch-sample.js`
- [x] Character schema designed (`schema/characters.json` — 36 columns, Option C)
- [x] Character beta script (`scripts/discovery/character/beta-script.js`) — 9 samples validated, all clean
- [x] Cleaner fixes: wiki section headers, `thumb|` tags, `[[Category:]]` tags, orphaned `]]`, trailing commas
- [x] Comic schema (`schema/comics.json` — 27 columns, Option C)
- [x] Comic beta script (`scripts/discovery/comic/beta-script.js`) — 16 samples validated, all clean
- [x] Series schema (`schema/series.json` — 14 columns, Option B+)
- [x] Series beta script (`scripts/discovery/series/beta-script.js`) — 16 samples validated, all clean
- [x] Event schema (`schema/events.json` — 22 columns, Option C)
- [x] Event beta script (`scripts/discovery/event/beta-script.js`) — 14 samples validated, all clean
- [x] Team schema (`schema/teams.json` — 21 columns, Option B)
- [x] Team beta script (`scripts/discovery/team/beta-script.js`) — 15 samples validated; Navigation template extraction for leaders, "See also" member redirect following
- [x] Join table design (`schema/joins.json` — 4 join tables + 1 FK column)
- [x] `extractWikiLinks()` added to `lib/scraper-utils.js` — extracts raw wiki page titles for FK resolution
- [x] Beta scripts updated (team, event, comic) → write join rows to `scripts/discovery/joins/output/`
- [x] Bug fix: comic `parseAppearingForJoins` wasn't stripping `'''` bold markup from section headers → 0 join rows; fixed
- [x] Beta join outputs validated — character_teams (1,186), character_events (155), event_comics (363), comic_characters (723), series FK (16/16)
- [x] Join table size estimated: ~30–40 MB total at full scale (trivial vs ~1 GB entity tables)
- [x] Install `better-sqlite3` + `lib/db.js` (shared client with WAL mode + foreign keys)
- [x] Removed `lib/supabase.js` — no longer needed after SQLite switch
- [x] Schema migration script (`scripts/setup-db.js`) — creates 5 entity tables + 4 join tables + 9 indexes from schema JSONs
- [x] Connection test script (`scripts/test-connection.js`) — verifies tables, column counts, insert+query round-trip, WAL mode, foreign keys
- [x] Added `data/*.db` to `.gitignore`

---

## Phase 3 — Full Scrape + DB Seed

> Goal: Run production scrapes across all entity categories and load clean data into SQLite.

### Two-Step Architecture

Phase 3 is split into **analyze** (fetch byte sizes + histogram), **enumerate** (filter and build page lists), and **scrape** (process pages from those lists). This decouples pagination/filtering from scraping, and separates the slow API work (analyze) from the instant threshold decision (enumerate).

**Analyze scripts** paginate a wiki category, batch-fetch byte sizes, save raw `[title, bytes]` pairs to `enumerate/output/`, and print a histogram. Run once per entity — no need to re-run unless the wiki changes.

**Enumerate scripts** read cached size data, filter at a user-provided byte threshold, and write page lists to `scripts/data/pages_*.json`. Instant, no API calls — try different thresholds freely.

**Page lists** are JSON arrays (one title per line for readability), gitignored. Delete after seeding.

```
scripts/
  enumerate/
    analyze-series.js        → enumerate/output/sizes_series.json
    analyze-teams.js         → enumerate/output/sizes_teams.json
    analyze-comics.js        → enumerate/output/sizes_comics.json
    analyze-characters.js    → enumerate/output/sizes_characters.json
    enumerate-series.js      → scripts/data/pages_series.json
    enumerate-events.js      → scripts/data/pages_events.json       (no analyze — all ~384 kept)
    enumerate-teams.js       → scripts/data/pages_teams.json
    enumerate-comics.js      → scripts/data/pages_comics.json
    enumerate-characters.js  → scripts/data/pages_characters.json
    output/                  (sizes caches, gitignored)
  scrape-series.js           ← reads pages_series.json
  scrape-events.js           ← reads pages_events.json
  scrape-teams.js            ← reads pages_teams.json
  scrape-comics.js           ← reads pages_comics.json
  scrape-characters.js       ← reads pages_characters.json
  seed-db.js
```

### Target Counts ("Ambitious" Tier)

| Entity | Wiki Total | Filtered | Threshold | Strategy |
|---|---|---|---|---|
| Comic Series | 12,201 | **2,530** | ≥ 500 bytes | Byte size filter (drop stubs/TPBs) |
| Events | 384 | **384** | — | No filtering needed |
| Teams | 6,694 | **2,412** | ≥ 2,000 bytes | Byte size filter (drop stubs) |
| Comic Issues | 70,364 | **22,190** | ≥ 4,500 bytes | Byte size filter + FK backfill |
| Characters | 98,594 | **10,717** | ≥ 4,000 bytes | Byte size filter + FK backfill |

> **No universe filtering.** Characters are not limited to Earth-616; the 10k cap + relationship-based filtering handles scope naturally.

### Category Discovery Notes

- **Series** use `Category:Volumes` (not `Category:Comic_Series`). Contains 12,207 pages + 12,326 subcategories. Includes TPBs, omnibuses, and one-shots alongside regular series — filtering needed.
- **Events** use `Category:Events` with `cmtype=page` to exclude the ~425 subcategories.
- **Teams** use `Category:Teams` — flat structure, pages mixed with subcategories. Use `cmtype=page` or filter by `ns=0`.
- **Comics** use `Category:Comics`.
- **Characters** use `Category:Characters`.

### Byte Size Filtering

The MediaWiki API supports `prop=revisions&rvprop=size` to get page byte size without fetching full wikitext. Requests can batch up to 50 titles per call. Pages with very small byte size are stubs with little useful data — filtering by a minimum byte size threshold drops these cheaply during enumeration without reading any page content.

Applied to: series, teams, comics (as quality-based cap), characters (as quality-based cap).

### Enumeration Order & Filtering Strategy

All entities use the same **analyze → enumerate** pattern with byte size filtering. No dependency chain between entities — all analyze scripts can run independently.

**Analyze + enumerate (all entities independent):**

1. **Series** — `analyze-series.js` → histogram → `enumerate-series.js 500` → 2,530 pages ✅
2. **Events** — `enumerate-events.js` (no analyze needed, keep all 384) ✅
3. **Teams** — `analyze-teams.js` → histogram → `enumerate-teams.js 2000` → 2,412 pages ✅
4. **Comics** — `analyze-comics.js` → histogram → `enumerate-comics.js 4500` → 22,190 pages ✅
5. **Characters** — `analyze-characters.js` → histogram → `enumerate-characters.js 4000` → 10,717 pages ✅

**FK backfill after seeding:**

After all entities are scraped and seeded, check join table resolution rates. Any unresolved FKs (e.g., an event references a comic not in our 20k, or a team member isn't in our 10k characters) are collected into a targeted backfill list. Run a focused scrape for just those missing pages — likely a small set since high-byte-size pages are naturally the most-referenced ones.

### Scrape Scripts

Each scrape script reads its `pages_*.json` and runs the same pipeline proven in the beta scripts:

1. Fetch wikitext via `action=parse&page={title}&prop=wikitext`
2. `parseInfobox()` → extract fields
3. Guard against empty infobox (redirects) → skip + log
4. Map fields to schema columns (entity-specific `FIELD_MAP` + special handlers)
5. `cleanWikitext()` on each field value
6. `resolveImageUrl()` for image field (separate API call per page)
7. `extractWikiLinks()` on relationship fields → write join rows
8. Append entity row to output JSON
9. 800ms delay between requests

**Entity-specific special handling** (carried forward from beta scripts):
- **Comics:** Merge numbered creator fields, build variant covers, derive `series_wiki_page_title` FK from page title, section-aware `Appearing` parsing for joins
- **Series:** Merge creators with issue counts, collapse `SeeAlso` + annuals/specials
- **Teams:** `extractFieldWithNavigation()` for Leaders/FormerMembers, `followMemberRedirect()` for "See also" member pages, `getRawField()` for join extraction
- **Events:** Collapse `Part1`–`PartN` reading order, `cleanGallery()` for tie-ins/prelude, dual join extraction (character_events + event_comics)

### Resumability & Failure Tracking

- **Progress file** (`scripts/data/.progress_{entity}.json`) — Set of already-scraped `wiki_page_title`s. On restart, skip pages already in the set.
- **Incremental saves** — Flush entity JSON + progress file every 50 pages.
- **Failure log** (`scripts/data/.failures_{entity}.json`) — Array of `{ page_title, error, timestamp }`. Failed pages are skipped and logged. Re-run with `--retry-failures` flag to retry only failed pages.
- **Rate limiting** — 800ms delay between requests (via `delay()` in `scraper-utils.js`). Exponential backoff on 429/5xx errors.
- **Idempotent seeding** — `seed-db.js` uses INSERT OR REPLACE (upsert) keyed on `wiki_page_title`. Safe to re-run.

### Seeding Strategy

**Scrape everything first, seed joins last.**

1. Insert all entity rows into core tables (series, events, teams, comics, characters) — order doesn't matter since no FK constraints enforced yet
2. Set `comics.series_wiki_page_title` FK during comic insertion (derived from page title naming convention)
3. Populate all 4 join tables last — both sides of every join exist at this point, so unresolved `wiki_page_title` references (entities filtered out by caps) are simply skipped
4. Reads from JSON output in `scripts/data/`
5. Inserts into SQLite using `wiki_page_title` as unique key

### Known Edge Cases

- **Redirects:** Some wiki pages (e.g., `S.H.I.E.L.D. (Earth-616)`) redirect to a different title. `parseInfobox()` returns empty object. All scrape scripts guard against this — skip + log.
- **Series FK derivation:** `page.replace(/\s+\d+$/, "")` strips trailing issue number. May break for titles ending in numbers that aren't issue numbers. Log mismatches during seeding.
- **Event→comic join FKs:** Event `Part` fields use `{{cl|Title}}` templates, not wiki links. `extractWikiLinks()` is tried first; fallback to `cleanWikitext(raw).replace(/ /g, "_")`. Slight mismatch risk with comic `wiki_page_title` values.

### Validation

- Spot check entities and relationships via SQLite queries after seeding
- Compare row counts against expected targets
- Check join table resolution rates (how many FKs resolve vs. skip)

---

## Phase 4 — NestJS API

> Goal: Expose the SQLite data via a clean RESTful API with Swagger docs, API key auth, and rate limiting.

### Steps

1. **Scaffold NestJS project**

2. **SQLite service**
   - Shared `DatabaseService` injectable wrapping `better-sqlite3`
   - Reads from `data/marvel.db`

3. **API key auth**
   - `api_keys` table in SQLite: `(id, key_hash, user_email, created_at, tier)`
   - NestJS `Guard` checking `x-api-key` header, hashes and looks up in DB
   - Return `401` on missing/invalid key

4. **Rate limiting**
   - `@nestjs/throttler` — in-memory, per-key limits
   - Tier-based: e.g., free = 100 req/min, paid = 1000 req/min

5. **Feature modules** (one per entity)

   Each module gets: `module`, `controller`, `service`

   **Endpoints per entity:**

   ```
   GET /characters              # List all, with pagination + filters
   GET /characters/:id          # Single character
   GET /characters/:id/teams    # Teams a character belongs to
   GET /characters/:id/events   # Events a character appeared in

   GET /comics                  # List all, with filters
   GET /comics/:id              # Single comic

   GET /teams                   # List all, with filters
   GET /teams/:id               # Single team
   GET /teams/:id/members       # Characters in the team

   GET /events                  # List all
   GET /events/:id              # Single event
   GET /events/:id/characters   # Characters in the event
   GET /events/:id/comics       # Comics in the event
   ```

6. **Swagger setup**
   - Swagger UI at `/api/docs`
   - All endpoints testable in browser

7. **Pagination**
   - `?page=` and `?limit=` query params
   - Default limit: 20, max: 100

---

## Out of Scope (for now)

- Write endpoints (API is read-only, except API key registration)
- Image hosting / CDN (store URLs only)
- Scheduled re-scraping / auto-updates
- Multi-server deployment (SQLite is single-server; upgrade to Turso if needed later)
- User-facing registration UI (API keys issued manually or via admin endpoint)
