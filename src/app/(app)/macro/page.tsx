import Link from 'next/link'
import { Activity, ArrowRight, Clock3, ShieldAlert } from 'lucide-react'
import { WatchlistEditor } from '@/components/watchlist-editor'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export const dynamic = 'force-dynamic'

const DEFAULT_SYMBOLS = ['XAUUSD', 'US30', 'US500', 'MNQ', 'BTCUSD']

export default async function MacroPage() {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()

  let symbols = DEFAULT_SYMBOLS
  let saved = false
  if (userData?.user) {
    const { data } = await client.database
      .from('watchlists')
      .select('symbols')
      .eq('user_id', userData.user.id)
      .eq('name', 'Utama')
      .limit(1)
    const stored = (data?.[0] as { symbols?: string[] } | undefined)?.symbols
    if (stored?.length) { symbols = stored; saved = true }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Market intelligence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Macro Desk</h1>
          <p className="mt-2 text-sm text-muted">Ringkasan hanya ketika provider memberi data yang dapat diverifikasi.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/[.06] px-3 py-1.5 text-[10px] text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />PROVIDER BELUM TERVERIFIKASI
        </span>
      </div>

      <div className="flex gap-3 rounded-xl border border-warning/20 bg-warning/[.045] p-4">
        <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-xs font-medium">Tidak ada bias pasar atau kuotasi yang dibuat-buat</p>
          <p className="mt-1 text-xs leading-5 text-muted">Sumber, lisensi, cakupan instrumen, dan kuota refresh belum disetujui. Data pasar berstatus tidak tersedia — bukan tertunda, bukan real-time.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Instrumen dipantau</h2>
            <span className="text-[11px] text-muted">{symbols.length} symbol</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {symbols.map(symbol => (
              <Link key={symbol} href={`/macro/${encodeURIComponent(symbol)}`} className="group rounded-xl border border-border bg-surface p-5 transition hover:border-white/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-[#121b20] text-muted group-hover:text-accent"><Activity size={17} /></div>
                    <div>
                      <p className="font-mono text-sm font-medium">{symbol}</p>
                      <p className="mt-0.5 text-[10px] text-muted">{saved ? 'Dari watchlistmu' : 'Daftar bawaan'}</p>
                    </div>
                  </div>
                  <ArrowRight size={15} className="text-muted group-hover:text-accent" />
                </div>
                <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                  <div>
                    <p className="font-mono text-lg text-muted">—</p>
                    <p className="mt-1 text-[10px] text-muted">Tidak ada kuotasi terverifikasi</p>
                  </div>
                  <span className="rounded-md border border-warning/15 bg-warning/[.05] px-2 py-1 text-[9px] text-warning">N/A</span>
                </div>
              </Link>
            ))}
          </div>
          <p className="flex items-center gap-2 text-[10px] text-muted">
            <Clock3 size={12} />Waktu server dirender ulang setiap permintaan · ini bukan timestamp data sumber
          </p>
        </div>

        <WatchlistEditor symbols={symbols} />
      </div>
    </div>
  )
}
