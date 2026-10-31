import { z } from "zod";

/** Query parameters accepted by GET /api/opportunities */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().trim().min(1).max(60).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

/** Path parameters accepted by GET /api/opportunities/:id */
export const objectIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "id must be a 24-character hexadecimal ObjectId"),
});

export type ListOpportunitiesQuery = z.infer<typeof listQuerySchema>;
