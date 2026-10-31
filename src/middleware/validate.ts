import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "./errorHandler.js";

export type ValidationSource = "query" | "params";

/**
 * Validate request input with a Zod schema. The parsed (and coerced) result is
 * stored on `res.locals.validated[source]`; controllers read from there instead
 * of the raw request. Works in Express 5 where req.query/req.params are read-only.
 */
export function validate(source: ValidationSource, schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const input = req[source];
    const result = schema.safeParse(input);

    if (!result.success) {
      next(
        ApiError.badRequest(`Invalid ${source} parameters`, {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    res.locals.validated = { ...(res.locals.validated ?? {}), [source]: result.data };
    next();
  };
}
