import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("GET /api/health", () => {
  it("returns 200 with application status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe("commonground-server");
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(res.body.database).toHaveProperty("connected");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("does not expose secrets or connection strings", async () => {
    const res = await request(app).get("/api/health");
    const serialized = JSON.stringify(res.body);

    expect(serialized).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(serialized).not.toMatch(/JWT_SECRET/i);
    expect(serialized).not.toMatch(/password/i);
  });
});

describe("API root", () => {
  it("GET /api responds with a welcome message", async () => {
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("unknown routes", () => {
  it("returns 404 for unmatched endpoints", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe(404);
  });
});
