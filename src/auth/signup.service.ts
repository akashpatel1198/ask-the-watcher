import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class SignupService {
  constructor(private readonly db: DatabaseService) {}

  async signup(email: string): Promise<void> {
    const existing = this.db.queryOne(
      "SELECT id FROM api_keys WHERE user_email = ?",
      [email],
    );
    if (existing) {
      // Don't reveal whether the email exists — just return silently
      return;
    }

    const rawKey = randomUUID();
    const hash = createHash("sha256").update(rawKey).digest("hex");

    this.db.run(
      "INSERT INTO api_keys (key_hash, user_email, tier) VALUES (?, ?, ?)",
      [hash, email, "free"],
    );

    await Promise.all([
      this.sendKeyToUser(email, rawKey),
      this.notifyOwner(email),
    ]);
  }

  private async sendKeyToUser(email: string, rawKey: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: "Your Ask the Watcher API key",
      text: [
        "Here is your API key for Ask the Watcher:",
        "",
        `  ${rawKey}`,
        "",
        "Include it in requests as the x-api-key header:",
        "",
        "  curl -H 'x-api-key: <your-key>' https://<host>/api/characters",
        "",
        "Free tier: 10,000 requests/day.",
        "Keep this key safe — it cannot be recovered.",
      ].join("\n"),
    });
  }

  private async notifyOwner(userEmail: string): Promise<void> {
    const ownerEmail = process.env.OWNER_EMAIL;
    if (!ownerEmail) return;

    await this.sendEmail({
      to: ownerEmail,
      subject: "New API key issued",
      text: `A new free-tier key was issued to: ${userEmail}\nTime: ${new Date().toISOString()}`,
    });
  }

  private async sendEmail(opts: {
    to: string;
    subject: string;
    text: string;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      console.warn("Resend not configured — skipping email to", opts.to);
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error:", res.status, body);
      throw new InternalServerErrorException("Failed to send email");
    }
  }
}
