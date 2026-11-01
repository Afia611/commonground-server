
import { Router } from "express";
import { requireJwtAuth } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/notFound.js";
import { opportunityParamSchema } from "../schemas/opportunity.schema.js";

import {
  joinOpportunityHandler,
  leaveOpportunityHandler,
  getJoinedOpportunitiesHandler,
} from "../controllers/participation.controller.js";

const router = Router();

// GET /api/opportunities/joined
router.get(
  "/joined",
  requireJwtAuth,
  asyncHandler(getJoinedOpportunitiesHandler),
);

// POST /api/opportunities/:id/join
router.post(
  "/:id/join",
  requireJwtAuth,
  validate("params", opportunityParamSchema),
  asyncHandler(joinOpportunityHandler),
);

// DELETE /api/opportunities/:id/join
router.delete(
  "/:id/join",
  requireJwtAuth,
  validate("params", opportunityParamSchema),
  asyncHandler(leaveOpportunityHandler),
);

export default router;
