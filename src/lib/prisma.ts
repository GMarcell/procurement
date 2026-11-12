import { PrismaClient } from "@prisma/client";

// Next.js hot reload creates a new module instance on every change. Cache the
// client on globalThis so development doesn't exhaust database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
