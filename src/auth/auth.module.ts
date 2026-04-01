import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { SupabaseModule } from "../supabase/supabase.module";
import { ApiKeyGuard } from "./api-key.guard";
import { ApiKeyThrottlerGuard } from "./api-key-throttler.guard";
import { SignupController } from "./signup.controller";
import { SignupService } from "./signup.service";

@Module({
  imports: [SupabaseModule],
  controllers: [SignupController],
  providers: [
    SignupService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyThrottlerGuard,
    },
  ],
})
export class AuthModule {}
