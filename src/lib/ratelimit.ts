import { db } from "./db";

/**
 * Fixed-window rate limiter backed by Postgres, so every serverless instance shares the same counters
 * (an in-memory limiter is per instance and stops working as soon as the platform scales out).
 * One atomic upsert per call. Returns true while the caller is within `max` hits per `windowMs`.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const secs = windowMs / 1000;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${secs}) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${secs}) THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  // Occasionally drop counters whose window ended long ago, so the table stays small.
  if (Math.random() < 0.01) await db.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - interval '1 day'`;
  return Number(rows[0]?.count ?? 0) <= max;
}
