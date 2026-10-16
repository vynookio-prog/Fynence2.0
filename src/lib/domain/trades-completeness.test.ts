import { describe, expect, it } from 'vitest'
import { isCompleteClosedTrade, type Trade } from './trades'

const base: Trade = {
  id: 't1', symbol: 'EURUSD', direction: 'long', status: 'closed',
  openedAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-01T01:00:00Z',
  entryPrice: '1.1', exitPrice: '1.2', size: '1', fees: '2', realizedPnl: '12',
}

describe('isCompleteClosedTrade', () => {
  it('accepts a closed trade that has a recorded result', () => {
    expect(isCompleteClosedTrade(base)).toBe(true)
  })

  it('flags a closed trade with no manually recorded result', () => {
    expect(isCompleteClosedTrade({ ...base, realizedPnl: null })).toBe(false)
  })

  it('flags a closed trade with no exit price or close time', () => {
    expect(isCompleteClosedTrade({ ...base, exitPrice: null })).toBe(false)
    expect(isCompleteClosedTrade({ ...base, closedAt: null })).toBe(false)
  })

  it('treats open trades as complete, since they carry no result yet', () => {
    expect(isCompleteClosedTrade({ ...base, status: 'open', closedAt: null, exitPrice: null, realizedPnl: null })).toBe(true)
  })
})
