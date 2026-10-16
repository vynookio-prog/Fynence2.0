import { getInsForgeServerClient } from '@/lib/insforge/server'

export type TradeRow = {
  id: string
  symbol: string
  direction: 'long' | 'short'
  status: 'open' | 'closed'
  account_id: string | null
  opened_at: string
  closed_at: string | null
  entry_price: string
  exit_price: string | null
  size: string
  fees: string
  realized_pnl: string | null
  risk_amount: string | null
  stop_loss: string | null
  take_profit: string | null
  setup: string | null
  timeframe: string | null
  exit_reason: string | null
  notes: string | null
  setup_grade: number | null
  execution_quality: number | null
  plan_adherence: boolean | null
  emotion: string | null
}

const COLUMNS =
  'id,symbol,direction,status,account_id,opened_at,closed_at,entry_price,exit_price,size,fees,realized_pnl,risk_amount,stop_loss,take_profit,setup,timeframe,exit_reason,notes,setup_grade,execution_quality,plan_adherence,emotion'

/**
 * Reads a single trade for the signed-in user. RLS scopes rows to the owner;
 * the explicit user_id filter keeps the intent obvious in this layer.
 */
export async function getTrade(id: string): Promise<TradeRow | null> {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return null

  const { data, error } = await client.database
    .from('trades')
    .select(COLUMNS)
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .limit(1)

  if (error || !data?.length) return null
  return data[0] as unknown as TradeRow
}

/** Renders a stored timestamp as a value accepted by <input type="datetime-local">. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
