import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/** Health check used by Railway. Also pings the database. */
export async function GET() {
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() });
  } catch (err) {
    return Response.json({ status: "error", database: "unreachable", error: (err as Error).message }, { status: 503 });
  }
}
