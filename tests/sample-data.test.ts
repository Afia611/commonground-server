import { describe, expect, it } from "vitest";
import { sampleOpportunities } from "../src/data/sample-opportunities";
import type { SampleOpportunity } from "../src/data/sample-opportunities";

const REQUIRED_TEXT_FIELDS: Array<keyof SampleOpportunity> = [
  "slug",
  "title",
  "organization",
  "category",
  "city",
  "schedule",
  "duration",
  "description",
];

describe("sample opportunities seed data", () => {
  it("contains exactly the six original sample opportunities", () => {
    expect(sampleOpportunities).toHaveLength(6);
  });

  it("uses unique, url-friendly slugs", () => {
    const slugs = sampleOpportunities.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("has all required text fields filled in", () => {
    for (const opportunity of sampleOpportunities) {
      for (const field of REQUIRED_TEXT_FIELDS) {
        expect(opportunity[field], `${opportunity.slug}.${String(field)}`).toBeTruthy();
      }
      expect(opportunity.spotsTotal).toBeGreaterThan(0);
      expect(opportunity.spotsLeft).toBeGreaterThanOrEqual(0);
      expect(opportunity.spotsLeft).toBeLessThanOrEqual(opportunity.spotsTotal);
      expect(opportunity.featured).toBeTypeOf("boolean");
    }
  });

  it("has complete organizer profiles and array fields", () => {
    for (const opportunity of sampleOpportunities) {
      expect(opportunity.organizer.name).toBeTruthy();
      expect(opportunity.organizer.about).toBeTruthy();
      expect(opportunity.organizer.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(opportunity.location).toContain(opportunity.city);
      for (const listField of ["responsibilities", "requirements", "benefits"] as const) {
        expect(opportunity[listField], `${opportunity.slug}.${listField}`).not.toHaveLength(0);
      }
    }
  });

  it("preserves the original frontend categories and cities", () => {
    expect(new Set(sampleOpportunities.map((o) => o.category))).toEqual(
      new Set(["Environment", "Community Care", "Education", "Sports"]),
    );
    expect(new Set(sampleOpportunities.map((o) => o.city))).toEqual(
      new Set(["Dhaka", "Cox's Bazar", "Sylhet"]),
    );
  });
});
