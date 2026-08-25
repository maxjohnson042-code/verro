import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./prisma/prisma-exception.filter";

async function bootstrap() {
  // rawBody: true preserves the exact request bytes on req.rawBody
  // alongside Nest's normal JSON body parsing - needed by
  // VerificationController's Sumsub webhook handler, which must HMAC-verify
  // the untouched bytes Sumsub sent rather than a re-serialized copy of the
  // parsed body (whitespace/key-order can legitimately differ). Doesn't
  // change behavior for any other route, including multipart file uploads
  // in DocumentsController, which multer handles independently.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  app.useGlobalFilters(new PrismaExceptionFilter());
  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`Verro API listening on port ${port}`);
}

bootstrap();
