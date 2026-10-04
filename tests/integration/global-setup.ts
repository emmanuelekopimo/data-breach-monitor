import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/breachwatch_test";

/** Recreates the test database schema from the committed migrations. */
export default async function setup() {
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await client`select 1`;
  } catch (err) {
    throw new Error(`Test database is not reachable at ${TEST_DATABASE_URL}. Run "service postgresql start" and create the breachwatch_test database.\n${(err as Error).message}`);
  }
  await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}
