import { CandlestickChart, Database, ShieldAlert, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { InstrumentPicker } from '@/components/instrument-picker'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { createTwelveDataProvider } from '@/lib/market/twelvedata'
import { MAX_INSTRUMENTS, buildMarketView, listCatalogue, listSelected } from '@/lib/market/view'

export const dynamic = 'force-dynamic'

/**
 * The market view.
 *
 * Renders only the instruments this user selected. The cost of a load is the
 * number of selected instruments whose cache is not fresh — which is often
 * zero, because a fresh symbol is served from storage without calling the
 * provider at all.
 *
 * Nothing here presents a stored value as live. Every figure carries the
 * provider's own bar time and the time our server retrieved it.
 */

function formatPrice(value: string): string {
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return value
  return asNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })
}

export default async function PasarPage() {
  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const user = auth?.user

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Masuk dulu untuk memilih instrumen.</p>
      </div>
    )
  }

  const [selected, catalogue] = await Promise.all([listSelected(user.id), listCatalogue()])

  const view = selected.length
    ? await buildMarketView(user.id, createTwelveDataProvider(), '1day', 120)
    : { instruments: [], servedFromCache: 0, fetched: 0, creditsUsed: 0 }

  const totalBars = view.instruments.reduce((sum, item) => sum + item.candles.length, 0)

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Market data</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pasar</h1>
          <p className="mt-2 text-sm text-muted">
            Hanya instrumen yang kamu pilih yang diambil datanya.
          </p>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] text-muted">
              <Database size={11} />{view.servedFromCache} dari cache
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] text-muted">
              <Zap size={11} />{view.creditsUsed} kredit terpakai
            </span>
          </div>
        )}
      </div>

      {/* Licence reality, stated where the data is shown rather than only in a doc. */}
      <div className="flex gap-3 rounded-xl border border-warning/20 bg-warning/[.045] p-4">
        <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-xs font-medium">Twelve Data plan Individual: pemakaian pribadi/internal saja</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Menampilkan harga ini ke pengguna lain termasuk commercial display dan butuh Redistribution Rights Add-on.
            Karena itu halaman ini masih untuk pemakaian terbatas, bukan rilis publik.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="space-y-3">
          {selected.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8">
              <div className="flex items-center gap-2 text-muted">
                <CandlestickChart size={16} />
                <p className="text-xs">Belum ada instrumen dipilih</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                Pilih maksimal {MAX_INSTRUMENTS} di panel sebelah. Setelah dipilih, hanya instrumen itu yang dirender
                dan hanya itu yang memakai kuota.
              </p>
            </div>
          ) : (
            view.instruments.map(item => {
              const bars = item.candles
              const last = bars.at(-1)
              const previous = bars.at(-2)
              // Change is computed for display only, from stored closes. It is
              // never fed into trade results.
              const delta = last && previous ? Number(last.close) - Number(previous.close) : null
              const rising = delta !== null && delta >= 0

              return (
                <article key={`${item.provider}:${item.symbol}`} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-mono text-sm font-medium">{item.symbol}</h2>
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-[9px] text-muted">
                          {item.state.kind === 'fresh' ? 'FRESH' : item.state.kind === 'stale' ? 'STALE' : 'BARU'}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted">
                        {bars.length} bar harian · {item.provider}
                        {item.state.kind !== 'absent' && ` · diambil ${new Date(item.state.retrievedAt).toISOString().slice(0, 16)}Z`}
                      </p>
                    </div>
                    {last && (
                      <div className="text-right">
                        <p className="font-mono text-lg">{formatPrice(last.close)}</p>
                        {delta !== null && (
                          <p className={`mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] ${rising ? 'text-accent' : 'text-danger'}`}>
                            {rising ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {delta >= 0 ? '+' : ''}{formatPrice(String(delta))}
                          </p>
                        )}
                        <p className="mt-1 text-[9px] text-muted">bar {String(last.time).slice(0, 10)}</p>
                      </div>
                    )}
                  </div>

                  {bars.length > 0 ? (
                    <div className="mt-4 space-y-1.5 border-t border-border pt-4">
                      {bars.slice(-5).reverse().map(bar => (
                        <div key={bar.time} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 font-mono text-[11px] text-muted">
                          <span>{String(bar.time).slice(0, 10)}</span>
                          <span>O {formatPrice(bar.open)}</span>
                          <span>H {formatPrice(bar.high)}</span>
                          <span className={bar.close >= bar.open ? 'text-accent' : 'text-danger'}>C {formatPrice(bar.close)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-border pt-4 text-xs text-muted">Belum ada bar tersimpan.</p>
                  )}

                  {/* A failed refresh keeps the old bars on screen and says so. */}
                  {item.failure && (
                    <p className="mt-3 rounded-lg border border-warning/20 bg-warning/[.05] px-3 py-2 text-[11px] text-warning">
                      Gagal memuat data terbaru: {item.failure.message}
                      {bars.length > 0 && ' Data lama di atas tetap ditampilkan apa adanya.'}
                    </p>
                  )}
                </article>
              )
            })
          )}

          {totalBars > 0 && (
            <p className="text-[10px] leading-4 text-muted">
              Attribution: Data provided by Twelve Data (twelvedata.com). Waktu bar mengikuti zona bursa sumber,
              bukan zona aplikasi.
            </p>
          )}
        </div>

        <InstrumentPicker
          selected={selected}
          catalogue={catalogue}
          max={MAX_INSTRUMENTS}
        />
      </div>
    </div>
  )
}
