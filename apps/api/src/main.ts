import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./prisma/prisma-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new PrismaExceptionFilter());
  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`Verro API listening on port ${port}`);
}

bootstrap();
