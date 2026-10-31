import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/**
 * Application-level error that carries an HTTP status code.
 * Thrown by controllers/services for expected failures (validation, not found, ...).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Bad request", details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message);
  }
}

interface ErrorBody {
  success: false;
  status: number;
  message: string;
  details?: unknown;
}

/** Convert any thrown value into a safe JSON error shape. */
function normalizeError(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof ApiError) {
    const body: ErrorBody = { success: false, status: err.status, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return { status: err.status, body };
  }

  // Body parsing failures from express.json() arrive as errors with a status.
  if (typeof err === "object" && err !== null && "status" in err && "type" in err) {
    const status = Number((err as { status: number }).status) || 500;
    return {
      status,
      body: {
        success: false,
        status,
        message: status === 400 ? "Malformed request body" : "Internal server error",
      },
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        success: false,
        status: 400,
        message: "Validation failed",
        details: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }

  // Unexpected errors are logged but their internals are never sent to clients.
  // eslint-disable-next-line no-console
  console.error("[unhandled error]", err);
  return {
    status: 500,
    body: { success: false, status: 500, message: "Internal server error" },
  };
}

/** Centralized error handler — must be registered last. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const { status, body } = normalizeError(err);
  res.status(status).json(body);
}
