import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { DatabaseService } from "../database/database.service";

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
      [hash]
    );

    if (!row) {
      throw new UnauthorizedException("Invalid API key");
    }

    // Attach tier to request for rate limiting
    request.apiKeyTier = row.tier;
    return true;
  }
}
