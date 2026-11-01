/**
 * JWT authentication for protected Express APIs.
 *
 * Strategy (single source of truth, no parallel auth system):
 * BetterAuth (frontend, Next.js) issues short-lived JWTs signed with keys it
 * manages in MongoDB. Its JWT plugin exposes the public keys at
 * `/api/auth/jwks` and hands a token to the browser session via
 * `/api/auth/token` or the `authClient.token()` client helper.
 *
 * Frontend clients attach `Authorization: Bearer <jwt>`; this middleware
 * verifies the JWT against the BetterAuth JWKS (jose, EdDSA/RS256 etc.) and
 * puts the authenticated user on res.locals.auth. No secrets are shared —
 * the JWKS endpoint only ever exposes public keys.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  name?: string;
  image?: string;
}

interface RemoteJwkSetCache {
  url: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
}

let jwksCache: RemoteJwkSetCache | null = null;

/** Get (and reuse) the remote JWKS for the BetterAuth instance. */
export function getRemoteJwkSet(jwksUrl: string): RemoteJwkSetCache["jwks"] {
  if (!jwksCache || jwksCache.url !== jwksUrl) {
    jwksCache = { url: jwksUrl, jwks: createRemoteJWKSet(new URL(jwksUrl)) };
  }
  return jwksCache.jwks;
}

/** Resolve the BetterAuth JWKS endpoint URL from configuration. */
export function getBetterAuthJwksUrl(betterAuthUrl = env.betterAuthUrl): string {
  return `${betterAuthUrl.replace(/\/+$/, "")}/api/auth/jwks`;
}

/**
 * Verify a BetterAuth-issued JWT. The token is trusted only if signed by a
 * key published by BetterAuth's JWKS. `iss`/`aud` must match the frontend's
 * configured BETTER_AUTH_URL base URL (BetterAuth sets both).
 */
export async function verifyBetterAuthJwt(
  token: string,
  jwksUrl = getBetterAuthJwksUrl(),
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getRemoteJwkSet(jwksUrl), {
    issuer: env.betterAuthUrl,
    audience: env.betterAuthUrl,
  });
  return payload;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Express middleware: require a valid BetterAuth Bearer JWT.
 * On success the caller finds `res.locals.auth` (see AuthenticatedUser);
 * otherwise the request is answered with a proper 401 JSON body.
 */
export function requireJwtAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      status: 401,
      message: "Authentication required: provide a Bearer token.",
    });
    return;
  }

  verifyBetterAuthJwt(token)
    .then((payload) => {
      if (!payload.sub) {
        res.status(401).json({
          success: false,
          status: 401,
          message: "Invalid or expired token.",
        });
        return;
      }

      const user: AuthenticatedUser = {
        userId: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
        image: typeof payload.image === "string" ? payload.image : undefined,
      };
      res.locals.auth = user;
      next();
    })
    .catch(() => {
      // Invalid signature, unknown key, expired token — never leak internals.
      res.status(401).json({
        success: false,
        status: 401,
        message: "Invalid or expired token.",
      });
    });
}
