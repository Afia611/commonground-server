import type { Db } from "mongodb";
import { ObjectId, OptionalId } from "mongodb";
import { getDb } from "../config/db.js";
import type { Opportunity } from "../types/opportunity.js";
import { ApiError } from "../middleware/errorHandler.js";

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

function toOpportunity(doc: OptionalId<Record<string, unknown>>): Opportunity {
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
