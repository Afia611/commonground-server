import { Router } from "express";
import healthRoutes from "./health.routes.js";
import opportunityRoutes from "./opportunity.routes.js";
import { requireJwtAuth } from "../middleware/authenticate.js";
import type { AuthenticatedUser } from "../middleware/authenticate.js";

const router = Router();

// API index — helps humans confirm the backend is up.
router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CommonGround backend API — see /api/health for status",
  });
});

// Protected profile ping: requires a valid BetterAuth Bearer JWT.
router.get("/me", requireJwtAuth, (_req, res) => {
  const auth = res.locals.auth as AuthenticatedUser | undefined;
  res.status(200).json({
    success: true,
    data: {
      userId: auth?.userId,
      email: auth?.email ?? null,
      name: auth?.name ?? null,
      image: auth?.image ?? null,
    },
  });
});

router.use("/", healthRoutes);
router.use("/opportunities", opportunityRoutes);

export default router;
