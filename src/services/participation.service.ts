
import {
  ObjectId,
  type Document,
  type Filter,
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
 * Get today's date in Bangladesh.
 * Returns YYYY-MM-DD.
 */
function getTodayInBangladesh(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;

  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Unable to determine Bangladesh date.",
    );
  }

  return `${year}-${month}-${day}`;
}

/**
 * Safely convert an event date to a timestamp.
 * Invalid or missing dates are sorted last.
 */
function getEventTimestamp(value: unknown): number {
  if (value instanceof Date) {
    const timestamp = value.getTime();

    return Number.isFinite(timestamp)
      ? timestamp
      : Number.MAX_SAFE_INTEGER;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);

    return Number.isFinite(timestamp)
      ? timestamp
      : Number.MAX_SAFE_INTEGER;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : Number.MAX_SAFE_INTEGER;
  }

  return Number.MAX_SAFE_INTEGER;
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
        throw ApiError.notFound(
          "Opportunity not found.",
        );
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

      /**
       * Prevent joining events that have
       * already started or passed.
       *
       * Event dates are stored as ISO strings.
       */
      const eventDate: unknown = opportunity.eventDate;

      if (
        typeof eventDate === "string" &&
        eventDate.slice(0, 10) <= getTodayInBangladesh()
      ) {
        throw new ApiError(
          409,
          "You cannot join an event that has already started or passed.",
        );
      }

      /**
       * Prevent duplicate participation.
       */
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

      /**
       * Reduce available spots by one.
       */
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

      /**
       * Save participation record.
       */
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
 * Leave an event and restore
 * one available spot.
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
        throw ApiError.notFound(
          "Opportunity not found.",
        );
      }

      const opportunityId = opportunity._id as ObjectId;

      /**
       * Delete user's participation.
       */
      const deleted = await participations.deleteOne(
        { opportunityId, userId },
        { session },
      );

      if (deleted.deletedCount === 0) {
        throw ApiError.notFound(
          "You have not joined this event.",
        );
      }

      /**
       * Restore one available spot.
       */
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
      const dateA = getEventTimestamp(a.eventDate);
      const dateB = getEventTimestamp(b.eventDate);

      return dateA - dateB;
    });

  return joinedOpportunities;
}
