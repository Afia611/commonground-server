import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler.js";

/** Final middleware for routes that matched nothing. */
export function notFoundHandler(_req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    status: 404,
    message: `Cannot ${_req.method} ${_req.originalUrl}`,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export { ApiError };
