import { describe, expect, it } from 'vitest'
import { bySetup, bySymbol, byWeekday, calculateAnalytics } from './analytics'
import type { Trade } from './trades'

const trade = (v: Partial<Trade>): Trade => ({
  id: Math.random().toString(36).slice(2), symbol: 'XAUUSD', direction: 'long', status: 'closed',
  openedAt: '2026-06-01T09:00:00Z', closedAt: '2026-06-01T11:00:00Z',
  entryPrice: '2000', exitPrice: '2010', size: '1', fees: '0', realizedPnl: '10',
  ...v,
})

describe('calculateAnalytics', () => {
  it('excludes open trades and closed trades without a recorded result', () => {
    const a = calculateAnalytics([
      trade({ realizedPnl: '10' }),
      trade({ status: 'open', closedAt: null, exitPrice: null, realizedPnl: null }),
      trade({ closedAt: '2026-06-02T11:00:00Z', realizedPnl: null }),
    ])
    expect(a.closedCount).toBe(1)
    expect(a.openCount).toBe(1)
    expect(a.incompleteClosedCount).toBe(1)
  })

  it('separates break-even trades from wins and losses', () => {
    const a = calculateAnalytics([trade({ realizedPnl: '10' }), trade({ realizedPnl: '0' }), trade({ realizedPnl: '-4' })])
    expect(a.breakEvenCount).toBe(1)
    expect(a.winRate).toBe(33.3)
  })

  it('returns a null profit factor instead of dividing by zero', () => {
    const a = calculateAnalytics([trade({ realizedPnl: '10' })])
    expect(a.profitFactor).toBeNull()
    expect(a.grossLoss).toBe('0.00')
  })

  it('reports the largest win and loss by recorded net result', () => {
    const a = calculateAnalytics([trade({ realizedPnl: '10' }), trade({ realizedPnl: '50' }), trade({ realizedPnl: '-30' })])
    expect(a.largestWin).toBe('50.00')
    expect(a.largestLoss).toBe('-30.00')
  })

  it('builds equity and drawdown from recorded results in close order', () => {
    const a = calculateAnalytics([
      trade({ closedAt: '2026-06-03T11:00:00Z', realizedPnl: '-20' }),
      trade({ closedAt: '2026-06-01T11:00:00Z', realizedPnl: '100' }),
      trade({ closedAt: '2026-06-02T11:00:00Z', realizedPnl: '50' }),
    ])
    expect(a.series.map(p => p.equity)).toEqual([100, 150, 130])
    expect(a.series.map(p => p.drawdown)).toEqual([0, 0, 20])
    expect(a.maxDrawdown).toBe(20)
  })

  it('compounds fees into the net result and drawdown', () => {
    const a = calculateAnalytics([trade({ closedAt: '2026-06-02T11:00:00Z', realizedPnl: '10', fees: '12' })])
    expect(a.netPnl).toBe('-2.00')
    expect(a.maxDrawdown).toBe(0)
  })

  it('reports empty metrics with no closed records', () => {
    const a = calculateAnalytics([])
    expect(a).toMatchObject({ closedCount: 0, netPnl: '0.00', winRate: null, expectancy: null, maxDrawdown: null })
  })
})

describe('breakdowns', () => {
  it('groups by symbol and ranks by recorded net result', () => {
    const rows = bySymbol([
      trade({ symbol: 'XAUUSD', realizedPnl: '10' }),
      trade({ symbol: 'BTCUSD', realizedPnl: '90' }),
      trade({ symbol: 'XAUUSD', realizedPnl: '-5' }),
    ])
    expect(rows.map(r => r.key)).toEqual(['BTCUSD', 'XAUUSD'])
    expect(rows.find(r => r.key === 'XAUUSD')).toMatchObject({ trades: 2, netPnl: '5.00' })
  })

  it('labels trades whose setup was not recorded', () => {
    expect(bySetup([trade({ setup: null })]).map(r => r.key)).toEqual(['Tidak dicatat'])
  })

  it('groups by UTC weekday of the close time', () => {
    // 2026-06-01 is a Monday.
    expect(byWeekday([trade({ closedAt: '2026-06-01T11:00:00Z' })]).map(r => r.key)).toEqual(['Senin'])
  })
})
