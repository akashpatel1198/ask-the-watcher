import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: any): Promise<string> {
    // Use API key hash (set by ApiKeyGuard) instead of IP
    return req.apiKeyHash || req.ip;
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    if (name === "global") {
      // All requests share one bucket regardless of key or endpoint
      return "global-throttle";
    }
    // Per-key: flat across all endpoints (suffix = apiKeyHash)
    return `per-key-${suffix}`;
  }
}
