/**
 * Development-only seed script.
 *
 * Inserts the six original CommonGround sample opportunities (from the
 * frontend demo data) into the `opportunities` collection.
 *
 * Usage:  npm run seed
 *
 * Safety properties:
 * - **Idempotent**: upserts by a unique `slug` — running it any number of
 *   times refreshes the six documents in place instead of duplicating them.
 * - **Manual only**: never imported by the server, so nothing is seeded at
 *   startup.
 * - **Development tool**: it overwrites the six sample documents with the
 *   shipped demo data and is not intended for production use.
 *
 * MongoDB credentials are read exclusively from `.env` and are never printed;
 * log output only reports counts and a redacted connection target.
 */

import { connectToDatabase, closeDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { OPPORTUNITIES_COLLECTION } from "../services/opportunity.service.js";
import { sampleOpportunities } from "../data/sample-opportunities.js";

/**
 * Fixed demo base date. Each record gets a deterministic, staggered
 * `createdAt` so the API's "newest first" ordering shows the samples
 * in their original demo order. Stable across runs — reseeding does
 * not churn timestamps.
 */
const DEMO_BASE_DATE = new Date("2026-11-01T00:00:00.000Z");

function demoCreatedAt(index: number): Date {
  const offsetMs = (sampleOpportunities.length - 1 - index) * 3_600_000;
  return new Date(DEMO_BASE_DATE.getTime() + offsetMs);
}

async function seed(): Promise<void> {
  // Never log the URI itself — only whether it is a local or remote target.
  const target = env.mongoUri.startsWith("mongodb+srv") ? "Atlas cluster" : "local instance";
  console.log(`Seeding database "${env.dbName}" (${OPPORTUNITIES_COLLECTION} collection on ${target})...`);

  const db = await connectToDatabase(env.mongoUri, env.dbName);
  const collection = db.collection(OPPORTUNITIES_COLLECTION);

  // Protect against accidents: seed only touches documents carrying our slug.
  await collection.createIndex({ slug: 1 }, { unique: true });

  let upserted = 0;
  let updated = 0;

  for (let i = 0; i < sampleOpportunities.length; i++) {
    const { slug, ...fields } = sampleOpportunities[i];
    const result = await collection.updateOne(
      { slug },
      {
        $set: { ...fields, slug, createdAt: demoCreatedAt(i), updatedAt: new Date() },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      upserted += 1;
    } else if (result.matchedCount > 0) {
      updated += 1;
    }
  }

  const total = await collection.countDocuments({ slug: { $in: sampleOpportunities.map((s) => s.slug) } });

  console.log(`Seed complete: ${upserted} inserted, ${updated} updated.`);
  console.log(`'opportunities' collection now holds ${total} sample opportunity document(s).`);

  if (upserted > 0 && total !== sampleOpportunities.length) {
    console.warn(
      `Warning: expected ${sampleOpportunities.length} sample documents but found ${total}. ` +
        "The collection may contain other documents or stale duplicates.",
    );
  }
}

seed()
  .then(async () => {
    await closeDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seeding failed:", err instanceof Error ? err.message : err);
    await closeDatabase();
    process.exit(1);
  });
