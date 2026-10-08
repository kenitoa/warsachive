import type { AdapterEnvironment, Adapters } from "./adapters/contracts.ts";
import { createStripeAdapter } from "./adapters/stripe.ts";
import { createAiAdapter } from "./adapters/ai.ts";
import { createNotificationAdapter } from "./adapters/notification.ts";
export function createRuntimeAdapters(env: AdapterEnvironment = process.env): Adapters {
  return { payments: createStripeAdapter(env), ai: createAiAdapter(env), notifications: createNotificationAdapter(env) };
}
