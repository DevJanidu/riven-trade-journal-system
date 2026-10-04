import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { z } from "zod";
import * as schema from "./schema";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL is not configured or is not a PostgreSQL connection URL");
    this.name = "DatabaseConfigurationError";
  }
}

const connectionSchema = z.string().min(1).url().refine(value => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
});

function createDatabase() {
  const parsed = connectionSchema.safeParse(process.env.DATABASE_URL);
  if (!parsed.success) throw new DatabaseConfigurationError();
  return drizzle({ client: neon(parsed.data), schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

export function getDb() {
  database ??= createDatabase();
  return database;
}
