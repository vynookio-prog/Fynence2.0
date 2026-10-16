import Decimal from 'decimal.js'
import { realizedNetPnl, type Trade } from './trades'

/**
 * Planned reward-to-risk from the prices the user recorded.
 * Returns null unless entry, stop, and target are all present and the stop sits
 * on the correct side of entry. Never inferred from P&L, size, or a multiplier.
 */
export function plannedRR(trade: Trade): Decimal | null {
  const entry = trade.entryPrice
  const stop = trade.stopLoss
  const target = trade.takeProfit
  if (entry == null || stop == null || target == null) return null

  const e = new Decimal(entry)
  const s = new Decimal(stop)
  const t = new Decimal(target)
  const risk = e.minus(s).abs()
  if (risk.isZero()) return null
  return t.minus(e).abs().div(risk).toDecimalPlaces(2)
}

/**
 * Realized R multiple = recorded net result divided by the recorded risk amount.
 *
 * R is only produced when the user recorded a risk amount. Falling back to
 * (entry - stop) * size would require a contract multiplier and a currency
 * assumption, so it is deliberately not done.
 */
export function realizedR(trade: Trade): Decimal | null {
  if (trade.riskAmount == null) return null
  const risk = new Decimal(trade.riskAmount)
  if (risk.lte(0)) return null
  const net = realizedNetPnl(trade)
  if (net === null) return null
  return net.div(risk).toDecimalPlaces(2)
}

export type RiskSummary = {
  /** Closed trades that carry a recorded risk amount. */
  withRisk: number
  /** Closed trades with a recorded result but no risk amount. */
  missingRisk: number
  /** Sum of recorded risk amounts across closed trades. */
  totalRisk: string | null
  /** Mean R across trades that have one. */
  averageR: string | null
  /** Best and worst R, by value. */
  bestR: string | null
  worstR: string | null
  /** Share of trades that finished at or above break-even, in R terms. */
  positiveRShare: number | null
}

export function summarizeRisk(trades: Trade[]): RiskSummary {
  const closed = trades.filter(t => t.status === 'closed' && realizedNetPnl(t) !== null)
  const withRiskAmount = closed.filter(t => t.riskAmount != null && new Decimal(t.riskAmount).gt(0))

  const rs = withRiskAmount
    .map(t => realizedR(t))
    .filter((r): r is Decimal => r !== null)

  if (!rs.length) {
    return {
      withRisk: withRiskAmount.length,
      missingRisk: closed.length - withRiskAmount.length,
      totalRisk: null,
      averageR: null,
      bestR: null,
      worstR: null,
      positiveRShare: null,
    }
  }

  const totalRisk = withRiskAmount.reduce((sum, t) => sum.plus(new Decimal(t.riskAmount as string)), new Decimal(0))
  const sum = rs.reduce((acc, r) => acc.plus(r), new Decimal(0))
  const sorted = [...rs].sort((a, b) => a.cmp(b))
  const positive = rs.filter(r => r.gte(0)).length

  return {
    withRisk: withRiskAmount.length,
    missingRisk: closed.length - withRiskAmount.length,
    totalRisk: totalRisk.toFixed(2),
    averageR: sum.div(rs.length).toFixed(2),
    bestR: sorted[sorted.length - 1].toFixed(2),
    worstR: sorted[0].toFixed(2),
    positiveRShare: new Decimal(positive).div(rs.length).mul(100).toDecimalPlaces(1).toNumber(),
  }
}

/** Groups realized R by a trade field, for the analytics breakdowns. */
export function rByGroup(trades: Trade[], keyOf: (t: Trade) => string | null) {
  const groups = new Map<string, Decimal[]>()
  for (const t of trades) {
    const r = realizedR(t)
    if (r === null) continue
    const key = keyOf(t) ?? 'Tidak dicatat'
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      trades: list.length,
      averageR: list.reduce((s, r) => s.plus(r), new Decimal(0)).div(list.length).toFixed(2),
    }))
    .sort((a, b) => new Decimal(b.averageR).cmp(new Decimal(a.averageR)))
}
