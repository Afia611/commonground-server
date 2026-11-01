import { Router } from "express";
import {
  createOpportunityHandler,
  getOpportunities,
  getOpportunityByIdHandler,
} from "../controllers/opportunity.controller.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/notFound.js";
import { requireJwtAuth } from "../middleware/authenticate.js";
import {
  createOpportunityBodySchema,
  listQuerySchema,
  opportunityParamSchema,
} from "../schemas/opportunity.schema.js";

const router = Router();

// GET /api/opportunities — public, read-only, paginated
router.get("/", validate("query", listQuerySchema), asyncHandler(getOpportunities));

// POST /api/opportunities — protected event creation.
// JWT first (401 before body validation), then schema validation, then create.
router.post(
  "/",
  requireJwtAuth,
  validate("body", createOpportunityBodySchema),
  asyncHandler(createOpportunityHandler),
);

// GET /api/opportunities/:id — public, read-only detail
router.get(
  "/:id",
  validate("params", opportunityParamSchema),
  asyncHandler(getOpportunityByIdHandler),
);

export default router;
