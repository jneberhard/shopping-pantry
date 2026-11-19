import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation/builds work before Neon is provisioned. Migrations require a real URL.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || 'postgresql://setup:setup@localhost:5432/setup' },
});
