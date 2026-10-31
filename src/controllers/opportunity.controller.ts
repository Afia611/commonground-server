import type { Request, Response } from "express";
import type { ListOpportunitiesFilters } from "../services/opportunity.service.js";
import { getOpportunityById, listOpportunities } from "../services/opportunity.service.js";

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
