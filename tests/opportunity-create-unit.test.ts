import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createOpportunity, slugifyTitle } from "../src/services/opportunity.service";
import type { Db } from "mongodb";

const DATE = "2099-12-15";

function fakeDb(existingSlugs: string[] = []): Db {
  const collection = {
    async findOne(query?: { slug?: string }) {
      if (!existingSlugs.includes(String(query?.slug))) return null;
      return { _id: new ObjectId("650a1f1e8f5f6a7b8e9d0c1a"), slug: query?.slug };
    },
    async insertOne(doc: Record<string, unknown>) {
      return { insertedId: new ObjectId("650a1f1e8f5f6a7b8e9d0c1b"), ...doc };
    },
  };
  return { collection: () => collection } as unknown as Db;
}

const creator = { userId: "650a1f1e8f1b2c3d4e5f6a7b", email: "host@commonground.test", name: "Sabrina Rahman" };

const validInput = {
  title: "Neighborhood Tree Plantation Drive",
  description: "Planting 40 saplings along the main road canopy gap.",
  eventType: "Plantation",
  location: "Uttara Sector 7, Dhaka, Bangladesh",
  eventDate: DATE,
  imageUrl: "https://images.example.com/saplings.jpg",
} as const;

describe("slugifyTitle", () => {
  it("creates URL-safe slugs", () => {
    expect(slugifyTitle("Community Street Cleanup!")).toBe("community-street-cleanup");
    expect(slugifyTitle("  Tree -- Plantation  Drive ")).toBe("tree-plantation-drive");
  });

  it("falls back to a safe slug for symbol-only titles", () => {
    expect(slugifyTitle("!!!")).toBe("event");
  });
});

describe("createOpportunity", () => {
  it("builds the full record the public pages render, bound to the creator", async () => {
    const opportunity = await createOpportunity(validInput, creator, fakeDb());

    expect(opportunity.slug).toBe("neighborhood-tree-plantation-drive");
    expect(opportunity.title).toBe(validInput.title);
    expect(opportunity.category).toBe("Plantation");
    expect(opportunity.city).toBe("Uttara Sector 7");
    expect(opportunity.location).toBe(validInput.location);
    expect(opportunity.schedule).toMatch(/15 Dec 2099/);
    expect(opportunity.description).toBe(validInput.description);
    expect(opportunity.imageUrl).toBe(validInput.imageUrl);
    expect(opportunity.spotsTotal).toBeGreaterThan(0);
    expect(opportunity.spotsLeft).toBe(opportunity.spotsTotal);
    expect(opportunity.organizer).toMatchObject({
      name: "Sabrina Rahman",
      contactEmail: "host@commonground.test",
    });
    expect((opportunity as Record<string, unknown>).createdBy).toMatchObject({
      userId: creator.userId,
      email: creator.email,
    });
  });

  it("derives organizer fallbacks when the JWT has no name", async () => {
    const opportunity = await createOpportunity(
      validInput,
      { userId: creator.userId, email: creator.email },
      fakeDb(),
    );
    expect(opportunity.organization).toBe("CommonGround organizer");
    expect(opportunity.organizer?.name ?? "CommonGround organizer").toBe("CommonGround organizer");
  });

  it("uniquifies slugs when a title already exists", async () => {
    const db = fakeDb(["neighborhood-tree-plantation-drive", "neighborhood-tree-plantation-drive-2"]);
    const opportunity = await createOpportunity(validInput, creator, db);

    expect(opportunity.slug).toBe("neighborhood-tree-plantation-drive-3");
  });
});
