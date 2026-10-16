import { createAdminClient } from '@insforge/sdk'

/**
 * Admin client for server-side ingestion.
 *
 * The market tables are shared public data with no write policy: reads are open
 * to any signed-in user, writes are impossible for an end user. This client
 * bypasses RLS with the project admin key, so it must never be imported into a
 * component, a client bundle, or anything reachable from the browser.
 *
 * Returns null when the key is absent rather than throwing, so a missing key
 * degrades to "ingestion unavailable" instead of breaking page rendering.
 */
export function getInsForgeAdminClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) return null
  return createAdminClient({ baseUrl, apiKey })
}
