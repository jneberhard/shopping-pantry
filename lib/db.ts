import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalDb=globalThis as unknown as {kitchenPrisma?:PrismaClient};
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('Database setup is required.');
  if (!globalDb.kitchenPrisma) {
    const adapter=new PrismaPg({connectionString:process.env.DATABASE_URL, max:3, idleTimeoutMillis:10000, connectionTimeoutMillis:15000});
    globalDb.kitchenPrisma=new PrismaClient({adapter});
  }
  return globalDb.kitchenPrisma;
}
