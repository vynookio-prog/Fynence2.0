import Link from 'next/link'
import { ArrowRight, BarChart3, TrendingUp } from 'lucide-react'
import { EquityChart, DrawdownChart, BreakdownTable } from '@/components/analytics-charts'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { bySetup, bySymbol, byTimeframe, byWeekday, calculateAnalytics } from '@/lib/domain/analytics'
import { rByGroup, summarizeRisk } from '@/lib/domain/risk'
import type { Trade } from '@/lib/domain/trades'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id,symbol,direction,status,opened_at,closed_at,entry_price,exit_price,size,fees,realized_pnl,risk_amount,stop_loss,take_profit,setup,timeframe'

const box = 'rounded-xl border border-border bg-surface p-5'

export default async function AnalyticsPage() {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()

  let trades: Trade[] = []
  let loadError = ''
  if (userData?.user) {
    const { data, error } = await client.database
      .from('trades')
      .select(COLUMNS)
      .eq('user_id', userData.user.id)
      .order('opened_at', { ascending: false })
      .limit(1000)
    if (error) loadError = error.message
    else trades = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id), symbol: String(r.symbol), direction: r.direction as Trade['direction'],
      status: r.status as Trade['status'], openedAt: String(r.opened_at),
      closedAt: r.closed_at == null ? null : String(r.closed_at),
      entryPrice: String(r.entry_price),
      exitPrice: r.exit_price == null ? null : String(r.exit_price),
      size: String(r.size), fees: String(r.fees),
      realizedPnl: r.realized_pnl == null ? null : String(r.realized_pnl),
      riskAmount: r.risk_amount == null ? null : String(r.risk_amount),
      stopLoss: r.stop_loss == null ? null : String(r.stop_loss),
      takeProfit: r.take_profit == null ? null : String(r.take_profit),
      setup: r.setup as string | null, timeframe: r.timeframe as string | null,
    }))
  }

  const a = calculateAnalytics(trades)
  const risk = summarizeRisk(trades)
  const signed = (v: string | null | undefined) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${v}`

  const metrics: [string, string, string][] = [
    ['Hasil bersih', a.closedCount ? signed(a.netPnl) : '—', 'Realized P&L dikurangi fee tercatat'],
    ['Win rate', a.winRate == null ? '—' : `${a.winRate}%`, `${a.closedCount} trade closed dinilai`],
    ['Profit factor', a.profitFactor == null ? '—' : a.profitFactor.toFixed(2), a.profitFactor == null ? 'Belum ada trade rugi tercatat' : 'Gross win dibagi gross loss'],
    ['Expectancy', a.expectancy == null ? '—' : signed(a.expectancy), 'Rata-rata bersih per trade closed'],
    ['Rata-rata menang', a.averageWin ?? '—', 'Dari trade dengan hasil bersih positif'],
    ['Rata-rata kalah', a.averageLoss ?? '—', 'Dari trade dengan hasil bersih negatif'],
    ['Menang terbesar', a.largestWin ?? '—', 'Nilai absolut tertinggi'],
    ['Drawdown maksimum', a.maxDrawdown == null ? '—' : a.maxDrawdown.toFixed(2), 'Penurunan terbesar dari puncak equity'],
  ]

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Metrik dari jurnalmu</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-2 text-sm text-muted">Hanya trade closed dengan hasil tercatat yang dihitung sebagai performa.</p>
        </div>
        <Link href="/journal" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-xs font-medium hover:bg-secondary">
          Buka jurnal<ArrowRight size={14} />
        </Link>
      </div>

      {loadError && <p role="alert" className="rounded-lg border border-warning/20 bg-warning/[.06] p-4 text-xs text-warning">Analytics tidak bisa dimuat: {loadError}</p>}

      {a.incompleteClosedCount > 0 && (
        <p role="status" className="rounded-lg border border-warning/20 bg-warning/[.05] p-4 text-xs leading-5 text-warning">
          {a.incompleteClosedCount} trade closed belum punya realized P&amp;L manual dan dikeluarkan dari semua metrik. Isi hasilnya di detail trade.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(([label, value, desc]) => (
          <div key={label} className={box}>
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-4 font-mono text-2xl tabular">{value}</p>
            <p className="mt-2 text-[11px] leading-4 text-muted">{desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_.75fr]">
        <div className={box}>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Kurva hasil</h2>
          </div>
          <p className="mt-1 text-xs text-muted">Jumlah berjalan dari hasil bersih tercatat, urut waktu penutupan</p>
          {a.series.length ? (
            <div className="mt-5 h-64"><EquityChart data={a.series} /></div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <BarChart3 size={24} className="text-muted" />
              <p className="mt-3 text-sm font-medium">Belum cukup hasil tercatat</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted">Trade closed tanpa realized P&amp;L manual tidak dihitung. Isi hasil saat menutup trade.</p>
            </div>
          )}
        </div>

        <div className={box}>
          <h2 className="text-sm font-semibold">Hitungan trade</h2>
          <div className="mt-5 space-y-3">
            {([
              ['Trade closed dinilai', a.closedCount],
              ['Trade open', a.openCount],
              ['Hasil belum tercatat', a.incompleteClosedCount],
              ['Break-even', a.breakEvenCount],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between rounded-lg border border-border p-3 text-xs">
                <span className="text-muted">{label}</span>
                <span className="font-mono tabular">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-border bg-[#0a1115] p-3 text-[11px] leading-5 text-muted">P&amp;L adalah catatanmu, bukan hasil hitungan dari selisih harga. Multiplier dan konversi mata uang tidak diasumsikan.</div>
        </div>
      </div>

      {a.series.length > 0 && (
        <div className={box}>
          <h2 className="text-sm font-semibold">Drawdown</h2>
          <p className="mt-1 text-xs text-muted">Jarak dari puncak equity tertinggi sejauh ini</p>
          <div className="mt-5 h-40"><DrawdownChart data={a.series} /></div>
        </div>
      )}

      {a.closedCount > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownTable title="Per symbol" rows={bySymbol(trades)} />
          <BreakdownTable title="Per setup" rows={bySetup(trades)} />
          <BreakdownTable title="Per timeframe" rows={byTimeframe(trades)} />
          <BreakdownTable title="Per hari" rows={byWeekday(trades)} />
        </div>
      )}

      {a.closedCount > 0 && (
        <section className={box}>
          <h2 className="text-sm font-semibold">Risiko & R</h2>
          <p className="mt-1 text-xs text-muted">
            R dihitung dari hasil bersih dibagi risk amount yang kamu isi sendiri.
          </p>

          {risk.withRisk === 0 ? (
            <p className="mt-4 rounded-lg border border-border bg-[#0a1115] p-3 text-xs leading-5 text-muted">
              Belum ada trade dengan risk amount. Tanpa angka itu R tidak dihitung — R tidak pernah diturunkan dari selisih harga, ukuran lot, atau multiplier.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {([
                  ['Rata-rata R', risk.averageR == null ? '—' : `${risk.averageR}R`],
                  ['R terbaik', risk.bestR == null ? '—' : `${risk.bestR}R`],
                  ['R terburuk', risk.worstR == null ? '—' : `${risk.worstR}R`],
                  ['Total risiko', risk.totalRisk == null ? '—' : risk.totalRisk],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-[#0a1115] p-3">
                    <p className="text-[11px] text-muted">{label}</p>
                    <p className="mt-2 font-mono text-lg tabular">{value}</p>
                  </div>
                ))}
              </div>
              {risk.missingRisk > 0 && (
                <p role="status" className="mt-3 rounded-lg border border-warning/20 bg-warning/[.05] p-3 text-[11px] leading-5 text-warning">
                  {risk.missingRisk} trade closed dengan hasil tercatat tidak punya risk amount, sehingga tidak masuk hitungan R.
                </p>
              )}
              <p className="mt-3 text-[11px] leading-5 text-muted">
                {risk.positiveRShare == null ? '' : `${risk.positiveRShare}% trade berakhir pada 0R atau lebih baik. `}
                Dihitung dari {risk.withRisk} trade yang punya risk amount.
              </p>
            </>
          )}

          {risk.withRisk > 0 && (
            <div className="mt-5 border-t border-border pt-5">
              <BreakdownTable title="Rata-rata R per symbol" rows={rByGroup(trades, t => t.symbol).map(r => ({
                key: r.key, trades: r.trades, netPnl: r.averageR, winRate: null,
              }))} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
