import Decimal from 'decimal.js'
import { realizedNetPnl, type Trade } from './trades'

export type Breakdown = { key: string; trades: number; netPnl: string; winRate: number | null }
export type EquityPoint = { index: number; date: string; equity: number; drawdown: number }

export type Analytics = {
  closedCount: number
  openCount: number
  incompleteClosedCount: number
  netPnl: string
  grossWin: string
  grossLoss: string
  winRate: number | null
  profitFactor: number | null
  averageWin: string | null
  averageLoss: string | null
  expectancy: string | null
  largestWin: string | null
  largestLoss: string | null
  breakEvenCount: number
  maxDrawdown: number | null
  series: EquityPoint[]
}

/** Closed trades with a manually recorded result, oldest first. */
export function closedWithResult(trades: Trade[]) {
  return trades
    .filter(t => t.status === 'closed' && realizedNetPnl(t) !== null)
    .sort((a, b) => new Date(a.closedAt ?? a.openedAt).valueOf() - new Date(b.closedAt ?? b.openedAt).valueOf())
    .map(t => ({ trade: t, pnl: realizedNetPnl(t) as Decimal }))
}

/**
 * Currency situation across a set of trades.
 *
 * This exists because summing money across mismatched currencies produces a
 * number that looks fine and is meaningless. $100 and Rp100 recorded the same
 * way add up to "200" — the arithmetic succeeds, the answer is nonsense, and
 * nothing in the UI would hint at it. So the mismatch is detected and stated
 * rather than averaged away.
 */
export type CurrencyComposition = {
  /** Every distinct currency present, sorted. */
  currencies: string[]
  /** True when every trade carries the same, known currency. */
  uniform: boolean
  /** Trades with no currency recorded at all. */
  unknownCount: number
  /** Trades sharing one currency, when uniform. */
  currency: string | null
}

export function currencyComposition(trades: Trade[]): CurrencyComposition {
  const seen = new Set<string>()
  let unknownCount = 0

  for (const trade of trades) {
    const code = trade.currency?.trim().toUpperCase()
    if (!code) unknownCount += 1
    else seen.add(code)
  }

  const currencies = [...seen].sort()
  const uniform = currencies.length === 1 && unknownCount === 0

  return {
    currencies,
    uniform,
    unknownCount,
    currency: uniform ? currencies[0] : null,
  }
}

export function calculateAnalytics(trades: Trade[]): Analytics {
  const closed = closedWithResult(trades)
  const wins = closed.filter(x => x.pnl.gt(0))
  const losses = closed.filter(x => x.pnl.lt(0))
  const breakEven = closed.filter(x => x.pnl.eq(0))

  const net = closed.reduce((s, x) => s.plus(x.pnl), new Decimal(0))
  const grossWin = wins.reduce((s, x) => s.plus(x.pnl), new Decimal(0))
  const grossLoss = losses.reduce((s, x) => s.plus(x.pnl.abs()), new Decimal(0))

  // Equity curve and drawdown are built from the running sum of recorded net results.
  let running = new Decimal(0)
  let peak = new Decimal(0)
  let maxDrawdown = new Decimal(0)
  const series: EquityPoint[] = closed.map(({ trade, pnl }, index) => {
    running = running.plus(pnl)
    if (running.gt(peak)) peak = running
    const drawdown = peak.eq(0) ? new Decimal(0) : peak.minus(running)
    if (drawdown.gt(maxDrawdown)) maxDrawdown = drawdown
    return {
      index: index + 1,
      date: (trade.closedAt ?? trade.openedAt).slice(0, 10),
      equity: running.toNumber(),
      drawdown: drawdown.toNumber(),
    }
  })

  const largest = (list: typeof closed) =>
    list.length ? list.reduce((a, b) => (b.pnl.abs().gt(a.pnl.abs()) ? b : a)).pnl : null

  return {
    closedCount: closed.length,
    openCount: trades.filter(t => t.status === 'open').length,
    incompleteClosedCount: trades.filter(t => t.status === 'closed' && realizedNetPnl(t) === null).length,
    netPnl: net.toFixed(2),
    grossWin: grossWin.toFixed(2),
    grossLoss: grossLoss.toFixed(2),
    winRate: closed.length ? new Decimal(wins.length).div(closed.length).mul(100).toDecimalPlaces(1).toNumber() : null,
    profitFactor: grossLoss.eq(0) ? null : grossWin.div(grossLoss).toDecimalPlaces(2).toNumber(),
    averageWin: wins.length ? grossWin.div(wins.length).toFixed(2) : null,
    averageLoss: losses.length ? grossLoss.div(losses.length).neg().toFixed(2) : null,
    expectancy: closed.length ? net.div(closed.length).toFixed(2) : null,
    largestWin: largest(wins)?.toFixed(2) ?? null,
    largestLoss: largest(losses)?.toFixed(2) ?? null,
    breakEvenCount: breakEven.length,
    maxDrawdown: closed.length ? maxDrawdown.toDecimalPlaces(2).toNumber() : null,
    series,
  }
}

function groupBy(trades: Trade[], keyOf: (t: Trade) => string | null): Breakdown[] {
  const groups = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = keyOf(t) ?? 'Tidak dicatat'
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const a = calculateAnalytics(group)
      return { key, trades: group.length, netPnl: a.netPnl, winRate: a.winRate }
    })
    .sort((a, b) => new Decimal(b.netPnl).cmp(new Decimal(a.netPnl)))
}

export const bySymbol = (trades: Trade[]) => groupBy(trades, t => t.symbol || null)
export const bySetup = (trades: Trade[]) => groupBy(trades, t => t.setup || null)
export const byTimeframe = (trades: Trade[]) => groupBy(trades, t => t.timeframe || null)

/** Groups by the ISO weekday name of the close (or open) timestamp, in UTC. */
export function byWeekday(trades: Trade[]): Breakdown[] {
  const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  return groupBy(trades, t => {
    const raw = t.closedAt ?? t.openedAt
    const date = new Date(raw)
    return Number.isNaN(date.valueOf()) ? null : names[date.getUTCDay()]
  })
}

/** Groups by calendar month (UTC) of the close (or open) timestamp. */
export function byMonth(trades: Trade[]): Breakdown[] {
  return groupBy(trades, t => {
    const raw = t.closedAt ?? t.openedAt
    const date = new Date(raw)
    return Number.isNaN(date.valueOf()) ? null : raw.slice(0, 7)
  }).sort((a, b) => b.key.localeCompare(a.key))
}
