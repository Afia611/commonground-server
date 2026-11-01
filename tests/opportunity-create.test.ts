import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { Express } from "express";

// Pin the BetterAuth origin for the JWT middleware and stub global fetch so
// the "remote" JWKS never leaves the process.
vi.mock("../src/config/env", () => ({
  env: {
    betterAuthUrl: "https://auth.example.test",
    clientUrls: [],
    isProduction: false,
    nodeEnv: "test",
  },
}));

// The service layer touches MongoDB; tests mock it so no database is required.
vi.mock("../src/services/opportunity.service", () => ({
  OPPORTUNITIES_COLLECTION: "opportunities",
  listOpportunities: vi.fn(),
  getOpportunityById: vi.fn(),
  createOpportunity: vi.fn(),
  slugifyTitle: vi.fn(),
}));

import request from "supertest";
import { createOpportunity } from "../src/services/opportunity.service";
import { createApp } from "../src/app";

const BASE_URL = "https://auth.example.test";

const createMock = vi.mocked(createOpportunity);

const bag: { app?: Express; privateKey?: CryptoKey } = {};

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  bag.privateKey = privateKey;

  const publicJwk = { kid: "test-key-1", alg: "RS256", ...(await exportJWK(publicKey)) };
  const jwksResponse = new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  vi.stubGlobal("fetch", vi.fn(async () => jwksResponse.clone()));

  bag.app = createApp();
});

beforeEach(() => {
  createMock.mockReset();
});

async function token(claims: Record<string, unknown> = {}): Promise<string> {
  return await new SignJWT({ email: "host@commonground.test", name: "Sabrina Rahman", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1", typ: "JWT" })
    .setSubject("650a1f1e8f1b2c3d4e5f6a7b")
    .setIssuedAt()
    .setIssuer(BASE_URL)
    .setAudience(BASE_URL)
    .setExpirationTime("5m")
    .sign(bag.privateKey);
}

const DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Community Street Cleanup",
    description: "We will pick up litter along the footpath and plant a few flowering shrubs together.",
    eventType: "Cleanup",
    location: "Rampura Bridge, Dhaka, Bangladesh",
    eventDate: DATE,
    imageUrl: "https://images.example.com/cleanup.jpg",
    ...overrides,
  };
}

function localTodayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

describe("POST /api/opportunities (protected event creation)", () => {
  it("rejects unauthenticated requests before touching the body", async () => {
    const res = await request(bag.app).post("/api/opportunities").send(validBody());

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates an event with the creator bound from the verified JWT", async () => {
    createMock.mockImplementationOnce(async (input) => ({
      id: "650a1f1e8f1b2c3d4e5f6a7d",
      ...input,
      createdAt: "2026-11-01T00:00:00.000Z",
    }));

    const res = await request(bag.app)
      .post("/api/opportunities")
      .set("Authorization", `Bearer ${await token()}`)
      .send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("650a1f1e8f1b2c3d4e5f6a7d");

    // First argument is the validated body, second is the creator —
    // which comes from the JWT, NOT from anything the client could send.
    expect(createMock).toHaveBeenCalledTimes(1);
    const [inputArg, creatorArg] = createMock.mock.calls[0];
    expect(inputArg).toEqual({
      title: "Community Street Cleanup",
      description: expect.stringContaining("litter"),
      eventType: "Cleanup",
      location: "Rampura Bridge, Dhaka, Bangladesh",
      eventDate: DATE,
      imageUrl: "https://images.example.com/cleanup.jpg",
    });
    expect(creatorArg).toEqual({
      userId: "650a1f1e8f1b2c3d4e5f6a7b",
      email: "host@commonground.test",
      name: "Sabrina Rahman",
    });
  });

  it("rejects browser-supplied creator identity outright (strict body)", async () => {
    const res = await request(bag.app)
      .post("/api/opportunities")
      .set("Authorization", `Bearer ${await token()}`)
      .send(validBody({ createdBy: { userId: "attacker-id", email: "attacker@evil.test" } }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects missing required fields with 400", async () => {
    const body = validBody();
    delete body.title;

    const res = await request(bag.app)
      .post("/api/opportunities")
      .set("Authorization", `Bearer ${await token()}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an event date in the past with 400", async () => {
    const res = await request(bag.app)
      .post("/api/opportunities")
      .set("Authorization", `Bearer ${await token()}`)
      .send(validBody({ eventDate: "2024-01-01" }));

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/past/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown event type with 400", async () => {
    const res = await request(bag.app)
      .post("/api/opportunities")
      .set("Authorization", `Bearer ${await token()}`)
      .send(validBody({ eventType: "Blockchain Panel" }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects a non-http thumbnail URL with 400", async () => {
    const res = await request(bag.app)
      .post("/api/opportunities")
      .set("Authorization", `Bearer ${await token()}`)
      .send(validBody({ imageUrl: "javascript:alert(1)" }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("accepts an event date today", async () => {
    createMock.mockImplementationOnce(async (input) => ({
      id: "650a1f1e8f1b2c3d4e5f6a7e",
      ...input,
      createdAt: "2026-11-01T00:00:00.000Z",
    }));

    const today = localTodayISO();
    const res = await request(bag.app)
      .post("/api/opportunities")
      .set("Authorization", `Bearer ${await token()}`)
      .send(validBody({ eventDate: today }));

    expect(res.status).toBe(201);
  });
});
