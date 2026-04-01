import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  BadRequestException,
} from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "./public.decorator";
import { SignupService } from "./signup.service";

@ApiTags("auth")
@Controller("auth")
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Post("signup")
  @Public()
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ "per-key": true, global: true })
  @Throttle({ signup: { ttl: 3600000, limit: 3 } })
  @ApiOperation({
    summary: "Request an API key",
    description:
      "Provide your email and your API key will be sent to you. Free tier: 10,000 requests/day.",
  })
  async signup(@Body() body: { email?: string }): Promise<{ message: string }> {
    const email = body?.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      throw new BadRequestException("A valid email address is required");
    }

    await this.signupService.signup(email);

    return { message: "If that email is not already registered, your API key is on its way." };
  }
}
