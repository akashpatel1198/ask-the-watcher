// Shared SQLite client — used by all scripts and the NestJS API
// Opens (or creates) the database file at data/marvel.db

import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "marvel.db");

const db = new Database(DB_PATH);

// Performance settings for read-heavy workload
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export default db;
export { DB_PATH };
