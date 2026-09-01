import { z } from "zod";

/**
 * Server-side environment validation. Import `env` anywhere on the server to get
 * type-safe, validated access to configuration. Throws early at startup if a
 * required variable is missing.
 *
 * NOTE: This module must never be imported into client components — it reads
 * secrets. Anything the browser needs must go through a NEXT_PUBLIC_* var.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_SECRET: z.string().min(1).default("dev-insecure-secret"),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  // OmniDimension (optional when configured via super-admin platform_settings)
  OMNIDIM_API_KEY: z.string().optional().default(""),
  OMNIDIM_WEBHOOK_SECRET: z.string().optional().default(""),

  // Google Gemini (optional — menu/website extraction fallback)
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-3.6-flash"),

  // Cherry Voice native web agent
  DEEPGRAM_API_KEY: z.string().optional().default(""),
  INWORLD_API_KEY: z.string().optional().default(""),
  INWORLD_ROUTER_MODEL: z.string().optional().default("inworld/models/gemma-4-26b-a4b-it"),
  INWORLD_REALTIME_MODEL: z.string().optional().default("inworld/models/gemma-4-26b-a4b-it"),
  /** Native Cherry Voice transport: inworld_realtime (default) or legacy pipeline. */
  CHERRY_VOICE_MODE: z.enum(["inworld_realtime", "pipeline"]).optional().default("inworld_realtime"),
  CHERRY_VOICE_LLM_PROVIDER: z.enum(["gemini", "inworld"]).optional().default("inworld"),
  CHERRY_VOICE_GEMINI_MODEL: z.string().optional().default("gemini-3.5-flash-lite"),
  CHERRY_VOICE_STT_MODEL: z.string().optional().default("nova-3"),
  CHERRY_VOICE_TTS_MODEL: z.string().optional().default("inworld-tts-2-flash"),
  /** Optional edge proxy base URL for SSE events (see docs/CHERRY_VOICE_AGENT.md). */
  CHERRY_VOICE_SSE_EDGE_URL: z.string().url().optional().or(z.literal("")).default(""),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
