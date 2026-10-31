import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

export type DbStatus = "connected" | "connecting" | "disconnected";

const DEFAULT_DB_NAME = "commonground";

const clientOptions: MongoClientOptions = {
  // Fail reasonably fast instead of hanging the whole server.
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
};

interface State {
  client: MongoClient | null;
  status: DbStatus;
}

const state: State = { client: null, status: "disconnected" };

/**
 * Connect to MongoDB using the native driver with node-process friendly defaults.
 * A single shared client is reused across the app lifetime.
 */
export async function connectToDatabase(uri: string, dbName: string = DEFAULT_DB_NAME): Promise<Db> {
  if (state.client) {
    state.status = "connected";
    return state.client.db(dbName);
  }

  state.status = "connecting";
  const client = new MongoClient(uri, clientOptions);

  try {
    // Ping during connect so a wrong string/hostname surfaces immediately.
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
  } catch (err) {
    state.status = "disconnected";
    // Never leave a half-open client around after a failed attempt.
    try {
      await client.close();
    } catch {
      // ignore close errors from a client that never connected
    }
    throw err;
  }

  state.client = client;
  state.status = "connected";
  return client.db(dbName);
}

/** Get a handle to the database; throws if called before connectToDatabase. */
export function getDb(dbName: string = DEFAULT_DB_NAME): Db {
  if (!state.client) {
    throw new Error("MongoDB client is not connected. Call connectToDatabase() first.");
  }
  return state.client.db(dbName);
}

export function getDbStatus(): DbStatus {
  return state.status;
}

/** Close the shared client so the node event loop can drain and exit cleanly. */
export async function closeDatabase(): Promise<void> {
  if (state.client) {
    const client = state.client;
    state.client = null;
    state.status = "disconnected";
    await client.close();
  }
}
