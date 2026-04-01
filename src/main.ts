import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  // Swagger docs at /api/docs
  const config = new DocumentBuilder()
    .setTitle("Ask the Watcher — Marvel Wiki API")
    .setDescription(
      "REST API serving Marvel characters, comics, series, teams, and events scraped from the Marvel Fandom Wiki."
    )
    .setVersion("1.0")
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "api-key")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
