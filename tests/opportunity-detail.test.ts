import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

// Mock the MongoDB connection helper so service lookups run against a stub.
const fakeCollection = {
  findOne: vi.fn(),
};

vi.mock("../src/config/db", () => ({
  getDb: () => ({
    collection: () => fakeCollection,
  }),
}));

import { getOpportunityById } from "../src/services/opportunity.service";
import { opportunityParamSchema } from "../src/schemas/opportunity.schema";
import type { Db } from "../src/config/db";

const doc = {
  _id: new ObjectId("650a1f1e8f1b2c3d4e5f6a7b"),
  slug: "garden-restoration",
  title: "Community Garden Restoration",
  category: "Environment",
  createdAt: new Date(),
};

beforeEach(() => {
  fakeCollection.findOne.mockReset();
});

describe("opportunity detail id handling", () => {
  it("resolves 24-hex ids by _id first, with slug fallback", async () => {
    fakeCollection.findOne.mockResolvedValueOnce(doc);

    const result = await getOpportunityById("650a1f1e8f1b2c3d4e5f6a7b");

    expect(result.slug).toBe("garden-restoration");
    expect(fakeCollection.findOne).toHaveBeenCalledWith({
      $or: [
        { _id: new ObjectId("650a1f1e8f1b2c3d4e5f6a7b") },
        { slug: "650a1f1e8f1b2c3d4e5f6a7b" },
      ],
    });
  });

  it("resolves slug ids by the slug field only", async () => {
    fakeCollection.findOne.mockResolvedValueOnce(doc);

    const result = await getOpportunityById("garden-restoration");

    expect(result.title).toBe("Community Garden Restoration");
    expect(fakeCollection.findOne).toHaveBeenCalledWith({ slug: "garden-restoration" });
  });

  it("returns the API shape with id as string and timestamps as ISO", async () => {
    fakeCollection.findOne.mockResolvedValueOnce(doc);

    const result = await getOpportunityById("garden-restoration");

    expect(result.id).toBe("650a1f1e8f1b2c3d4e5f6a7b");
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result).toHaveProperty("slug", "garden-restoration");
  });
});

describe("opportunity detail param schema", () => {
  it("accepts ObjectIds and slugs", () => {
    expect(
      opportunityParamSchema.safeParse({ id: "650a1f1e8f1b2c3d4e5f6a7b" }).success,
    ).toBe(true);
    expect(opportunityParamSchema.safeParse({ id: "garden-restoration" }).success).toBe(true);
    expect(opportunityParamSchema.safeParse({ id: "riverside-clean-up" }).success).toBe(true);
  });

  it("rejects ids that are neither ObjectId nor slug", () => {
    expect(opportunityParamSchema.safeParse({ id: "not_an_objectid" }).success).toBe(false);
    expect(opportunityParamSchema.safeParse({ id: "" }).success).toBe(false);
    expect(opportunityParamSchema.safeParse({ id: "-invalid-" }).success).toBe(false);
    expect(opportunityParamSchema.safeParse({ id: "../../etc" }).success).toBe(false);
  });
});
