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

const state: State = { client: null, status: "disconnected" };

function looksLikeSrvDnsIssue(err: unknown): boolean {
  // querySrv ECONNREFUSED / ETIMEDOUT: the network's DNS refuses or drops
  // SRV lookups, which mongodb+srv:// uris rely on.
  const message = err instanceof Error ? `${err.message} ${String(err.cause ?? "")}` : "";
  return /querySrv|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(message);
}

/**
 * Atlas SRV setup records live under `_mongodb._tcp.<cluster-host>` and the
 * connection options live in a TXT record on the cluster host itself.
 */
async function resolveSrvWithFallback(host: string): Promise<Array<{ name: string; port: number }>> {
  // The OS resolver sometimes refuses SRV lookups; retry explicitly against
  // public DNS (Google, then Cloudflare). Contains no credentials.
  const strategies: Array<string[] | null> = [null, ["8.8.8.8", "8.8.4.4"], ["1.1.1.1", "1.0.0.1"]];
  let lastError: unknown = null;

  for (const servers of strategies) {
    const resolver = new dns.promises.Resolver();
    if (servers) resolver.setServers(servers);
    try {
      const records = await resolver.resolveSrv(`_mongodb._tcp.${host}`);
      if (records.length > 0) return records;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`SRV lookup returned no records for ${host}`);
}

async function resolveTxtWithFallback(host: string): Promise<string> {
  const strategies: Array<string[] | null> = [null, ["8.8.8.8", "8.8.4.4"], ["1.1.1.1", "1.0.0.1"]];
  for (const servers of strategies) {
    const resolver = new dns.promises.Resolver();
    if (servers) resolver.setServers(servers);
    try {
      const records = await resolver.resolveTxt(host);
      if (records.length > 0) return records.flat().join("");
    } catch {
      // TXT records are optional for the connection string.
    }
  }
  return "";
}

/**
 * Convert an Atlas mongodb+srv:// uri into an equivalent direct `mongodb://`
 * uri by resolving the cluster's SRV/TXT records ourselves (via public DNS
 * when the OS resolver refuses SRV). Credentials are carried through
 * internally and never logged or echoed.
 */
export async function buildDirectUriFromSrv(uri: string): Promise<string | null> {
  if (!uri.startsWith("mongodb+srv://")) return null;
  try {
    const url = new URL(uri);
    const srvRecords = await resolveSrvWithFallback(url.hostname);
    const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(",");
    if (!hosts) return null;

    const params = new URLSearchParams(url.search);
    const txt = await resolveTxtWithFallback(url.hostname);
    for (const [key, value] of new URLSearchParams(txt)) {
      if (!params.has(key)) params.set(key, value);
    }
    if (!params.has("tls") && !params.has("ssl")) params.set("tls", "true");

    const auth = url.username ? `${url.username}${url.password ? `:${url.password}` : ""}@` : "";
    const pathname = url.pathname && url.pathname !== "/" ? url.pathname : "/";
    return `mongodb://${auth}${hosts}${pathname}?${params.toString()}`;
  } catch {
    return null;
  }
}

async function attemptConnect(uri: string, dbName: string): Promise<Db> {
  const client = new MongoClient(uri, clientOptions);
  try {
    // Ping during connect so a wrong string/hostname surfaces immediately.
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
  } catch (err) {
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

/**
 * Connect to MongoDB using the native driver with node-process friendly defaults.
 * A single shared client is reused across the app lifetime.
 *
 * If the network refuses SRV record lookups (needed for mongodb+srv:// uris),
 * the lookup is retried through public DNS and the connection is re-attempted
 * with an equivalent directly resolved connection string — no config change needed.
 */
export async function connectToDatabase(uri: string, dbName: string = DEFAULT_DB_NAME): Promise<Db> {
  if (state.client) {
    state.status = "connected";
    return state.client.db(dbName);
  }

  state.status = "connecting";
  try {
    return await attemptConnect(uri, dbName);
  } catch (err) {
    if (uri.startsWith("mongodb+srv://") && looksLikeSrvDnsIssue(err)) {
      const directUri = await buildDirectUriFromSrv(uri);
      if (directUri) {
        // Log the problem, never the uri or credentials.
        console.warn("SRV lookup refused by DNS — retrying via publicly resolved cluster hosts...");
        try {
          return await attemptConnect(directUri, dbName);
        } catch {
          // fall through and report the original SRV error
        }
      }
    }
    state.status = "disconnected";
    throw err;
  }
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
