import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().default('file:./dev.db'),
  CORS_ORIGIN: z.string().default('*'),

  // OpenClaw gateway connection (placeholder for v0)
  OPENCLAW_GATEWAY_URL: z.string().optional(),
  OPENCLAW_GATEWAY_TOKEN: z.string().optional(),

  // Telegram destination for War Room final answer (configurable later in UI)
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_TOPIC_ID: z.string().optional()
});

export const env = EnvSchema.parse(process.env);
