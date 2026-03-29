import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { CharactersModule } from "./characters/characters.module";
import { ComicsModule } from "./comics/comics.module";
import { SeriesModule } from "./series/series.module";
import { TeamsModule } from "./teams/teams.module";
import { EventsModule } from "./events/events.module";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CharactersModule,
    ComicsModule,
    SeriesModule,
    TeamsModule,
    EventsModule,
  ],
})
export class AppModule {}
