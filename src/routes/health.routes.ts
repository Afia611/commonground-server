import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";

const router = Router();

// GET /api/health — public status probe
router.get("/health", getHealth);

export default router;
