import type { Request, Response } from "express";
import type { ListOpportunitiesFilters } from "../services/opportunity.service.js";
import {
  createOpportunity,
  getOpportunityById,
  listOpportunities,
} from "../services/opportunity.service.js";
import type { AuthenticatedUser } from "../middleware/authenticate.js";

/**
 * GET /api/opportunities
 * Public, read-only listing with pagination and optional filters.
 */
export async function getOpportunities(_req: Request, res: Response): Promise<void> {
  const { page, limit, category, search } = res.locals.validated?.query ?? {};
  const filters: ListOpportunitiesFilters = { page, limit };
  if (category) filters.category = category;
  if (search) filters.search = search;

  const result = await listOpportunities(filters);
  res.json({ success: true, ...result });
}

/**
 * GET /api/opportunities/:id
 * Public, read-only detail view.
 */
export async function getOpportunityByIdHandler(_req: Request, res: Response): Promise<void> {
  const { id } = res.locals.validated?.params ?? {};
  const opportunity = await getOpportunityById(id);
  res.json({ success: true, data: opportunity });
}

/**
 * POST /api/opportunities
 * Protected event creation. requireJwtAuth has already verified the caller,
 * so the creator identity comes from res.locals.auth — the browser is never
 * trusted for creator identity.
 */
export async function createOpportunityHandler(_req: Request, res: Response): Promise<void> {
  const auth = res.locals.auth as AuthenticatedUser | undefined;
  if (!auth?.userId || !auth.email) {
    // Defensive: requireJwtAuth guarantees this, but never persist creator-less records.
    res.status(401).json({ success: false, status: 401, message: "Invalid or expired token." });
    return;
  }

  const body = res.locals.validated?.body;
  const opportunity = await createOpportunity(body, {
    userId: auth.userId,
    email: auth.email,
    name: auth.name,
  });

  res.status(201).json({ success: true, data: opportunity });
}
