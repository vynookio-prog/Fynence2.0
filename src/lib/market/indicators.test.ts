import { describe, expect, it } from 'vitest'
import {
  buildIndicators,
  changePct,
  highest,
  lowest,
  rangePosition,
  sma,
  volatilityPct,
} from './indicators'
import type { Candle } from './provider'

const bar = (close: number, high?: number, low?: number, time?: string): Candle => ({
  time: time ?? '2026-01-01T00:00:00Z',
  open: String(close),
  high: String(high ?? close),
  low: String(low ?? close),
  close: String(close),
  volume: null,
})

const series = (closes: number[]): Candle[] =>
  closes.map((c, i) => bar(c, c + 1, c - 1, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`))

describe('sma', () => {
  it('averages the last N closes', () => {
    expect(sma(series([1, 2, 3, 4, 5]), 5)?.toString()).toBe('3')
    expect(sma(series([1, 2, 3, 4, 5]), 2)?.toString()).toBe('4.5')
  })

  it('refuses a window it cannot fill rather than averaging what exists', () => {
    // 3 bars must not silently become a 20-period average.
    expect(sma(series([1, 2, 3]), 20)).toBeNull()
  })

  it('needs exactly the period, not more', () => {
    expect(sma(series([1, 2, 3]), 3)?.toString()).toBe('2')
  })

  it('rejects a non-positive period', () => {
    expect(sma(series([1, 2, 3]), 0)).toBeNull()
    expect(sma(series([1, 2, 3]), -5)).toBeNull()
  })

  it('keeps precision on values a float would drift on', () => {
    const candles = series([0.1, 0.2, 0.3])
    expect(sma(candles, 3)?.toFixed(10)).toBe('0.2000000000')
  })
})

describe('highest / lowest', () => {
  it('finds the extreme over the window only', () => {
    const candles = [bar(10, 100, 1), bar(20, 30, 15), bar(25, 40, 22)]
    expect(highest(candles, 2)?.toString()).toBe('40')
    expect(lowest(candles, 2)?.toString()).toBe('15')
  })

  it('returns null when the window is short', () => {
    expect(highest([bar(10)], 20)).toBeNull()
    expect(lowest([bar(10)], 20)).toBeNull()
  })

  it('handles a flat window without producing a range', () => {
    const flat = [bar(50, 50, 50), bar(50, 50, 50)]
    expect(highest(flat, 2)?.toString()).toBe('50')
    expect(lowest(flat, 2)?.toString()).toBe('50')
  })
})

describe('changePct', () => {
  it('measures the move across the window', () => {
    // 100 -> 110 is +10%.
    expect(changePct(series([100, 105, 110]), 2)?.toFixed(4)).toBe('10.0000')
  })

  it('reports a negative move without flipping sign', () => {
    expect(changePct(series([100, 90]), 1)?.toFixed(2)).toBe('-10.00')
  })

  it('returns null rather than dividing by zero', () => {
    expect(changePct(series([0, 10]), 1)).toBeNull()
  })

  it('needs one more bar than the period', () => {
    expect(changePct(series([1, 2, 3]), 3)).toBeNull()
  })
})

describe('volatilityPct', () => {
  it('is zero for a series with no movement', () => {
    expect(volatilityPct(series([100, 100, 100, 100]), 3)?.toFixed(6)).toBe('0.000000')
  })

  it('grows with the size of the swings', () => {
    const calm = volatilityPct(series([100, 100.1, 100, 100.1]), 3)!
    const wild = volatilityPct(series([100, 120, 95, 130]), 3)!
    expect(wild.gt(calm)).toBe(true)
  })

  it('refuses a window too short to have a spread', () => {
    expect(volatilityPct(series([100]), 5)).toBeNull()
    expect(volatilityPct(series([100, 101]), 1)).toBeNull()
  })

  it('returns null instead of Infinity when a close is zero', () => {
    expect(volatilityPct(series([0, 100, 50]), 2)).toBeNull()
  })
})

describe('rangePosition', () => {
  it('places the last close inside the range', () => {
    // Range 10..30, close 20 -> 50%.
    const candles = [bar(15, 30, 10), bar(20, 25, 18)]
    expect(rangePosition(candles, 2)?.toFixed(2)).toBe('50.00')
  })

  it('returns null for a flat range instead of dividing by zero', () => {
    expect(rangePosition([bar(50, 50, 50), bar(50, 50, 50)], 2)).toBeNull()
  })
})

describe('buildIndicators', () => {
  it('reports every indicator as unavailable with no bars', () => {
    const set = buildIndicators([])
    expect(set.barCount).toBe(0)
    expect(set.latestBar).toBeNull()
    expect(set.values.every(v => v.value === null)).toBe(true)
  })

  it('computes what it can and leaves the rest null on a partial history', () => {
    // 25 bars: short windows work, the 50-bar average cannot.
    const set = buildIndicators(series(Array.from({ length: 25 }, (_, i) => 100 + i)))
    const byKey = Object.fromEntries(set.values.map(v => [v.key, v]))
    expect(byKey.sma20.value).not.toBeNull()
    expect(byKey.sma50.value).toBeNull()
    expect(byKey.change20.value).not.toBeNull()
    expect(byKey.vol20.value).not.toBeNull()
  })

  it('states the bars required, so a missing value has a reason', () => {
    const set = buildIndicators(series([1, 2, 3]))
    const sma50 = set.values.find(v => v.key === 'sma50')!
    expect(sma50.required).toBe(50)
    expect(sma50.value).toBeNull()
  })

  it('reports the bounds of the window it used', () => {
    const set = buildIndicators(series([1, 2, 3]))
    expect(set.barCount).toBe(3)
    expect(set.earliestBar).toBe('2026-01-01T00:00:00Z')
    expect(set.latestBar).toBe('2026-01-03T00:00:00Z')
  })

  it('signs percentage changes so direction is visible', () => {
    const up = buildIndicators(series([100, 101, 102, 103, 104, 110]))
    const change = up.values.find(v => v.key === 'change5')!
    expect(change.value?.startsWith('+')).toBe(true)
  })
})
