import { getInsForgeServerClient } from '@/lib/insforge/server'
import type { Trade } from '@/lib/domain/trades'

/**
 * Loading trades with the currency of the account they belong to.
 *
 * A trade row carries no currency of its own; the money values it holds are
 * denominated in its account's base currency. That link has to be resolved
 * wherever trades are read, and doing it per page is how one page quietly ends
 * up adding dollars to rupiah.
 *
 * A trade with no account, or an account with no currency, gets a null currency
 * rather than a guess. 'USD' would be right most of the time, which is exactly
 * what makes it dangerous: the exceptions would be invisible.
 */

export const TRADE_COLUMNS =
  'id,symbol,direction,status,opened_at,closed_at,entry_price,exit_price,size,fees,realized_pnl,risk_amount,stop_loss,take_profit,setup,timeframe,notes,exit_reason,account_id'

export type AccountCurrencyMap = Map<string, string>

/** Account id -> its base currency, for the signed-in user. */
export async function loadAccountCurrencies(): Promise<{ map: AccountCurrencyMap; error: string | null }> {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return { map: new Map(), error: null }

  const { data, error } = await client.database
    .from('trading_accounts')
    .select('id,base_currency')
    .eq('user_id', userData.user.id)

  if (error) return { map: new Map(), error: error.message }

  const map: AccountCurrencyMap = new Map()
  for (const row of (data ?? []) as { id: string; base_currency: string }[]) {
    map.set(row.id, row.base_currency)
  }
  return { map, error: null }
}

/** Maps a raw trades row onto the domain shape, attaching its currency. */
export function toTrade(row: Record<string, unknown>, currencies: AccountCurrencyMap): Trade {
  const accountId = row.account_id == null ? null : String(row.account_id)

  return {
    id: String(row.id),
    symbol: String(row.symbol),
    direction: row.direction as Trade['direction'],
    status: row.status as Trade['status'],
    openedAt: String(row.opened_at),
    closedAt: row.closed_at == null ? null : String(row.closed_at),
    // Unknown when the trade has no account, or the account has no currency.
    // Never defaulted.
    currency: accountId ? currencies.get(accountId) ?? null : null,
    entryPrice: String(row.entry_price),
    exitPrice: row.exit_price == null ? null : String(row.exit_price),
    size: String(row.size),
    fees: String(row.fees),
    realizedPnl: row.realized_pnl == null ? null : String(row.realized_pnl),
    riskAmount: row.risk_amount == null ? null : String(row.risk_amount),
    stopLoss: row.stop_loss == null ? null : String(row.stop_loss),
    takeProfit: row.take_profit == null ? null : String(row.take_profit),
    setup: row.setup as string | null,
    timeframe: row.timeframe as string | null,
    notes: row.notes as string | null,
    exitReason: row.exit_reason as string | null,
  }
}

export type TradesLoad = {
  trades: Trade[]
  currencies: AccountCurrencyMap
  error: string | null
}

/**
 * Loads the signed-in user's trades with their currencies resolved.
 *
 * Trades are fetched first because that is the expensive query; the small
 * account lookup runs alongside it. A currency-lookup failure does not fail the
 * page — trades still load, each one simply reporting an unknown currency, and
 * totals then refuse to combine across them rather than guessing.
 */
export async function loadTradesWithCurrency(limit = 1000): Promise<TradesLoad> {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return { trades: [], currencies: new Map(), error: null }

  const [tradesResult, accountResult] = await Promise.all([
    client.database
      .from('trades')
      .select(TRADE_COLUMNS)
      .eq('user_id', userData.user.id)
      .order('opened_at', { ascending: false })
      .limit(limit),
    loadAccountCurrencies(),
  ])

  if (tradesResult.error) {
    return { trades: [], currencies: accountResult.map, error: tradesResult.error.message }
  }

  const currencies = accountResult.map
  const trades = ((tradesResult.data ?? []) as Record<string, unknown>[]).map(row => toTrade(row, currencies))

  return { trades, currencies, error: accountResult.error }
}
