import { getInsForgeServerClient } from '@/lib/insforge/server'

export type Screenshot = {
  id: string
  trade_id: string
  storage_key: string
  storage_url: string | null
  file_name: string | null
  mime_type: string | null
  byte_size: number | null
  caption: string | null
  created_at: string
}

const COLUMNS = 'id,trade_id,storage_key,storage_url,file_name,mime_type,byte_size,caption,created_at'

/** Metadata rows for a trade's screenshots. RLS scopes rows to the signed-in user. */
export async function listScreenshots(tradeId: string): Promise<Screenshot[]> {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return []

  const { data, error } = await client.database
    .from('trade_screenshots')
    .select(COLUMNS)
    .eq('trade_id', tradeId)
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as unknown as Screenshot[]
}
