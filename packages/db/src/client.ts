import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DB url not found");
  }

  const adapter = new PrismaPg(connectionString);

  return new PrismaClient({
    adapter,
  });
}

export const prisma = createPrismaClient();
