import Link from 'next/link'
import { ArrowDownRight, ArrowRight, BarChart3, Clock3, TrendingUp } from 'lucide-react'
import { EquityChart } from '@/components/analytics-charts'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { calculateAnalytics } from '@/lib/domain/analytics'
import type { Trade } from '@/lib/domain/trades'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id,symbol,direction,status,opened_at,closed_at,entry_price,exit_price,size,fees,realized_pnl,setup,timeframe'

function Metric({ label, value, sub, icon: Icon, href }: { label: string; value: string; sub: string; icon: typeof TrendingUp; href: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-border bg-surface p-4 transition hover:border-white/15 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <Icon size={16} className="text-[#738187] transition group-hover:text-accent" />
      </div>
      <div className="mt-4 font-mono text-[25px] font-medium tracking-tight tabular sm:text-[28px]">{value}</div>
      <div className="mt-2 text-[11px] text-muted">{sub}</div>
    </Link>
  )
}

export default async function Dashboard() {
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
      setup: r.setup as string | null, timeframe: r.timeframe as string | null,
    }))
  }

  const a = calculateAnalytics(trades)
  const recent = [...trades]
    .sort((x, y) => new Date(y.openedAt).valueOf() - new Date(x.openedAt).valueOf())
    .slice(0, 5)
  const hasData = trades.length > 0

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/[.06] px-2.5 py-1 text-[10px] font-medium tracking-wide text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />JURNAL AKTIF
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight sm:text-[32px]">Selamat datang<span className="text-accent">.</span></h1>
          <p className="mt-2 text-sm text-muted">Edge-mu dimulai dari catatan yang jujur.</p>
        </div>
        <Link href="/journal/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-semibold text-[#06251a] transition hover:brightness-105">
          Catat trade
        </Link>
      </section>

      {loadError && <p role="alert" className="rounded-lg border border-warning/20 bg-warning/[.06] p-4 text-xs text-warning">Data jurnal tidak bisa dimuat: {loadError}</p>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Hasil bersih" value={a.closedCount ? `${Number(a.netPnl) >= 0 ? '+' : ''}${a.netPnl}` : '—'} sub={a.closedCount ? `Dari ${a.closedCount} trade closed` : 'Belum ada hasil tercatat'} icon={TrendingUp} href="/analytics" />
        <Metric label="Win rate" value={a.winRate == null ? '—' : `${a.winRate}%`} sub="Dari trade closed" icon={BarChart3} href="/analytics" />
        <Metric label="Profit factor" value={a.profitFactor == null ? '—' : a.profitFactor.toFixed(2)} sub={a.profitFactor == null ? 'Perlu trade rugi tercatat' : 'Gross win / gross loss'} icon={ArrowDownRight} href="/analytics" />
        <Metric label="Total trade" value={String(trades.length)} sub={`${a.openCount} open · ${a.closedCount} closed`} icon={Clock3} href="/journal" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Performa</h2>
              <p className="mt-1 text-xs text-muted">Equity tercatat · Sepanjang waktu</p>
            </div>
            <span className="rounded-md border border-border bg-[#111a1f] px-2.5 py-1 text-[10px] text-muted">DATA JURNAL</span>
          </div>
          {a.series.length ? (
            <div className="mt-6 h-[230px] w-full sm:h-[270px]"><EquityChart data={a.series} /></div>
          ) : (
            <div className="mt-6 flex h-[230px] flex-col items-center justify-center text-center sm:h-[270px]">
              <BarChart3 size={22} className="text-muted" />
              <p className="mt-3 text-sm font-medium">Belum ada hasil tercatat</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted">Kurva terbentuk dari hasil bersih trade closed yang kamu isi sendiri.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Trade terbaru</h2>
              <p className="mt-1 text-xs text-muted">Catatan jurnal terakhir</p>
            </div>
            <Link aria-label="Lihat semua trade" href="/journal" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:bg-secondary"><ArrowRight size={15} /></Link>
          </div>
          {recent.length ? (
            <ul className="mt-5 divide-y divide-border">
              {recent.map(t => (
                <li key={t.id}>
                  <Link href={`/journal/${t.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent">
                    <span className="min-w-0">
                      <span className="block font-mono text-sm">{t.symbol}</span>
                      <span className="mt-0.5 block text-[10px] text-muted">{new Date(t.openedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })} · {t.status === 'open' ? 'open' : 'closed'}</span>
                    </span>
                    <span className={`shrink-0 font-mono text-xs tabular ${t.status === 'open' || t.realizedPnl == null ? 'text-muted' : Number(t.realizedPnl) - Number(t.fees) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {t.status === 'open' || t.realizedPnl == null ? '—' : `${Number(t.realizedPnl) - Number(t.fees) >= 0 ? '+' : ''}${(Number(t.realizedPnl) - Number(t.fees)).toFixed(2)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-9 text-center">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-[#111a1f] text-muted"><Clock3 size={18} /></div>
              <p className="mt-4 text-sm font-medium">Belum ada trade tercatat</p>
              <p className="mx-auto mt-1 max-w-[230px] text-xs leading-5 text-muted">Catat trade pertamamu untuk mulai membangun riwayat performa.</p>
              <Link href="/journal/new" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary">Catat trade</Link>
            </div>
          )}
        </div>
      </section>

      {hasData && a.incompleteClosedCount > 0 && (
        <p role="status" className="rounded-lg border border-warning/20 bg-warning/[.05] p-4 text-xs leading-5 text-warning">
          {a.incompleteClosedCount} trade closed belum punya realized P&amp;L manual, jadi tidak masuk metrik hasil.
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-accent/15 bg-[linear-gradient(120deg,rgba(53,211,154,.07),rgba(14,21,27,.8)_52%)] p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/15 bg-accent/10 text-accent"><TrendingUp size={17} /></div>
            <div>
              <p className="text-sm font-medium">Dibangun dari catatanmu, bukan dari noise.</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Semua metrik hanya memakai data jurnal yang kamu simpan. Feed pasar terpisah dan akan tampil tidak tersedia sampai sumbernya terverifikasi.</p>
            </div>
          </div>
        </div>
        <Link href="/reports" className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-5 hover:border-white/15">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-[#121b20] text-muted group-hover:text-accent"><BarChart3 size={17} /></div>
          <div className="flex-1">
            <p className="text-sm font-medium">Laporan periode</p>
            <p className="mt-1 text-xs text-muted">Ringkasan dari jurnalmu</p>
          </div>
          <ArrowRight size={16} className="text-muted group-hover:text-accent" />
        </Link>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold">Ringkasan pasar</h2>
            <p className="mt-1 text-xs text-muted">Belum ada sumber pasar langsung yang terhubung</p>
          </div>
          <span className="rounded-full border border-warning/20 bg-warning/[.07] px-2.5 py-1 text-[10px] text-warning">TIDAK TERSEDIA</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {['XAUUSD', 'BTCUSD', 'US500'].map(s => (
            <Link href={`/macro/${s}`} key={s} className="flex items-center justify-between rounded-lg border border-border bg-[#0b1115] p-3.5">
              <div>
                <p className="font-mono text-xs">{s}</p>
                <p className="mt-1 text-[10px] text-muted">Belum ada sumber kuotasi terverifikasi</p>
              </div>
              <span className="text-[10px] text-warning">N/A</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
