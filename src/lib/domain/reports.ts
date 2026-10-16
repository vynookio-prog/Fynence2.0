import Decimal from 'decimal.js'
import { calculateAnalytics, realizedNetPnl, type Trade } from './trades'

export type PeriodKey = 'week' | 'month' | 'quarter' | 'all'

export type Period = { start: Date; end: Date; label: string }

export type ReportSection = { heading: string; lines: string[] }
export type Report = { periodKey: PeriodKey; period: Period; sections: ReportSection[]; tradeCount: number; generatedAt: string }

const DAY = 86_400_000

/** Trailing window ending now. 'all' has no lower bound. */
export function resolvePeriod(key: PeriodKey, now: Date): Period {
  const end = new Date(now)
  if (key === 'all') {
    return { start: new Date(0), end, label: 'Seluruh catatan' }
  }
  const start = new Date(now)
  if (key === 'week') start.setTime(now.getTime() - 7 * DAY)
  if (key === 'month') start.setTime(now.getTime() - 30 * DAY)
  if (key === 'quarter') start.setTime(now.getTime() - 90 * DAY)
  return { start, end, label: key === 'week' ? '7 hari terakhir' : key === 'month' ? '30 hari terakhir' : '90 hari terakhir' }
}

function inPeriod(value: string | null | undefined, period: Period): boolean {
  if (!value) return false
  const time = new Date(value).valueOf()
  if (Number.isNaN(time)) return false
  return time >= period.start.valueOf() && time <= period.end.valueOf()
}

/**
 * Builds a factual summary from the user's own journal records only.
 * Every number is a count or a recorded value; nothing is inferred from price movement,
 * and no market commentary is produced.
 */
export function buildReport(trades: Trade[], periodKey: PeriodKey, now: Date): Report {
  const period = resolvePeriod(periodKey, now)
  const scoped = trades.filter(t =>
    periodKey === 'all'
      ? true
      : inPeriod(t.closedAt ?? t.openedAt, period),
  )

  const analytics = calculateAnalytics(scoped)
  const closed = scoped.filter(t => t.status === 'closed')
  const open = scoped.filter(t => t.status === 'open')

  const sections: ReportSection[] = []

  const counts: string[] = [
    `${scoped.length} trade dalam periode ini (${closed.length} closed, ${open.length} open).`,
  ]
  const withoutResult = closed.filter(t => realizedNetPnl(t) === null).length
  if (withoutResult > 0) {
    counts.push(`${withoutResult} trade closed belum punya realized P&L manual, jadi tidak dihitung di metrik hasil.`)
  }
  sections.push({ heading: 'Aktivitas', lines: counts })

  const results: string[] = []
  if (analytics.closedCount === 0) {
    results.push('Belum ada trade closed dengan hasil tercatat. Metrik hasil belum bisa dihitung.')
  } else {
    const net = new Decimal(analytics.netPnl)
    results.push(`Hasil bersih: ${net.gte(0) ? '+' : ''}${net.toFixed(2)} (realized P&L dikurangi fee tercatat).`)
    results.push(`Win rate: ${analytics.winRate ?? 0}% dari ${analytics.closedCount} trade closed.`)
    if (analytics.profitFactor !== null) {
      results.push(`Profit factor: ${analytics.profitFactor.toFixed(2)}.`)
    } else {
      results.push('Profit factor belum bisa dihitung karena belum ada trade rugi tercatat.')
    }
    results.push(`Rata-rata menang: ${analytics.averageWin ?? '—'} · rata-rata kalah: ${analytics.averageLoss ?? '—'}.`)
    results.push(`Expectancy per trade closed: ${analytics.expectancy ?? '—'}.`)
  }
  sections.push({ heading: 'Hasil', lines: results })

  const adherence = scoped.filter(t => t.planAdherence !== null && t.planAdherence !== undefined)
  const followed = adherence.filter(t => t.planAdherence === true).length
  const graded = scoped.filter(t => t.executionQuality != null)
  const lowQuality = graded.filter(t => (t.executionQuality ?? 0) <= 2).length
  const weakSetups = scoped.filter(t => t.setupGrade != null && t.setupGrade <= 2).length

  const reflection: string[] = []
  if (adherence.length) {
    reflection.push(`${followed} dari ${adherence.length} trade ditandai sesuai rencana.`)
  } else {
    reflection.push('Belum ada trade yang ditandai mengikuti rencana atau tidak.')
  }
  if (graded.length) {
    reflection.push(`${graded.length} trade dinilai kualitas eksekusinya; ${lowQuality} bernilai 1–2.`)
  } else {
    reflection.push('Belum ada penilaian kualitas eksekusi.')
  }
  if (weakSetups) reflection.push(`${weakSetups} trade dinilai setup-nya 1–2.`)
  const emotions = new Map<string, number>()
  for (const t of scoped) if (t.emotion) emotions.set(t.emotion, (emotions.get(t.emotion) ?? 0) + 1)
  reflection.push(emotions.size
    ? `Emosi tercatat: ${[...emotions.entries()].sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} (${n})`).join(', ')}.`
    : 'Tidak ada emosi yang dicatat pada periode ini.')
  sections.push({ heading: 'Eksekusi & refleksi', lines: reflection })

  const instruments = new Map<string, { count: number; net: Decimal }>()
  for (const t of scoped) {
    const entry = instruments.get(t.symbol) ?? { count: 0, net: new Decimal(0) }
    entry.count += 1
    const pnl = realizedNetPnl(t)
    if (pnl) entry.net = entry.net.plus(pnl)
    instruments.set(t.symbol, entry)
  }
  const ranked = [...instruments.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  sections.push({
    heading: 'Instrumen',
    lines: ranked.length
      ? ranked.map(([symbol, v]) => `${symbol}: ${v.count} trade, hasil bersih tercatat ${v.net.gte(0) ? '+' : ''}${v.net.toFixed(2)}.`)
      : ['Belum ada instrumen pada periode ini.'],
  })

  sections.push({
    heading: 'Sumber',
    lines: [
      'Semua angka berasal dari catatan jurnalmu sendiri.',
      'Tidak ada harga pasar, berita, atau kalender ekonomi yang dipakai.',
      'Hasil tidak disimpulkan dari pergerakan harga, ukuran lot, atau multiplier kontrak.',
    ],
  })

  return { periodKey, period, sections, tradeCount: scoped.length, generatedAt: now.toISOString() }
}
