import { Router } from "express";
import { getOpportunities, getOpportunityByIdHandler } from "../controllers/opportunity.controller.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/notFound.js";
import { listQuerySchema, opportunityParamSchema } from "../schemas/opportunity.schema.js";

const router = Router();

// GET /api/opportunities — public, read-only, paginated
router.get("/", validate("query", listQuerySchema), asyncHandler(getOpportunities));

// GET /api/opportunities/:id — public, read-only detail
router.get(
  "/:id",
  validate("params", opportunityParamSchema),
  asyncHandler(getOpportunityByIdHandler),
);

export default router;
