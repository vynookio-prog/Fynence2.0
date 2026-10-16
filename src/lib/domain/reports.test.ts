import { describe, expect, it } from 'vitest'
import { buildReport, resolvePeriod } from './reports'
import type { Trade } from './trades'

const now = new Date('2026-06-15T12:00:00Z')

const trade = (v: Partial<Trade>): Trade => ({
  id: 't1', symbol: 'XAUUSD', direction: 'long', status: 'closed',
  openedAt: '2026-06-10T09:00:00Z', closedAt: '2026-06-10T11:00:00Z',
  entryPrice: '2000', exitPrice: '2010', size: '1', fees: '1', realizedPnl: '10',
  currency: 'USD',
  ...v,
})

const linesOf = (report: ReturnType<typeof buildReport>, heading: string) =>
  report.sections.find(s => s.heading === heading)?.lines.join(' ') ?? ''

describe('resolvePeriod', () => {
  it('covers the trailing 7 days for week', () => {
    const period = resolvePeriod('week', now)
    expect(period.end.toISOString()).toBe(now.toISOString())
    expect(period.start.toISOString()).toBe(new Date(now.getTime() - 7 * 86_400_000).toISOString())
  })

  it('has no lower bound for all', () => {
    expect(resolvePeriod('all', now).start.getTime()).toBe(0)
  })
})

describe('buildReport', () => {
  it('reports an empty journal without inventing metrics', () => {
    const report = buildReport([], 'month', now)
    expect(report.tradeCount).toBe(0)
    expect(linesOf(report, 'Hasil')).toContain('Belum ada trade closed')
  })

  it('excludes trades outside the period', () => {
    const old = trade({ id: 'old', closedAt: '2026-01-01T00:00:00Z' })
    const recent = trade({ id: 'recent' })
    expect(buildReport([old, recent], 'month', now).tradeCount).toBe(1)
    expect(buildReport([old, recent], 'all', now).tradeCount).toBe(2)
  })

  it('counts closed trades without a recorded result separately', () => {
    const report = buildReport([trade({ realizedPnl: null })], 'month', now)
    expect(linesOf(report, 'Aktivitas')).toContain('1 trade closed belum punya realized P&L manual')
    expect(linesOf(report, 'Hasil')).toContain('Belum ada trade closed dengan hasil tercatat')
  })

  it('uses net result after fees', () => {
    const report = buildReport([trade({ realizedPnl: '10', fees: '3' })], 'month', now)
    expect(linesOf(report, 'Hasil')).toContain('+7.00')
  })

  it('summarizes reflection fields the user actually recorded', () => {
    const report = buildReport([
      trade({ id: 'a', planAdherence: true, executionQuality: 5, emotion: 'Tenang' }),
      trade({ id: 'b', planAdherence: false, executionQuality: 1, emotion: 'Tenang' }),
    ], 'month', now)
    const text = linesOf(report, 'Eksekusi & refleksi')
    expect(text).toContain('1 dari 2 trade ditandai sesuai rencana')
    expect(text).toContain('1 bernilai 1–2')
    expect(text).toContain('Tenang (2)')
  })

  it('always states the source boundary', () => {
    const text = linesOf(buildReport([trade({})], 'week', now), 'Sumber')
    expect(text).toContain('catatan jurnalmu sendiri')
    expect(text).toContain('Tidak ada harga pasar')
  })
})

describe('buildReport currency safety', () => {
  it('shows the net result with its currency when all trades agree', () => {
    const lines = linesOf(buildReport([trade({ realizedPnl: '10', fees: '3' })], 'all', now), 'Hasil')
    expect(lines).toContain('+7.00 USD')
  })

  it('refuses to sum money across currencies and says why', () => {
    // 100 USD + 100 IDR previously produced a net of "200" that read as a real
    // total. It must now be withheld and the mismatch named instead.
    const report = buildReport([
      trade({ id: 'a', realizedPnl: '100', fees: '0', currency: 'USD' }),
      trade({ id: 'b', realizedPnl: '100', fees: '0', currency: 'IDR' }),
    ], 'all', now)
    const lines = linesOf(report, 'Hasil')

    expect(lines).toContain('IDR, USD')
    expect(lines).not.toContain('+200')
    expect(lines).not.toContain('Hasil bersih:')
    // Ratio metrics survive, because a win rate does not depend on currency.
    expect(lines).toContain('Win rate')
    expect(lines).toContain('Profit factor')
  })

  it('withholds money figures when no currency could be resolved', () => {
    const lines = linesOf(buildReport([trade({ realizedPnl: '10', currency: null })], 'all', now), 'Hasil')
    expect(lines).toContain('tidak punya mata uang')
    expect(lines).not.toContain('+9.00')
  })
})
