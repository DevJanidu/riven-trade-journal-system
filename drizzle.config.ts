import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  config({ path: ".env.production.local" });
  config({ path: ".env.production" });
} else {
  config({ path: ".env.development.local" });
  config({ path: ".env.local" });
}
config({ path: ".env" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(process.env.DATABASE_URL ? { dbCredentials: { url: process.env.DATABASE_URL } } : {}),
});
