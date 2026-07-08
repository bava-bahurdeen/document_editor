

import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

const DATABASE_URL =
  process.env.DATABASE_URL ??
  (() => {
    throw new Error(
      "DATABASE_URL is not set. Add it to your .env file before running Prisma CLI commands."
    );
  })();

const urlWithSsl = DATABASE_URL.includes("sslmode")
  ? DATABASE_URL
  : `${DATABASE_URL}?sslmode=require`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: urlWithSsl,
  },
});
