
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";

import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";

/**
 * Build the list of allowed CORS origins:
 * - Configured frontend URLs (including Vercel)
 * - Local Next.js development URLs
 */
export function buildAllowedOrigins(): string[] {
  const defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  return [...new Set([...env.clientUrls, ...defaults])];
}

export function createApp(): Express {
  const app = express();

  const allowedOrigins = buildAllowedOrigins();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },

      methods: [
        "GET",
        "POST",
        "PATCH",
        "PUT",
        "DELETE",
        "OPTIONS",
      ],

      allowedHeaders: [
        "Content-Type",
        "Authorization",
      ],

      credentials: false,

      maxAge: 86_400,
    }),
  );

  // Parse JSON request bodies
  app.use(express.json({ limit: "100kb" }));

  // API routes
  app.use("/api", routes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
