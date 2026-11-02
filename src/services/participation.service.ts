
import {
  ObjectId,
  type Document,
  type Filter,
  type WithId,
} from "mongodb";

import {
  getDb,
  getMongoClient,
} from "../config/db.js";

import { ApiError } from "../middleware/errorHandler.js";

import {
  OPPORTUNITIES_COLLECTION,
  toOpportunity,
} from "./opportunity.service.js";

import type { Opportunity } from "../types/opportunity.js";

const PARTICIPATIONS_COLLECTION = "participations";

interface ParticipationDocument {
  _id?: ObjectId;
  opportunityId: ObjectId;
  userId: string;
  joinedAt: Date;
}

/**
 * Find an opportunity by MongoDB ID or slug.
 */
function opportunityFilter(id: string): Filter<Document> {
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
 * Prevent duplicate registrations.
 * Call once during server startup.
 */
export async function ensureParticipationIndexes(): Promise<void> {
  await getDb()
    .collection<ParticipationDocument>(
      PARTICIPATIONS_COLLECTION,
    )
    .createIndex(
      { opportunityId: 1, userId: 1 },
      { unique: true },
    );
}

/**
 * Join an event.
 */
export async function joinOpportunity(
  id: string,
  userId: string,
): Promise<Opportunity> {
  const db = getDb();
  const client = getMongoClient();

  const opportunities = db.collection<Document>(
    OPPORTUNITIES_COLLECTION,
  );

  const participations =
    db.collection<ParticipationDocument>(
      PARTICIPATIONS_COLLECTION,
    );

  const session = client.startSession();

  try {
    let joinedOpportunity: Opportunity | null = null;

    await session.withTransaction(async () => {
      const opportunity = await opportunities.findOne(
        opportunityFilter(id),
        { session },
      );

      if (!opportunity?._id) {
        throw ApiError.notFound("Opportunity not found.");
      }

      const opportunityId = opportunity._id as ObjectId;

      const creator = opportunity.createdBy as
        | { userId?: string }
        | undefined;

      if (creator?.userId === userId) {
        throw new ApiError(
          403,
          "You cannot join an event you created.",
        );
      }

      // Prevent joining events that have already started or passed.
      // Event dates are stored as ISO strings at UTC midnight.
      const eventDate = opportunity.eventDate;

      if (
        typeof eventDate === "string" &&
        eventDate.slice(0, 10) <=
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
            .formatToParts(new Date())
            .reduce<Record<string, string>>((parts, part) => {
              if (
                part.type === "year" ||
                part.type === "month" ||
                part.type === "day"
              ) {
                parts[part.type] = part.value;
              }
              return parts;
            }, {})
            .year +
            "-" +
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Dhaka",
              month: "2-digit",
            }).format(new Date()) +
            "-" +
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Dhaka",
              day: "2-digit",
            }).format(new Date())
      ) {
        throw new ApiError(
          409,
          "You cannot join an event that has already started or passed.",
        );
      }

      const existing = await participations.findOne(
        { opportunityId, userId },
        { session },
      );

      if (existing) {
        throw new ApiError(
          409,
          "You have already joined this event.",
        );
      }

      const updated = await opportunities.findOneAndUpdate(
        {
          _id: opportunityId,
          spotsLeft: { $gt: 0 },
        },
        {
          $inc: { spotsLeft: -1 },
          $set: { updatedAt: new Date() },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updated) {
        throw new ApiError(
          409,
          "No available spots remaining.",
        );
      }

      await participations.insertOne(
        {
          opportunityId,
          userId,
          joinedAt: new Date(),
        },
        { session },
      );

      joinedOpportunity = toOpportunity(updated);
    });

    if (!joinedOpportunity) {
      throw new Error(
        "Unable to complete event registration.",
      );
    }

    return joinedOpportunity;
  } finally {
    await session.endSession();
  }
}

/**
 * Leave an event and restore one available spot.
 */
export async function leaveOpportunity(
  id: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  const client = getMongoClient();

  const opportunities = db.collection<Document>(
    OPPORTUNITIES_COLLECTION,
  );

  const participations =
    db.collection<ParticipationDocument>(
      PARTICIPATIONS_COLLECTION,
    );

  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const opportunity = await opportunities.findOne(
        opportunityFilter(id),
        { session },
      );

      if (!opportunity?._id) {
        throw ApiError.notFound("Opportunity not found.");
      }

      const opportunityId = opportunity._id as ObjectId;

      const deleted = await participations.deleteOne(
        { opportunityId, userId },
        { session },
      );

      if (deleted.deletedCount === 0) {
        throw ApiError.notFound(
          "You have not joined this event.",
        );
      }

      await opportunities.updateOne(
        { _id: opportunityId },
        {
          $inc: { spotsLeft: 1 },
          $set: { updatedAt: new Date() },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Return events joined by the authenticated user,
 * sorted by event date (earliest first).
 */
export async function listJoinedOpportunities(
  userId: string,
): Promise<Opportunity[]> {
  const db = getDb();

  const participations =
    db.collection<ParticipationDocument>(
      PARTICIPATIONS_COLLECTION,
    );

  const registrations = await participations
    .find({ userId })
    .toArray();

  if (registrations.length === 0) {
    return [];
  }

  const ids = registrations.map(
    (registration) => registration.opportunityId,
  );

  const opportunities = await db
    .collection<Document>(OPPORTUNITIES_COLLECTION)
    .find({
      _id: { $in: ids },
    })
    .toArray();

  const joinedOpportunities = opportunities
    .map((opportunity) => toOpportunity(opportunity))
    .sort((a, b) => {
      const dateA = a.eventDate
        ? new Date(a.eventDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      const dateB = b.eventDate
        ? new Date(b.eventDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      return dateA - dateB;
    });

  return joinedOpportunities;
}
