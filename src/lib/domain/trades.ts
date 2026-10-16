import Decimal from 'decimal.js'

export type TradeStatus = 'open' | 'closed'
export type Direction = 'long' | 'short'

export type Trade = {
  id: string
  symbol: string
  direction: Direction
  status: TradeStatus
  openedAt: string
  closedAt?: string | null
  entryPrice: string
  exitPrice?: string | null
  size: string
  fees: string
  realizedPnl?: string | null
  setup?: string | null
  timeframe?: string | null
  notes?: string | null
  exitReason?: string | null
  setupGrade?: number | null
  executionQuality?: number | null
  planAdherence?: boolean | null
  emotion?: string | null
}

/**
 * Net result = manually recorded realized P&L minus recorded fees.
 * Never derived from price movement, lot size, or contract multiplier.
 */
export function realizedNetPnl(trade: Trade): Decimal | null {
  if (trade.status !== 'closed' || trade.realizedPnl == null) return null
  return new Decimal(trade.realizedPnl).minus(trade.fees || '0')
}

/** Whether a closed trade carries the fields needed to count as a realized result. */
export function isCompleteClosedTrade(trade: Trade): boolean {
  if (trade.status !== 'closed') return true
  return Boolean(trade.closedAt) && trade.exitPrice != null && trade.realizedPnl != null
}

export {
  byMonth,
  bySetup,
  bySymbol,
  byTimeframe,
  byWeekday,
  calculateAnalytics,
  closedWithResult,
} from './analytics'
export type { Analytics, Breakdown, EquityPoint } from './analytics'
