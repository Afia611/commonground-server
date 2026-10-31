import type { Request, Response } from "express";
import { getDbStatus } from "../config/db.js";

/**
 * GET /api/health
 * Public liveness/readiness probe. Reports application uptime and MongoDB
 * connection state without exposing any secrets, URIs, or internals.
 */
export function getHealth(_req: Request, res: Response): void {
  const status = getDbStatus();
  res.status(200).json({
    success: true,
    status: "ok",
    service: "commonground-server",
    uptimeSeconds: Math.floor(process.uptime()),
    database: { connected: status === "connected", status },
    timestamp: new Date().toISOString(),
  });
}
