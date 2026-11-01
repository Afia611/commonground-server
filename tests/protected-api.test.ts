import { beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { Express } from "express";

// The verifier reads the BetterAuth origin from config — pin a fake one here
// AND stub global fetch so the "remote" JWKS never leaves the process.
vi.mock("../src/config/env", () => ({
  env: {
    betterAuthUrl: "https://auth.example.test",
    isProduction: false,
    nodeEnv: "test",
  },
}));

import { requireJwtAuth, verifyBetterAuthJwt } from "../src/middleware/authenticate";

const BASE_URL = "https://auth.example.test";
const TEST_USER_ID = "650a1f1e8f1b2c3d4e5f6a7b";

const bag: {
  app?: Express;
  privateKey?: CryptoKey;
} = {};

// One published keypair: the "JWKS" serves its public half; tokens are signed
// with the private half, exactly like BetterAuth does with its stored keys.
// NOTE: the fetch stub stays in place for the whole file (no unstubAllGlobals)
// — createRemoteJWKSet fetches lazily during token verification.
beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  bag.privateKey = privateKey;

  const publicJwk = { kid: "test-key-1", alg: "RS256", ...(await exportJWK(publicKey)) };
  const jwksResponse = new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jwksResponse.clone()),
  );

  // Minimal express app mounting the middleware for supertest.
  const express = await import("express");
  const app = express.default();
  app.get("/me", requireJwtAuth, (_req, res) => {
    const auth = res.locals.auth as { userId: string; email?: string; name?: string } | undefined;
    res.status(200).json({ success: true, data: auth });
  });
  bag.app = app;
});

async function signInToken(overrides: Record<string, unknown> = {}, expiresAt = "5m"): Promise<string> {
  return await new SignJWT({ email: "sabrina@commonground.test", name: "Sabrina Rahman", ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1", typ: "JWT" })
    .setSubject(TEST_USER_ID)
    .setIssuedAt()
    .setIssuer(BASE_URL)
    .setAudience(BASE_URL)
    .setExpirationTime(expiresAt)
    .sign(bag.privateKey);
}

describe("requireJwtAuth (BetterAuth JWKS verification)", () => {
  it("rejects requests without an Authorization header on GET /me", async () => {
    const request = (await import("supertest")).default;
    const res = await request(bag.app).get("/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Bearer/i);
  });

  it("rejects malformed bearer tokens", async () => {
    const request = (await import("supertest")).default;
    const res = await request(bag.app)
      .get("/me")
      .set("Authorization", "Bearer not-a-real-jwt");

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid or expired token/);
  });

  it("accepts a valid BetterAuth-issued JWT and exposes the user", async () => {
    const token = await signInToken();
    const request = (await import("supertest")).default;
    const res = await request(bag.app)
      .get("/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(TEST_USER_ID);
    expect(res.body.data.email).toBe("sabrina@commonground.test");
    expect(res.body.data.name).toBe("Sabrina Rahman");
  });

  it("rejects tokens signed by a key that is not published in the JWKS", async () => {
    const { privateKey: rogueKey } = await generateKeyPair("RS256", { extractable: true });
    const forged = await new SignJWT({ email: "imposter@evil.test", name: "Imposter" })
      .setProtectedHeader({ alg: "RS256", kid: "rogue-key", typ: "JWT" })
      .setSubject("999999999999999999999999")
      .setIssuedAt()
      .setIssuer(BASE_URL)
      .setAudience(BASE_URL)
      .setExpirationTime("5m")
      .sign(rogueKey);

    const request = (await import("supertest")).default;
    const res = await request(bag.app)
      .get("/me")
      .set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid or expired token/);
  });

  it("rejects expired tokens", async () => {
    const token = await new SignJWT({ email: "old@commonground.test" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-1", typ: "JWT" })
      .setSubject(TEST_USER_ID)
      .setIssuedAt(Math.floor(Date.parse("2024-01-01T00:00:00Z") / 1000))
      .setIssuer(BASE_URL)
      .setAudience(BASE_URL)
      .setExpirationTime(Math.floor(Date.parse("2024-01-01T01:00:00Z") / 1000))
      .sign(bag.privateKey);

    await expect(verifyBetterAuthJwt(token)).rejects.toThrow();
  });

  it("rejects tokens with wrong issuer or audience", async () => {
    const token = await new SignJWT({ email: "weird@commonground.test" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-1", typ: "JWT" })
      .setSubject(TEST_USER_ID)
      .setIssuedAt()
      .setIssuer("https://not-the-auth-origin.test")
      .setAudience(BASE_URL)
      .setExpirationTime("5m")
      .sign(bag.privateKey);

    await expect(verifyBetterAuthJwt(token)).rejects.toThrow();
  });
});
