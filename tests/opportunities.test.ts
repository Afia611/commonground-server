import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { ApiError } from "../src/middleware/errorHandler";
import type { Opportunity } from "../src/types/opportunity";

// The service layer touches MongoDB; tests mock it so no database is required.
vi.mock("../src/services/opportunity.service", () => ({
  OPPORTUNITIES_COLLECTION: "opportunities",
  listOpportunities: vi.fn(),
  getOpportunityById: vi.fn(),
}));

import { getOpportunityById, listOpportunities } from "../src/services/opportunity.service";

const listMock = vi.mocked(listOpportunities);
const getByIdMock = vi.mocked(getOpportunityById);

const app = createApp();

const sampleOpportunities: Opportunity[] = [
  {
    id: "650a1f1e8f1b2c3d4e5f6a7b",
    title: "River Cleanup at Buriganga",
    category: "Environment",
    location: "Dhaka",
    description: "Community cleanup drive along the river bank.",
    createdAt: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "650a1f1e8f1b2c3d4e5f6a7c",
    title: "Weekend Math Tutoring",
    category: "Education",
    location: "Chattogram",
    description: "Tutor underprivileged students in math.",
    createdAt: "2026-10-02T10:00:00.000Z",
  },
];

const paginated = (data: Opportunity[]) => ({
  data,
  page: 1,
  limit: 12,
  total: data.length,
  totalPages: 1,
});

beforeEach(() => {
  listMock.mockReset();
  getByIdMock.mockReset();
});

describe("GET /api/opportunities", () => {
  it("returns 200 with a paginated list", async () => {
    listMock.mockResolvedValueOnce(paginated(sampleOpportunities));

    const res = await request(app).get("/api/opportunities");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(12);
    expect(res.body.total).toBe(2);
  });

  it("accepts valid pagination and filter parameters", async () => {
    listMock.mockResolvedValueOnce(paginated([sampleOpportunities[0]]));

    const res = await request(app).get(
      "/api/opportunities?page=2&limit=5&category=Environment&search=cleanup",
    );

    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      category: "Environment",
      search: "cleanup",
    });
  });

  it("returns 400 when limit is out of range", async () => {
    const res = await request(app).get("/api/opportunities?limit=500");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details?.issues?.length).toBeGreaterThan(0);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns 400 when page is not a positive integer", async () => {
    const res = await request(app).get("/api/opportunities?page=-1");
    expect(res.status).toBe(400);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the service fails unexpectedly", async () => {
    listMock.mockRejectedValueOnce(new Error("connection pool exhausted"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await request(app).get("/api/opportunities");

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    consoleSpy.mockRestore();
  });
});

describe("GET /api/opportunities/:id", () => {
  const validId = "650a1f1e8f1b2c3d4e5f6a7b";

  it("returns 200 with the opportunity", async () => {
    getByIdMock.mockResolvedValueOnce(sampleOpportunities[0]);

    const res = await request(app).get(`/api/opportunities/${validId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(validId);
    expect(res.body.data.title).toBe("River Cleanup at Buriganga");
    expect(getByIdMock).toHaveBeenCalledWith(validId);
  });

  it("returns 400 for malformed ids", async () => {
    const res = await request(app).get("/api/opportunities/not-an-objectid");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the opportunity does not exist", async () => {
    getByIdMock.mockRejectedValueOnce(
      ApiError.notFound(`Opportunity with id '${validId}' not found`),
    );

    const res = await request(app).get(`/api/opportunities/${validId}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe(404);
  });
});
