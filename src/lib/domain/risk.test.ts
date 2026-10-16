import { describe, expect, it } from 'vitest'
import { plannedRR, realizedR, rByGroup, summarizeRisk } from './risk'
import type { Trade } from './trades'

const trade = (v: Partial<Trade>): Trade => ({
  id: 't', symbol: 'XAUUSD', direction: 'long', status: 'closed',
  openedAt: '2026-06-01T09:00:00Z', closedAt: '2026-06-01T11:00:00Z',
  entryPrice: '2000', exitPrice: '2020', size: '1', fees: '0', realizedPnl: '100',
  ...v,
})

describe('plannedRR', () => {
  it('computes reward-to-risk from entry, stop, and target', () => {
    expect(plannedRR(trade({ entryPrice: '2000', stopLoss: '1990', takeProfit: '2030' }))?.toFixed(2)).toBe('3.00')
  })

  it('works for a short', () => {
    expect(plannedRR(trade({ direction: 'short', entryPrice: '2000', stopLoss: '2010', takeProfit: '1970' }))?.toFixed(2)).toBe('3.00')
  })

  it('returns null without a stop or target', () => {
    expect(plannedRR(trade({ stopLoss: null, takeProfit: '2030' }))).toBeNull()
    expect(plannedRR(trade({ stopLoss: '1990', takeProfit: null }))).toBeNull()
  })

  it('returns null when the stop equals entry', () => {
    expect(plannedRR(trade({ entryPrice: '2000', stopLoss: '2000', takeProfit: '2030' }))).toBeNull()
  })
})

describe('realizedR', () => {
  it('divides the recorded net result by the recorded risk amount', () => {
    expect(realizedR(trade({ realizedPnl: '100', fees: '10', riskAmount: '50' }))?.toFixed(2)).toBe('1.80')
  })

  it('reports a loss in R', () => {
    expect(realizedR(trade({ realizedPnl: '-50', riskAmount: '50' }))?.toFixed(2)).toBe('-1.00')
  })

  it('returns null without a recorded risk amount rather than deriving one', () => {
    expect(realizedR(trade({ stopLoss: '1990', size: '10', riskAmount: null }))).toBeNull()
  })

  it('returns null for a trade without a recorded result', () => {
    expect(realizedR(trade({ status: 'open', closedAt: null, exitPrice: null, realizedPnl: null, riskAmount: '50' }))).toBeNull()
  })

  it('rejects a non-positive risk amount', () => {
    expect(realizedR(trade({ riskAmount: '0' }))).toBeNull()
  })
})

describe('summarizeRisk', () => {
  it('counts trades missing a risk amount instead of assuming zero', () => {
    const s = summarizeRisk([
      trade({ realizedPnl: '100', riskAmount: '50' }),
      trade({ realizedPnl: '20', riskAmount: null }),
    ])
    expect(s.withRisk).toBe(1)
    expect(s.missingRisk).toBe(1)
    expect(s.totalRisk).toBe('50.00')
  })

  it('averages R and finds the extremes', () => {
    const s = summarizeRisk([
      trade({ realizedPnl: '100', riskAmount: '50' }),
      trade({ realizedPnl: '-50', riskAmount: '50' }),
    ])
    expect(s.averageR).toBe('0.50')
    expect(s.bestR).toBe('2.00')
    expect(s.worstR).toBe('-1.00')
    expect(s.positiveRShare).toBe(50)
  })

  it('returns null metrics when no risk amount was recorded', () => {
    const s = summarizeRisk([trade({ realizedPnl: '100', riskAmount: null })])
    expect(s).toMatchObject({ withRisk: 0, totalRisk: null, averageR: null, bestR: null })
  })

  it('ignores open trades', () => {
    const s = summarizeRisk([trade({ status: 'open', closedAt: null, exitPrice: null, realizedPnl: null, riskAmount: '50' })])
    expect(s).toMatchObject({ withRisk: 0, missingRisk: 0 })
  })
})

describe('rByGroup', () => {
  it('averages R per key and ranks descending', () => {
    const rows = rByGroup([
      trade({ symbol: 'A', realizedPnl: '100', riskAmount: '50' }),
      trade({ symbol: 'B', realizedPnl: '150', riskAmount: '50' }),
      trade({ symbol: 'A', realizedPnl: '0', riskAmount: '50' }),
    ], t => t.symbol)
    // A: 2.00 and 0.00 -> 1.00. B: 3.00. B ranks first.
    expect(rows.map(r => r.key)).toEqual(['B', 'A'])
    expect(rows.find(r => r.key === 'A')).toMatchObject({ trades: 2, averageR: '1.00' })
    expect(rows.find(r => r.key === 'B')).toMatchObject({ trades: 1, averageR: '3.00' })
  })

  it('skips trades without R', () => {
    expect(rByGroup([trade({ riskAmount: null })], t => t.symbol)).toEqual([])
  })
})
