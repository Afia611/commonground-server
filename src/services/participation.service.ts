
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
        throw ApiError.notFound(
          "Opportunity not found.",
        );
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
 * Return events joined by the authenticated user.
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
    .sort({ joinedAt: -1 })
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

  const opportunityMap = new Map<
    string,
    WithId<Document>
  >(
    opportunities.map((opportunity) => [
      opportunity._id.toHexString(),
      opportunity,
    ]),
  );

  const joinedOpportunities: Opportunity[] = [];

  for (const registration of registrations) {
    const opportunity = opportunityMap.get(
      registration.opportunityId.toHexString(),
    );

    if (opportunity) {
      joinedOpportunities.push(
        toOpportunity(opportunity),
      );
    }
  }

  return joinedOpportunities;
}
