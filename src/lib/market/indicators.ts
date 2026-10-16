import Decimal from 'decimal.js'
import type { Candle } from './provider'

/**
 * Indicators computed from stored bars.
 *
 * Rules this module holds to:
 *
 * - Every number here is DERIVED from bars that carry their own provenance. A
 *   calculation is not a source: if the input bars are stale or absent, the
 *   right answer is "insufficient data", never a number computed from whatever
 *   happened to be there.
 * - Arithmetic goes through decimal.js, like every other money path.
 * - Each indicator declares how many bars it needs and returns null when it has
 *   fewer. A window silently truncated to what was available would look
 *   identical to a full one.
 * - These are plain, well-known definitions. Nothing here is a proprietary
 *   score, so nothing here needs to pretend to be one.
 */

export type IndicatorValue = {
  /** Short machine-ish key, e.g. 'sma20'. */
  key: string
  label: string
  /** Formatted for display. Null when it could not be computed. */
  value: string | null
  /** Bars required, so a caller can say why a value is missing. */
  required: number
  /** What the number means, in one line. */
  note: string
}

/** Bars are oldest-first, which is what every function here assumes. */
export function closes(candles: Candle[]): Decimal[] {
  return candles.map(c => new Decimal(c.close))
}

/**
 * Simple moving average over the last `period` closes.
 * Needs exactly `period` bars. Returns null otherwise — a 20-period average of
 * 8 bars is not a 20-period average.
 */
export function sma(candles: Candle[], period: number): Decimal | null {
  if (period <= 0 || candles.length < period) return null
  const window = closes(candles).slice(-period)
  const total = window.reduce((sum, value) => sum.plus(value), new Decimal(0))
  return total.div(period)
}

/** Highest high / lowest low over the last `period` bars. */
export function highest(candles: Candle[], period: number): Decimal | null {
  if (period <= 0 || candles.length < period) return null
  const window = candles.slice(-period)
  return window.reduce(
    (max, c) => {
      const high = new Decimal(c.high)
      return high.gt(max) ? high : max
    },
    new Decimal(window[0].high),
  )
}

export function lowest(candles: Candle[], period: number): Decimal | null {
  if (period <= 0 || candles.length < period) return null
  const window = candles.slice(-period)
  return window.reduce(
    (min, c) => {
      const low = new Decimal(c.low)
      return low.lt(min) ? low : min
    },
    new Decimal(window[0].low),
  )
}

/**
 * Percentage move between the first and last close of the window.
 * Expressed as a percentage of the earlier close, so it is comparable across
 * instruments with wildly different price scales.
 */
export function changePct(candles: Candle[], period: number): Decimal | null {
  if (period <= 0 || candles.length < period + 1) return null
  const window = candles.slice(-(period + 1))
  const first = new Decimal(window[0].close)
  const last = new Decimal(window[window.length - 1].close)
  if (first.isZero()) return null
  return last.minus(first).div(first).times(100)
}

/**
 * Annualised volatility of daily returns, as a percentage.
 *
 * Uses the sample standard deviation (n-1). Needs at least two returns to have
 * any spread to measure at all, and refuses a window it cannot fill.
 *
 * Deliberately not called "risk": it measures how much the close moved, nothing
 * about the position someone actually held.
 */
export function volatilityPct(candles: Candle[], period: number): Decimal | null {
  if (period < 2 || candles.length < period + 1) return null

  const window = candles.slice(-(period + 1))
  const returns: Decimal[] = []
  for (let i = 1; i < window.length; i += 1) {
    const previous = new Decimal(window[i - 1].close)
    if (previous.isZero()) return null
    returns.push(new Decimal(window[i].close).minus(previous).div(previous))
  }
  if (returns.length < 2) return null

  const mean = returns.reduce((sum, value) => sum.plus(value), new Decimal(0)).div(returns.length)
  const variance = returns
    .reduce((sum, value) => sum.plus(value.minus(mean).pow(2)), new Decimal(0))
    .div(returns.length - 1)

  const stdev = variance.sqrt()
  // 252 trading days, the conventional annualisation for daily bars.
  return stdev.times(new Decimal(252).sqrt()).times(100)
}

export type IndicatorSet = {
  /** Bars actually available, which is what every "required" is judged against. */
  barCount: number
  values: IndicatorValue[]
  /** The newest bar's date, so staleness is visible next to the numbers. */
  latestBar: string | null
  /** The oldest bar's date, bounding the window the numbers came from. */
  earliestBar: string | null
}

const fmt = (value: Decimal | null, digits: number): string | null =>
  value === null ? null : value.toFixed(digits)

/**
 * Builds the standard indicator set from whatever bars are stored.
 *
 * Every entry reports its own availability. A partially-computable set is
 * normal and is returned as-is: the caller shows which values are missing rather
 * than being handed a set that looks complete.
 */
export function buildIndicators(candles: Candle[]): IndicatorSet {
  const barCount = candles.length
  const last = (value: Decimal | null, digits = 2) => fmt(value, digits)

  const values: IndicatorValue[] = [
    {
      key: 'last',
      label: 'Close terakhir',
      value: barCount ? last(new Decimal(candles[barCount - 1].close), 4) : null,
      required: 1,
      note: 'Harga penutupan bar terakhir yang tersimpan.',
    },
    {
      key: 'change5',
      label: 'Perubahan 5 bar',
      value: barCount > 5 ? (() => { const v = changePct(candles, 5); return v ? `${v.gte(0) ? '+' : ''}${v.toFixed(2)}%` : null })() : null,
      required: 6,
      note: 'Selisih close terakhir terhadap close 5 bar sebelumnya.',
    },
    {
      key: 'change20',
      label: 'Perubahan 20 bar',
      value: barCount > 20 ? (() => { const v = changePct(candles, 20); return v ? `${v.gte(0) ? '+' : ''}${v.toFixed(2)}%` : null })() : null,
      required: 21,
      note: 'Selisih close terakhir terhadap close 20 bar sebelumnya.',
    },
    {
      key: 'sma20',
      label: 'SMA 20',
      value: last(sma(candles, 20), 4),
      required: 20,
      note: 'Rata-rata sederhana 20 close terakhir.',
    },
    {
      key: 'sma50',
      label: 'SMA 50',
      value: last(sma(candles, 50), 4),
      required: 50,
      note: 'Rata-rata sederhana 50 close terakhir.',
    },
    {
      key: 'high20',
      label: 'Tertinggi 20 bar',
      value: last(highest(candles, 20), 4),
      required: 20,
      note: 'High tertinggi dalam 20 bar terakhir.',
    },
    {
      key: 'low20',
      label: 'Terendah 20 bar',
      value: last(lowest(candles, 20), 4),
      required: 20,
      note: 'Low terendah dalam 20 bar terakhir.',
    },
    {
      key: 'vol20',
      label: 'Volatilitas 20 bar',
      value: barCount > 20 ? (() => { const v = volatilityPct(candles, 20); return v ? `${v.toFixed(2)}%` : null })() : null,
      required: 21,
      note: 'Simpangan baku return harian, disetahunkan (252 bar). Mengukur pergerakan close, bukan risiko posisi.',
    },
  ]

  return {
    barCount,
    values,
    latestBar: barCount ? candles[barCount - 1].time : null,
    earliestBar: barCount ? candles[0].time : null,
  }
}

/**
 * Where the last close sits inside the recent range, as a percentage.
 *
 * 0% is at the low, 100% at the high. Returned separately from the indicator
 * list because it is only meaningful when a range exists; a flat window would
 * divide by zero, and a range nobody traded produces a number that looks like
 * information.
 */
export function rangePosition(candles: Candle[], period: number): Decimal | null {
  const high = highest(candles, period)
  const low = lowest(candles, period)
  if (high === null || low === null) return null
  const span = high.minus(low)
  if (span.isZero()) return null
  const last = new Decimal(candles[candles.length - 1].close)
  return last.minus(low).div(span).times(100)
}
