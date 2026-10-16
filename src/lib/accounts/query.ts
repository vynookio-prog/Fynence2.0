import { getInsForgeServerClient } from '@/lib/insforge/server'

export type Account = {
  id: string
  name: string
  account_type: 'journal' | 'demo' | 'manual'
  base_currency: string
  initial_balance: string | null
  notes: string | null
  created_at: string
}

const COLUMNS = 'id,name,account_type,base_currency,initial_balance,notes,created_at'

export async function listAccounts(): Promise<Account[]> {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return []

  const { data, error } = await client.database
    .from('trading_accounts')
    .select(COLUMNS)
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: true })

  if (error) return []
  return (data ?? []) as unknown as Account[]
}

/** Trade counts per account, used to block deleting a populated account in the UI. */
export async function accountTradeCounts(): Promise<Record<string, number>> {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return {}

  const { data, error } = await client.database
    .from('trades')
    .select('account_id')
    .eq('user_id', userData.user.id)

  if (error) return {}
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { account_id: string | null }[]) {
    if (row.account_id) counts[row.account_id] = (counts[row.account_id] ?? 0) + 1
  }
  return counts
}
