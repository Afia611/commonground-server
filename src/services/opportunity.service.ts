
import type { Collection, Db, Filter } from "mongodb";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import type { Opportunity } from "../types/opportunity.js";
import { ApiError } from "../middleware/errorHandler.js";
import type {
  CreateOpportunityBody,
  UpdateOpportunityBody,
} from "../schemas/opportunity.schema.js";

export const OPPORTUNITIES_COLLECTION = "opportunities";

type OpportunityDocument = Record<string, unknown> & {
  _id?: ObjectId;
};

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
 * Build MongoDB filters for public event listing.
 */
function buildFilter(
  filters: ListOpportunitiesFilters,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (filters.category) {
    filter.category = filters.category;
  }

  if (filters.search) {
    const pattern = filters.search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    filter.$or = [
      { title: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
    ];
  }

  return filter;
}

/**
 * Convert MongoDB documents to frontend-friendly events.
 */
export function toOpportunity(
  doc: OpportunityDocument,
): Opportunity {
  const { _id, createdAt, updatedAt, ...rest } = doc;

  if (!(_id instanceof ObjectId)) {
    throw new Error("Opportunity document is missing a valid ObjectId");
  }

  return {
    id: _id.toHexString(),
    ...rest,
    createdAt:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : undefined,
    updatedAt:
      updatedAt instanceof Date
        ? updatedAt.toISOString()
        : undefined,
  } as Opportunity;
}

/**
 * GET /api/opportunities
 * Public listing, newest first, with pagination.
 */
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
    totalPages: Math.max(
      1,
      Math.ceil(total / filters.limit),
    ),
  };
}

/**
 * Build a MongoDB identity filter.
 * Supports both ObjectId and slug.
 */
function opportunityIdentityFilter(
  id: string,
): Filter<OpportunityDocument> {
  if (ObjectId.isValid(id)) {
    return {
      $or: [
        { _id: new ObjectId(id) },
        { slug: id },
      ],
    };
  }

  return { slug: id };
}

/**
 * GET /api/opportunities/:id
 * Public opportunity details.
 */
export async function getOpportunityById(
  id: string,
  db?: Db,
): Promise<Opportunity> {
  const database = db ?? getDb();

  const doc = await database
    .collection<OpportunityDocument>(OPPORTUNITIES_COLLECTION)
    .findOne(opportunityIdentityFilter(id));

  if (!doc) {
    throw ApiError.notFound(
      `Opportunity with id '${id}' not found`,
    );
  }

  return toOpportunity(doc);
}

/**
 * Verified creator identity from JWT.
 */
export interface OpportunityCreator {
  userId: string;
  email: string;
  name?: string;
}

const DEFAULT_SPOTS = 50;
const SCHEDULE_TIME_ZONE = "UTC";

/**
 * Convert event titles to URL-friendly slugs.
 */
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

/**
 * Generate a unique event slug.
 */
async function ensureUniqueSlug(
  collection: Collection<OpportunityDocument>,
  base: string,
): Promise<string> {
  let candidate = base;
  let attempt = 2;

  while (
    (await collection.findOne({ slug: candidate })) !== null
  ) {
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }

  return candidate;
}

/**
 * Extract city from event location.
 */
function deriveCity(location: string): string {
  return location.split(",")[0]?.trim() || location;
}

/**
 * Format an event date for display.
 */
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
 * POST /api/opportunities
 *
 * Create an event using the authenticated user's identity.
 */
export async function createOpportunity(
  input: CreateOpportunityBody,
  creator: OpportunityCreator,
  db?: Db,
): Promise<Opportunity> {
  const database = db ?? getDb();

  const collection =
    database.collection<OpportunityDocument>(
      OPPORTUNITIES_COLLECTION,
    );

  const slug = await ensureUniqueSlug(
    collection,
    slugifyTitle(input.title),
  );

  const schedule = formatSchedule(input.eventDate);

  const organizerName =
    creator.name?.trim() || "CommonGround organizer";

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
    eventDate: new Date(
      `${input.eventDate}T00:00:00Z`,
    ).toISOString(),
    createdBy: {
      userId: creator.userId,
      email: creator.email,
      name: creator.name ?? null,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(record);

  return toOpportunity({
    ...record,
    _id: result.insertedId,
  });
}

/**
 * GET /api/opportunities/mine
 *
 * Return events created by the authenticated user.
 */
export async function listMyOpportunities(
  userId: string,
  db?: Db,
): Promise<Opportunity[]> {
  const database = db ?? getDb();

  const docs = await database
    .collection<OpportunityDocument>(
      OPPORTUNITIES_COLLECTION,
    )
    .find({
      "createdBy.userId": userId,
    })
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .toArray();

  return docs.map((doc) => toOpportunity(doc));
}

/**
 * Build an ownership-restricted filter.
 *
 * The JWT userId is mandatory.
 * Another user's event will never match.
 */
function ownedOpportunityFilter(
  id: string,
  userId: string,
): Filter<OpportunityDocument> {
  return {
    $and: [
      opportunityIdentityFilter(id),
      { "createdBy.userId": userId },
    ],
  };
}

/**
 * PATCH /api/opportunities/:id
 *
 * Update only an event owned by the authenticated user.
 */
export async function updateOpportunity(
  id: string,
  userId: string,
  input: UpdateOpportunityBody,
  db?: Db,
): Promise<Opportunity> {
  const database = db ?? getDb();

  const collection =
    database.collection<OpportunityDocument>(
      OPPORTUNITIES_COLLECTION,
    );

  const filter = ownedOpportunityFilter(id, userId);

  const changes: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) {
    changes.title = input.title;
  }

  if (input.description !== undefined) {
    changes.description = input.description;
  }

  if (input.eventType !== undefined) {
    changes.category = input.eventType;
  }

  if (input.imageUrl !== undefined) {
    changes.imageUrl = input.imageUrl;
  }

  if (input.location !== undefined) {
    changes.location = input.location;
    changes.city = deriveCity(input.location);
  }

  if (input.eventDate !== undefined) {
    changes.eventDate = new Date(
      `${input.eventDate}T00:00:00Z`,
    ).toISOString();

    changes.schedule = formatSchedule(
      input.eventDate,
    );
  }

  const updated = await collection.findOneAndUpdate(
    filter,
    { $set: changes },
    { returnDocument: "after" },
  );

  if (!updated) {
    throw ApiError.notFound(
      "Event not found or access denied",
    );
  }

  return toOpportunity(updated);
}

/**
 * DELETE /api/opportunities/:id
 *
 * Delete only an event owned by the authenticated user.
 */
export async function deleteOpportunity(
  id: string,
  userId: string,
  db?: Db,
): Promise<void> {
  const database = db ?? getDb();

  const collection =
    database.collection<OpportunityDocument>(
      OPPORTUNITIES_COLLECTION,
    );

  const result = await collection.deleteOne(
    ownedOpportunityFilter(id, userId),
  );

  if (result.deletedCount === 0) {
    throw ApiError.notFound(
      "Event not found or access denied",
    );
  }
}

