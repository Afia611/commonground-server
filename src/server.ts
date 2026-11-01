
import { createApp } from "./app.js";
import { env } from "./config/env.js";

import {
  closeDatabase,
  connectToDatabase,
  getDbStatus,
} from "./config/db.js";

import {
  ensureParticipationIndexes,
} from "./services/participation.service.js";

import type { Server } from "http";
import dns from "node:dns";

// Use public DNS during local development.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

let httpServer: Server | null = null;
let shuttingDown = false;

/**
 * Start the CommonGround backend.
 */
async function bootstrap(): Promise<void> {
  const app = createApp();

  // Start listening first so /api/health can report
  // database status during connection attempts.
  httpServer = app.listen(env.port, () => {
    console.log(
      `CommonGround server listening on port ${env.port} (${env.nodeEnv})`,
    );
  });

  try {
    // Connect to MongoDB.
    await connectToDatabase(
      env.mongoUri,
      env.dbName,
    );

    console.log(
      `Connected to MongoDB database "${env.dbName}"`,
    );

    // Create the unique participation index.
    // Prevents duplicate registrations for the same event.
    await ensureParticipationIndexes();

    console.log(
      "Participation indexes initialized successfully.",
    );
  } catch (err) {
    // Preserve the health endpoint if MongoDB is unavailable.
    console.error(
      "Database connection or initialization failed.",
      err,
    );
  }
}

/**
 * Gracefully shut down the HTTP server and MongoDB.
 */
async function shutdown(
  signal: string,
  exitCode: number,
): Promise<void> {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(
    `\n${signal} received — shutting down gracefully...`,
  );

  const forceExit = setTimeout(() => {
    console.error(
      "Forcing exit after shutdown timeout.",
    );

    process.exit(exitCode);
  }, 10_000);

  try {
    if (httpServer?.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) =>
          err ? reject(err) : resolve(),
        );
      });
    }

    await closeDatabase();

    console.log(
      `Shutdown complete (db status: ${getDbStatus()}).`,
    );

    clearTimeout(forceExit);
    process.exit(exitCode);
  } catch (err) {
    console.error(
      "Error during shutdown:",
      err,
    );

    clearTimeout(forceExit);
    process.exit(1);
  }
}

// Graceful shutdown handlers.
process.on("SIGTERM", () => {
  void shutdown("SIGTERM", 0);
});

process.on("SIGINT", () => {
  void shutdown("SIGINT", 0);
});

// Log unhandled promise rejections.
process.on("unhandledRejection", (reason) => {
  console.error(
    "Unhandled promise rejection:",
    reason,
  );
});

// Start the application.
void bootstrap();
