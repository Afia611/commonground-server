import type { Collection, Db } from "mongodb";
import { ObjectId, OptionalId } from "mongodb";
import { getDb } from "../config/db.js";
import type { Opportunity } from "../types/opportunity.js";
import { ApiError } from "../middleware/errorHandler.js";
import type { CreateOpportunityBody } from "../schemas/opportunity.schema.js";

export const OPPORTUNITIES_COLLECTION = "opportunities";

export interface ListOpportunitiesFilters {
  page: number;
  limit: number;
  category?: string;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Build a Mongo filter from validated list filters.
 * Search matches case-insensitively against title and description.
 */
function buildFilter(filters: ListOpportunitiesFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (filters.category) filter.category = filters.category;
  if (filters.search) {
    const pattern = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
    ];
  }
  return filter;
}

/** List opportunities (read-only), newest first, paginated. */
export async function listOpportunities(
  filters: ListOpportunitiesFilters,
  db?: Db,
): Promise<PaginatedResult<Opportunity>> {
  const database = db ?? getDb();
  const collection = database.collection(OPPORTUNITIES_COLLECTION);
  const filter = buildFilter(filters);
  const skip = (filters.page - 1) * filters.limit;

  const [docs, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(filters.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    data: docs.map((doc) => toOpportunity(doc)),
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  };
}

/**
 * Fetch a single opportunity by id (read-only). Supports both MongoDB
 * ObjectIds (used by API consumers and the frontend after a list request)
 * and the stable demo `slug` (used by older frontend links and bookmarks).
 * Throws 400/404 as ApiError.
 */
export async function getOpportunityById(id: string, db?: Db): Promise<Opportunity> {
  const looksLikeObjectId = ObjectId.isValid(id);
  const query = looksLikeObjectId
    ? { $or: [{ _id: new ObjectId(id) }, { slug: id }] }
    : { slug: id };

  const database = db ?? getDb();
  const doc = await database.collection(OPPORTUNITIES_COLLECTION).findOne(query);

  if (!doc) {
    throw ApiError.notFound(`Opportunity with id '${id}' not found`);
  }
  return toOpportunity(doc);
}

export function toOpportunity(doc: OptionalId<Record<string, unknown>>): Opportunity {
  const { _id, createdAt, updatedAt, ...rest } = doc as {
    _id: ObjectId;
    createdAt?: unknown;
    updatedAt?: unknown;
    [key: string]: unknown;
  };
  return {
    id: _id.toHexString(),
    ...rest,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : undefined,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : undefined,
  } as Opportunity;
}

/** Verified creator identity delivered by the JWT middleware (never by the client). */
export interface OpportunityCreator {
  userId: string;
  email: string;
  name?: string;
}

/** Defaults for fields the create-event form does not collect. */
const DEFAULT_SPOTS = 50;
const SCHEDULE_TIME_ZONE = "UTC";

/** URL-safe slug from a title, mirroring the demo data slug style. */
export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  );
}

async function ensureUniqueSlug(
  collection: Collection<Record<string, unknown>>,
  base: string,
): Promise<string> {
  let candidate = base;
  let attempt = 2;
  while ((await collection.findOne({ slug: candidate })) !== null) {
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }
  return candidate;
}

/** Short city name derived from a full location line (used by the city filter). */
function deriveCity(location: string): string {
  return location.split(",")[0]?.trim() || location;
}

/** "2026-11-14" → "Sat 14 Nov 2026", matching the demo schedule style. */
function formatSchedule(eventDate: string): string {
  const date = new Date(`${eventDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(date);
}

/**
 * Create a new opportunity from a validated body, bound to the creator whose
 * identity was verified via the BetterAuth JWT (requireJwtAuth). Creator
 * fields from the client are ignored — the caller passes only the JWT identity.
 * Records keep the full shape the public detail pages render (organizer,
 * schedule, spots, ...), so created events appear everywhere demo data does.
 */
export async function createOpportunity(
  input: CreateOpportunityBody,
  creator: OpportunityCreator,
  db?: Db,
): Promise<Opportunity> {
  const database = db ?? getDb();
  const collection = database.collection(OPPORTUNITIES_COLLECTION);

  const slug = await ensureUniqueSlug(collection, slugifyTitle(input.title));
  const schedule = formatSchedule(input.eventDate);
  const organizerName = creator.name?.trim() || "CommonGround organizer";

  const now = new Date();
  const record = {
    slug,
    featured: false,
    title: input.title,
    organization: organizerName,
    organizer: {
      name: organizerName,
      about: `This event is hosted by ${organizerName} through CommonGround.`,
      contactEmail: creator.email,
    },
    category: input.eventType,
    location: input.location,
    city: deriveCity(input.location),
    schedule,
    duration: "Single day · flexible hours",
    description: input.description,
    responsibilities: [],
    requirements: [],
    benefits: [],
    spotsTotal: DEFAULT_SPOTS,
    spotsLeft: DEFAULT_SPOTS,
    imageUrl: input.imageUrl ?? null,
    eventDate: new Date(`${input.eventDate}T00:00:00Z`).toISOString(),
    createdBy: {
      userId: creator.userId,
      email: creator.email,
      name: creator.name ?? null,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne({ ...record });
  return toOpportunity({ ...record, _id: result.insertedId });
}
