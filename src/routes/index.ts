import { Router } from "express";
import healthRoutes from "./health.routes.js";
import opportunityRoutes from "./opportunity.routes.js";

const router = Router();

// API index — helps humans confirm the backend is up.
router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CommonGround backend API — see /api/health for status",
  });
});

router.use("/", healthRoutes);
router.use("/opportunities", opportunityRoutes);

export default router;
