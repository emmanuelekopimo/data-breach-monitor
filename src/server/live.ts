import { hibpLookup, type LiveLookup } from "./scan";

/** Live HIBP lookups are used only when HIBP_API_KEY is configured. */
export function liveLookupFromEnv(env: Record<string, string | undefined> = process.env): LiveLookup | undefined {
  return env.HIBP_API_KEY ? hibpLookup(env.HIBP_API_KEY) : undefined;
}
