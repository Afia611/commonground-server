import { z } from "zod";

/** Query parameters accepted by GET /api/opportunities */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().trim().min(1).max(60).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

/** Path parameters accepted by GET /api/opportunities/:id (ObjectId or slug) */
export const opportunityParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(
      /^(?:[0-9a-fA-F]{24}|[a-z0-9]+(?:-[a-z0-9]+)*)$/,
      "id must be a 24-character ObjectId or an opportunity slug",
    ),
});

export type ListOpportunitiesQuery = z.infer<typeof listQuerySchema>;

/**
 * Event types accepted for created events. Mirrors the CommonGround design
 * categories used across the site ("Other" covers anything the form lacks).
 */
export const EVENT_TYPES = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Education",
  "Community Care",
  "Other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Non-empty string that parses as an absolute http(s) URL. */
const httpUrl = z
  .string()
  .trim()
  .max(600)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid http(s) URL");

/**
 * A whole calendar day that has not started yet, or has started today
 * (server-local time). Today is accepted; any earlier day is rejected.
 */
function dayIsInFuture(raw: string): boolean {
  const dayStart = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return dayStart.getTime() >= todayStart.getTime();
}

const eventDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Event date must be in YYYY-MM-DD format")
  .refine((raw) => !Number.isNaN(new Date(`${raw}T00:00:00`).getTime()), "Event date is not a real date")
  .refine(dayIsInFuture, "Event date cannot be in the past");

/**
 * Body accepted by POST /api/opportunities. Creator identity is NEVER taken
 * from here — it is bound server-side from the verified JWT (see
 * src/middleware/authenticate.ts). Unknown fields are rejected to keep
 * client payloads explicit.
 */
export const createOpportunityBodySchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
    description: z.string().trim().min(20, "Description must be at least 20 characters").max(4000),
    eventType: z.enum(EVENT_TYPES),
    imageUrl: httpUrl.optional(),
    location: z.string().trim().min(3, "Location must be at least 3 characters").max(200),
    eventDate: eventDateString,
  })
  .strict();

export type CreateOpportunityBody = z.infer<typeof createOpportunityBodySchema>;
