import { PrismaClient } from "@prisma/client";

// Shared Prisma client singleton - imported by the NestJS API.
// Avoids exhausting Postgres connections during hot-reload in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
