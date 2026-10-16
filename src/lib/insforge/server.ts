import { cookies } from 'next/headers'
import { createServerClient } from '@insforge/sdk/ssr'
export async function getInsForgeServerClient() { return createServerClient({ cookies: await cookies() }) }
