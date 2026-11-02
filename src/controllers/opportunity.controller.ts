
import type { Request, Response } from "express";

import type { ListOpportunitiesFilters } from "../services/opportunity.service.js";

import {
  createOpportunity,
  getOpportunityById,
  listOpportunities,
  listUpcomingOpportunities,
  listMyOpportunities,
  updateOpportunity,
  deleteOpportunity,
} from "../services/opportunity.service.js";

import type { AuthenticatedUser } from "../middleware/authenticate.js";

/**
 * Verified user identity from JWT middleware.
 */
type VerifiedEventUser = AuthenticatedUser & {
  userId: string;
  email: string;
};

/**
 * Retrieve authenticated user from res.locals.auth.
 * Protected routes must run requireJwtAuth first.
 */
function getAuthenticatedUser(
  res: Response,
): VerifiedEventUser | null {
  const auth = res.locals.auth as
    | AuthenticatedUser
    | undefined;

  if (!auth?.userId || !auth.email) {
    res.status(401).json({
      success: false,
      status: 401,
      message: "Invalid or expired token.",
    });

    return null;
  }

  return auth as VerifiedEventUser;
}

/**
 * GET /api/opportunities
 * Public event listing.
 */
export async function getOpportunities(
  _req: Request,
  res: Response,
): Promise<void> {
  const { page, limit, category, search } =
    res.locals.validated?.query ?? {};

  const filters: ListOpportunitiesFilters = {
    page,
    limit,
  };

  if (category) {
    filters.category = category;
  }

  if (search) {
    filters.search = search;
  }

  const result = await listOpportunities(filters);

  res.status(200).json({
    success: true,
    ...result,
  });
}
/**
 * GET /api/opportunities/upcoming
 * Return up to 6 upcoming events for the Home Page.
 */
export async function getUpcomingOpportunities(
  _req: Request,
  res: Response,
): Promise<void> {
  const opportunities = await listUpcomingOpportunities();

  res.status(200).json({
    success: true,
    data: opportunities,
  });
}

/**
 * GET /api/opportunities/:id
 * Public event details.
 */
export async function getOpportunityByIdHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const { id } = res.locals.validated?.params ?? {};

  const opportunity = await getOpportunityById(id);

  res.status(200).json({
    success: true,
    data: opportunity,
  });
}

/**
 * POST /api/opportunities
 * Create an event for the authenticated user.
 */
export async function createOpportunityHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) return;

  const body = res.locals.validated?.body;

  const opportunity = await createOpportunity(body, {
    userId: auth.userId,
    email: auth.email,
    name: auth.name,
  });

  res.status(201).json({
    success: true,
    data: opportunity,
  });
}

/**
 * GET /api/opportunities/mine
 * Return events belonging to the authenticated user.
 */
export async function getMyOpportunitiesHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) return;

  const opportunities = await listMyOpportunities(
    auth.userId,
  );

  res.status(200).json({
    success: true,
    data: opportunities,
  });
}

/**
 * PATCH /api/opportunities/:id
 * Update an event belonging to the authenticated user.
 *
 * Ownership must be enforced in the service layer.
 */
export async function updateOpportunityHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) return;

  const { id } = res.locals.validated?.params ?? {};
  const body = res.locals.validated?.body;

  const opportunity = await updateOpportunity(
    id,
    auth.userId,
    body,
  );

  res.status(200).json({
    success: true,
    message: "Event updated successfully",
    data: opportunity,
  });
}

/**
 * DELETE /api/opportunities/:id
 * Delete an event belonging to the authenticated user.
 *
 * Ownership must be enforced in the service layer.
 */
export async function deleteOpportunityHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) return;

  const { id } = res.locals.validated?.params ?? {};

  await deleteOpportunity(id, auth.userId);

  res.status(200).json({
    success: true,
    message: "Event deleted successfully",
  });
}
