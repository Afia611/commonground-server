
import dns from "dns";
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

const state: State = {
  client: null,
  status: "disconnected",
};

function looksLikeSrvDnsIssue(err: unknown): boolean {
  const message =
    err instanceof Error
      ? `${err.message} ${String(err.cause ?? "")}`
      : "";

  return /querySrv|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(message);
}

/**
 * Resolve Atlas SRV records with fallback DNS servers.
 */
async function resolveSrvWithFallback(
  host: string,
): Promise<Array<{ name: string; port: number }>> {
  const strategies: Array<string[] | null> = [
    null,
    ["8.8.8.8", "8.8.4.4"],
    ["1.1.1.1", "1.0.0.1"],
  ];

  let lastError: unknown = null;

  for (const servers of strategies) {
    const resolver = new dns.promises.Resolver();

    if (servers) {
      resolver.setServers(servers);
    }

    try {
      const records = await resolver.resolveSrv(
        `_mongodb._tcp.${host}`,
      );

      if (records.length > 0) {
        return records;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw (
    lastError ??
    new Error(`SRV lookup returned no records for ${host}`)
  );
}

/**
 * Resolve optional Atlas TXT records.
 */
async function resolveTxtWithFallback(
  host: string,
): Promise<string> {
  const strategies: Array<string[] | null> = [
    null,
    ["8.8.8.8", "8.8.4.4"],
    ["1.1.1.1", "1.0.0.1"],
  ];

  for (const servers of strategies) {
    const resolver = new dns.promises.Resolver();

    if (servers) {
      resolver.setServers(servers);
    }

    try {
      const records = await resolver.resolveTxt(host);

      if (records.length > 0) {
        return records.flat().join("");
      }
    } catch {
      // TXT records are optional.
    }
  }

  return "";
}

/**
 * Convert an Atlas mongodb+srv:// URI into an equivalent
 * mongodb:// URI when DNS SRV resolution fails.
 *
 * Credentials are never logged.
 */
export async function buildDirectUriFromSrv(
  uri: string,
): Promise<string | null> {
  if (!uri.startsWith("mongodb+srv://")) {
    return null;
  }

  try {
    const url = new URL(uri);

    const srvRecords = await resolveSrvWithFallback(
      url.hostname,
    );

    const hosts = srvRecords
      .map((record) => `${record.name}:${record.port}`)
      .join(",");

    if (!hosts) {
      return null;
    }

    const params = new URLSearchParams(url.search);

    const txt = await resolveTxtWithFallback(
      url.hostname,
    );

    for (const [key, value] of new URLSearchParams(txt)) {
      if (!params.has(key)) {
        params.set(key, value);
      }
    }

    if (!params.has("tls") && !params.has("ssl")) {
      params.set("tls", "true");
    }

    const auth = url.username
      ? `${url.username}${
          url.password ? `:${url.password}` : ""
        }@`
      : "";

    const pathname =
      url.pathname && url.pathname !== "/"
        ? url.pathname
        : "/";

    return `mongodb://${auth}${hosts}${pathname}?${params.toString()}`;
  } catch {
    return null;
  }
}

/**
 * Connect to MongoDB and verify the connection.
 */
async function attemptConnect(
  uri: string,
  dbName: string,
): Promise<Db> {
  const client = new MongoClient(uri, clientOptions);

  try {
    await client.connect();

    await client.db(dbName).command({
      ping: 1,
    });
  } catch (err) {
    try {
      await client.close();
    } catch {
      // Ignore errors when closing a failed connection.
    }

    throw err;
  }

  state.client = client;
  state.status = "connected";

  return client.db(dbName);
}

/**
 * Establish a shared MongoDB connection.
 *
 * Falls back to direct Atlas host resolution when
 * the network refuses SRV DNS lookups.
 */
export async function connectToDatabase(
  uri: string,
  dbName: string = DEFAULT_DB_NAME,
): Promise<Db> {
  if (state.client) {
    state.status = "connected";

    return state.client.db(dbName);
  }

  state.status = "connecting";

  try {
    return await attemptConnect(uri, dbName);
  } catch (err) {
    if (
      uri.startsWith("mongodb+srv://") &&
      looksLikeSrvDnsIssue(err)
    ) {
      const directUri = await buildDirectUriFromSrv(uri);

      if (directUri) {
        console.warn(
          "SRV lookup refused by DNS — retrying via publicly resolved cluster hosts...",
        );

        try {
          return await attemptConnect(
            directUri,
            dbName,
          );
        } catch {
          // Report the original SRV error.
        }
      }
    }

    state.status = "disconnected";

    throw err;
  }
}

/**
 * Return the shared database handle.
 */
export function getDb(
  dbName: string = DEFAULT_DB_NAME,
): Db {
  if (!state.client) {
    throw new Error(
      "MongoDB client is not connected. Call connectToDatabase() first.",
    );
  }

  return state.client.db(dbName);
}

/**
 * Return the existing shared MongoClient.
 *
 * Used by participation services for MongoDB
 * transactions and session management.
 */
export function getMongoClient(): MongoClient {
  if (!state.client) {
    throw new Error(
      "MongoDB client is not connected. Call connectToDatabase() first.",
    );
  }

  return state.client;
}

/**
 * Return the current database connection status.
 */
export function getDbStatus(): DbStatus {
  return state.status;
}

/**
 * Close the shared MongoDB connection.
 */
export async function closeDatabase(): Promise<void> {
  if (state.client) {
    const client = state.client;

    state.client = null;
    state.status = "disconnected";

    await client.close();
  }
}
