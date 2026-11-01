
import type { Request, Response } from "express";

import type { ListOpportunitiesFilters } from "../services/opportunity.service.js";

import {
  createOpportunity,
  getOpportunityById,
  listOpportunities,
  listMyOpportunities,
  updateOpportunity,
  deleteOpportunity,
} from "../services/opportunity.service.js";

import type { AuthenticatedUser } from "../middleware/authenticate.js";

/**
 * Retrieve the authenticated user from JWT middleware.
 * All protected handlers must use this identity.
 */
function getAuthenticatedUser(
  res: Response,
): AuthenticatedUser | null {
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

  return auth;
}

/**
 * GET /api/opportunities
 *
 * Public event listing with pagination and filters.
 */
export async function getOpportunities(
  _req: Request,
  res: Response,
): Promise<void> {
  const {
    page,
    limit,
    category,
    search,
  } = res.locals.validated?.query ?? {};

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

  res.json({
    success: true,
    ...result,
  });
}

/**
 * GET /api/opportunities/:id
 *
 * Public event detail.
 */
export async function getOpportunityByIdHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const { id } = res.locals.validated?.params ?? {};

  const opportunity = await getOpportunityById(id);

  res.json({
    success: true,
    data: opportunity,
  });
}

/**
 * POST /api/opportunities
 *
 * Create an event.
 * Creator identity comes from verified JWT.
 */
export async function createOpportunityHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) {
    return;
  }

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
 *
 * Return events created by the logged-in user.
 */
export async function getMyOpportunitiesHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) {
    return;
  }

  const opportunities = await listMyOpportunities(
    auth.userId,
  );

  res.json({
    success: true,
    data: opportunities,
  });
}

/**
 * PATCH /api/opportunities/:id
 *
 * Update an event owned by the logged-in user.
 * Ownership is verified in the MongoDB service.
 */
export async function updateOpportunityHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) {
    return;
  }

  const { id } = res.locals.validated?.params ?? {};
  const body = res.locals.validated?.body;

  const opportunity = await updateOpportunity(
    id,
    auth.userId,
    body,
  );

  res.json({
    success: true,
    message: "Event updated successfully",
    data: opportunity,
  });
}

/**
 * DELETE /api/opportunities/:id
 *
 * Delete an event owned by the logged-in user.
 * Ownership is verified in the MongoDB service.
 */
export async function deleteOpportunityHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const auth = getAuthenticatedUser(res);

  if (!auth) {
    return;
  }

  const { id } = res.locals.validated?.params ?? {};

  await deleteOpportunity(id, auth.userId);

  res.json({
    success: true,
    message: "Event deleted successfully",
  });
}
