
import type { Request, Response } from "express";

import type { AuthenticatedUser } from "../middleware/authenticate.js";

import {
  joinOpportunity,
  leaveOpportunity,
  listJoinedOpportunities,
} from "../services/participation.service.js";

/**
 * Retrieve the authenticated user from JWT middleware.
 */
function getAuthenticatedUser(
  res: Response,
): AuthenticatedUser | null {
  const auth = res.locals.auth as
    | AuthenticatedUser
    | undefined;

  if (!auth?.userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });

    return null;
  }

  return auth;
}

/**
 * POST /api/opportunities/:id/join
 */
export async function joinOpportunityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) return;

  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    res.status(400).json({
      success: false,
      message: "A valid opportunity ID is required.",
    });
    return;
  }

  const result = await joinOpportunity(
    id,
    auth.userId,
  );

  res.status(201).json({
    success: true,
    message: "You have successfully joined this opportunity.",
    data: result,
  });
}

/**
 * DELETE /api/opportunities/:id/join
 */
export async function leaveOpportunityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) return;

  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    res.status(400).json({
      success: false,
      message: "A valid opportunity ID is required.",
    });
    return;
  }

  await leaveOpportunity(
    id,
    auth.userId,
  );

  res.status(200).json({
    success: true,
    message: "You have successfully left this opportunity.",
  });
}

/**
 * GET /api/opportunities/joined
 */
export async function getJoinedOpportunitiesHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) return;

  const opportunities =
    await listJoinedOpportunities(auth.userId);

  res.status(200).json({
    success: true,
    data: opportunities,
  });
}
