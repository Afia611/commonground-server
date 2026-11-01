import dotenv from "dotenv";
import { z } from "zod";

// Load variables from `.env` (if present) before reading process.env.
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .default("mongodb://127.0.0.1:27017"),
  DB_NAME: z.string().min(1).default("commonground"),
  /** Comma-separated list of allowed frontend origins. */
  CLIENT_URL: z
    .string()
    .min(1)
    .default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16).default("dev_only_jwt_secret_change_me"),
  /**
   * Origin of the BetterAuth-enabled frontend whose /api/auth/jwks endpoint
   * issues the JWKS used to verify incoming Bearer JWTs.
   */
  BETTER_AUTH_URL: z.string().min(1).default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message, but never print the raw values.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  port: raw.PORT,
  mongoUri: raw.MONGODB_URI,
  dbName: raw.DB_NAME,
  /** Extra origins beyond the local default (e.g. the deployed Vercel frontend). */
  clientUrls: raw.CLIENT_URL.split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  jwtSecret: raw.JWT_SECRET,
  betterAuthUrl: raw.BETTER_AUTH_URL,
} as const;

export type Env = typeof env;
