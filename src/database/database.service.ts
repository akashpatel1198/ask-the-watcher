import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Database from "better-sqlite3";
import * as path from "path";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), "data", "marvel.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  /** Run a query that returns rows (SELECT) */
  query<T = any>(sql: string, params: any[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  /** Run a query that returns a single row */
  queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  /** Run a statement that modifies data (INSERT/UPDATE/DELETE) */
  run(sql: string, params: any[] = []) {
    return this.db.prepare(sql).run(...params);
  }

  onModuleDestroy() {
    this.db.close();
  }
}
