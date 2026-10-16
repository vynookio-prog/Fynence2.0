import { describe, expect, it } from 'vitest'
import { realizedNetPnl, type Trade } from './trades'

/**
 * Net P&L must be decimal-safe. Float arithmetic drifts on values that are
 * exact in decimal, and any page that recomputes it locally would reintroduce
 * that drift while also duplicating the formula.
 */
const trade = (v: Partial<Trade>): Trade => ({
  id: 't', symbol: 'XAUUSD', direction: 'long', status: 'closed',
  openedAt: '2026-06-01T09:00:00Z', closedAt: '2026-06-01T11:00:00Z',
  entryPrice: '2000', exitPrice: '2010', size: '1', fees: '0', realizedPnl: '10',
  ...v,
})

describe('decimal safety', () => {
  it('does not drift on values that binary floats get wrong', () => {
    // 0.1 + 0.2 !== 0.3 in float; decimal.js keeps this exact.
    const result = realizedNetPnl(trade({ realizedPnl: '0.3', fees: '0.2' }))
    expect(result?.toString()).toBe('0.1')
  })

  it('keeps precision beyond float safe-integer range', () => {
    const result = realizedNetPnl(trade({ realizedPnl: '9007199254740993', fees: '1' }))
    expect(result?.toString()).toBe('9007199254740992')
  })

  it('preserves the sign of a small net loss', () => {
    const result = realizedNetPnl(trade({ realizedPnl: '10', fees: '10.01' }))
    expect(result?.isNegative()).toBe(true)
  })
})

describe('result is only produced for closed trades with a recorded value', () => {
  it('returns null for an open trade even if fees are set', () => {
    expect(realizedNetPnl(trade({ status: 'open', closedAt: null, exitPrice: null, realizedPnl: null, fees: '5' }))).toBeNull()
  })

  it('returns null when no result was recorded', () => {
    expect(realizedNetPnl(trade({ realizedPnl: null }))).toBeNull()
  })

  it('treats a missing fee field as zero', () => {
    expect(realizedNetPnl(trade({ realizedPnl: '25', fees: '' }))?.toString()).toBe('25')
  })
})
