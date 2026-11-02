
import { Router } from "express";

import {
  createOpportunityHandler,
  getOpportunities,
  getUpcomingOpportunities,
  getOpportunityByIdHandler,
  getMyOpportunitiesHandler,
  updateOpportunityHandler,
  deleteOpportunityHandler,
} from "../controllers/opportunity.controller.js";

import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/notFound.js";
import { requireJwtAuth } from "../middleware/authenticate.js";

import {
  createOpportunityBodySchema,
  updateOpportunityBodySchema,
  listQuerySchema,
  opportunityParamSchema,
} from "../schemas/opportunity.schema.js";

const router = Router();

// GET /api/opportunities — public event listing
router.get(
  "/",
  validate("query", listQuerySchema),
  asyncHandler(getOpportunities),
);

// GET /api/opportunities/upcoming
// Public endpoint: returns up to 6 upcoming events
router.get(
  "/upcoming",
  asyncHandler(getUpcomingOpportunities),
);

// POST /api/opportunities — protected event creation
router.post(
  "/",
  requireJwtAuth,
  validate("body", createOpportunityBodySchema),
  asyncHandler(createOpportunityHandler),
);

// GET /api/opportunities/mine — current user's events
// IMPORTANT: This route must come before /:id
router.get(
  "/mine",
  requireJwtAuth,
  asyncHandler(getMyOpportunitiesHandler),
);

// PATCH /api/opportunities/:id — update own event
router.patch(
  "/:id",
  requireJwtAuth,
  validate("params", opportunityParamSchema),
  validate("body", updateOpportunityBodySchema),
  asyncHandler(updateOpportunityHandler),
);

// DELETE /api/opportunities/:id — delete own event
router.delete(
  "/:id",
  requireJwtAuth,
  validate("params", opportunityParamSchema),
  asyncHandler(deleteOpportunityHandler),
);

// GET /api/opportunities/:id — public event details
router.get(
  "/:id",
  validate("params", opportunityParamSchema),
  asyncHandler(getOpportunityByIdHandler),
);

export default router;
