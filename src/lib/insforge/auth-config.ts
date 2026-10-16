import { cookies } from 'next/headers'
import { createServerClient } from '@insforge/sdk/ssr'
export async function getOAuthProviders():Promise<string[]>{try{const client=createServerClient({cookies:await cookies()});const {data}=await client.auth.getPublicAuthConfig();return data?.oAuthProviders??[]}catch{return[]}}
