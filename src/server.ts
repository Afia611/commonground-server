import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase, connectToDatabase, getDbStatus } from "./config/db.js";
import type { Server } from "http";
import dns from "node:dns";

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

let httpServer: Server | null = null;
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  const app = createApp();

  // Start listening first so /api/health reflects DB state even while
  // the connection is still being established or has failed.
  httpServer = app.listen(env.port, () => {
    // Never log secrets: only the port.
    // eslint-disable-next-line no-console
    console.log(`CommonGround server listening on port ${env.port} (${env.nodeEnv})`);
  });

  try {
    await connectToDatabase(env.mongoUri, env.dbName);
    // eslint-disable-next-line no-console
    console.log(`Connected to MongoDB database "${env.dbName}"`);
  } catch (err) {
    // Do not crash: /api/health reports the disconnected state.
    // eslint-disable-next-line no-console
    console.error("Failed to connect to MongoDB. Retrying on next restart.", err);
  }
}

/** Graceful shutdown: stop accepting connections, close MongoDB, then exit. */
async function shutdown(signal: string, exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error("Forcing exit after shutdown timeout.");
    process.exit(exitCode);
  }, 10_000);

  try {
    if (httpServer?.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await closeDatabase();
    // eslint-disable-next-line no-console
    console.log(`Shutdown complete (db status: ${getDbStatus()}).`);
    clearTimeout(forceExit);
    process.exit(exitCode);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error during shutdown:", err);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM", 0));
process.on("SIGINT", () => void shutdown("SIGINT", 0));
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", reason);
});

void bootstrap();
