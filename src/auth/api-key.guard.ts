import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash } from "crypto";
import { SupabaseService } from "../supabase/supabase.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

const DAILY_CAP: Record<string, number> = {
  free: 10_000,
  paid: 100_000,
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
      throw new UnauthorizedException("Missing x-api-key header");
    }

    const hash = createHash("sha256").update(apiKey).digest("hex");

    const { data: row } = await this.supabase.client
      .from("api_keys")
      .select("tier")
      .eq("key_hash", hash)
      .single();

    if (!row) {
      throw new UnauthorizedException("Invalid API key");
    }

    // Check daily cap
    const today = new Date().toISOString().slice(0, 10);
    const cap = DAILY_CAP[row.tier] ?? DAILY_CAP.free;

    const { data: usage } = await this.supabase.client
      .from("api_key_usage")
      .select("request_count")
      .eq("key_hash", hash)
      .eq("date", today)
      .single();

    if (usage && usage.request_count >= cap) {
      throw new UnauthorizedException(
        `Daily request limit (${cap}) exceeded. Resets at midnight UTC.`,
      );
    }

    // Atomic increment via postgres function
    await this.supabase.client.rpc("increment_api_key_usage", {
      p_key_hash: hash,
      p_date: today,
    });

    // Attach to request for downstream guards
    request.apiKeyTier = row.tier;
    request.apiKeyHash = hash;
    return true;
  }
}
