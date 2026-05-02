import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type EmberDatabase = ReturnType<typeof createDatabase>;

declare global {
  var __emberDb: EmberDatabase | undefined;
}

function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return databaseUrl;
}

function createDatabase() {
  const sql = postgres(readDatabaseUrl(), {
    max: 10,
    prepare: false,
  });

  return drizzle(sql, { schema });
}

export function getDb() {
  if (!globalThis.__emberDb) {
    globalThis.__emberDb = createDatabase();
  }

  return globalThis.__emberDb;
}
