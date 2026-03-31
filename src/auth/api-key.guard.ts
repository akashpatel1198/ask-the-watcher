import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { DatabaseService } from "../database/database.service";

const DAILY_CAP: Record<string, number> = {
  free: 10_000,
  paid: 100_000,
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {
    // Ensure api_keys table exists
    this.db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL UNIQUE,
        user_email TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        tier TEXT DEFAULT 'free'
      )
    `);

    // Usage tracking table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS api_key_usage (
        key_hash TEXT NOT NULL,
        date TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (key_hash, date)
      )
    `);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
      throw new UnauthorizedException("Missing x-api-key header");
    }

    const hash = createHash("sha256").update(apiKey).digest("hex");
    const row = this.db.queryOne<{ tier: string }>(
      "SELECT tier FROM api_keys WHERE key_hash = ?",
      [hash],
    );

    if (!row) {
      throw new UnauthorizedException("Invalid API key");
    }

    // Check daily cap
    const today = new Date().toISOString().slice(0, 10);
    const cap = DAILY_CAP[row.tier] ?? DAILY_CAP.free;

    const usage = this.db.queryOne<{ request_count: number }>(
      "SELECT request_count FROM api_key_usage WHERE key_hash = ? AND date = ?",
      [hash, today],
    );

    if (usage && usage.request_count >= cap) {
      throw new UnauthorizedException(
        `Daily request limit (${cap}) exceeded. Resets at midnight UTC.`,
      );
    }

    // Increment usage counter (upsert)
    this.db.run(
      `INSERT INTO api_key_usage (key_hash, date, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT (key_hash, date)
       DO UPDATE SET request_count = request_count + 1`,
      [hash, today],
    );

    // Attach to request for downstream guards
    request.apiKeyTier = row.tier;
    request.apiKeyHash = hash;
    return true;
  }
}
