'use client'

import { createBrowserClient } from '@insforge/sdk/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

export function getInsForgeBrowserClient() {
  client ??= createBrowserClient()
  return client
}
