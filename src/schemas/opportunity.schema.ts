
import { z } from "zod";

/**
 * Query parameters accepted by GET /api/opportunities.
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().trim().min(1).max(60).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListOpportunitiesQuery = z.infer<
  typeof listQuerySchema
>;

/**
 * Path parameters for opportunity details,
 * updates, and deletion.
 *
 * Supports MongoDB ObjectId and event slug.
 */
export const opportunityParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(
      /^(?:[0-9a-fA-F]{24}|[a-z0-9]+(?:-[a-z0-9]+)*)$/,
      "ID must be a 24-character ObjectId or an opportunity slug"
    ),
});

/**
 * Available event categories.
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

/**
 * Validate image URL.
 * Only HTTP and HTTPS URLs are accepted.
 */
const httpUrl = z
  .string()
  .trim()
  .max(600)
  .refine(
    (value) => {
      try {
        const url = new URL(value);

        return (
          url.protocol === "http:" ||
          url.protocol === "https:"
        );
      } catch {
        return false;
      }
    },
    "Must be a valid HTTP or HTTPS URL"
  );

/**
 * Validate that the supplied date is a real
 * calendar date in YYYY-MM-DD format.
 *
 * Rejects invalid dates such as 2026-02-30.
 */
function isRealCalendarDate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return false;
  }

  const date = new Date(`${raw}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === raw;
}

/**
 * Get today's calendar date in Bangladesh.
 *
 * Using Asia/Dhaka avoids date differences
 * caused by the hosting server's timezone.
 */
function getTodayInBangladesh(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Accept only future calendar dates.
 *
 * Today's date and all past dates are rejected.
 */
function dayIsInFuture(raw: string): boolean {
  if (!isRealCalendarDate(raw)) {
    return false;
  }

  const today = getTodayInBangladesh();

  return raw > today;
}

/**
 * Event date validation.
 *
 * Requirements:
 * - YYYY-MM-DD format
 * - Real calendar date
 * - Strictly after today
 */
const eventDateString = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Event date must be in YYYY-MM-DD format"
  )
  .refine(
    isRealCalendarDate,
    "Event date is not a real calendar date"
  )
  .refine(
    dayIsInFuture,
    "Event date must be in the future"
  );

/**
 * POST /api/opportunities
 *
 * Create Event validation.
 *
 * Creator identity comes from the verified JWT,
 * never from the submitted request body.
 */
export const createOpportunityBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(120),

    description: z
      .string()
      .trim()
      .min(20, "Description must be at least 20 characters")
      .max(4000),

    eventType: z.enum(EVENT_TYPES),

    imageUrl: httpUrl.optional(),

    location: z
      .string()
      .trim()
      .min(3, "Location must be at least 3 characters")
      .max(200),

    eventDate: eventDateString,
  })
  .strict();

export type CreateOpportunityBody = z.infer<
  typeof createOpportunityBodySchema
>;

/**
 * PATCH /api/opportunities/:id
 *
 * Update Event validation.
 *
 * Allows partial updates but requires at least
 * one editable field.
 *
 * Protected fields such as createdBy, createdAt,
 * and spotsLeft cannot be modified.
 */
export const updateOpportunityBodySchema =
  createOpportunityBodySchema
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      "Provide at least one field to update"
    );

export type UpdateOpportunityBody = z.infer<
  typeof updateOpportunityBodySchema
>;
