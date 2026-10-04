import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string, max = 5): { db: Db; client: postgres.Sql } {
  const client = postgres(url, { max, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}

const globalForDb = globalThis as unknown as { __bw?: { db: Db; client: postgres.Sql } };

/** Shared connection for the app. Reused across hot reloads in development. */
export function getDb(): Db {
  if (!globalForDb.__bw) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__bw = createDb(url, 10);
  }
  return globalForDb.__bw.db;
}

export { schema };
