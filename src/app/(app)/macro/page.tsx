import Link from 'next/link'
import { Activity, ArrowRight, CalendarClock, Database, Info, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { listCatalogue, listSelected, readStoredCandles } from '@/lib/market/view'
import { buildIndicators, rangePosition } from '@/lib/market/indicators'
import type { Candle } from '@/lib/market/provider'

export const dynamic = 'force-dynamic'

/**
 * Macro Desk.
 *
 * Rebuilt on the verified catalogue. The previous version listed five symbols
 * (US30, US500, MNQ, XAUUSD, BTCUSD) that had never been checked: US30 came back
 * `coverage: missing`, US500 and MNQ were absent from the catalogue entirely,
 * and XAUUSD could never match the stored XAU/USD. It also had no way to reach
 * the ~120 real daily bars already in the database, so it correctly said
 * "unavailable" while the data sat one table away.
 *
 * Two things this page will not do:
 *
 * - Show a symbol the catalogue has not verified. It renders the user's actual
 *   selection, and an explicit empty state when there is none.
 * - Treat a calculation as a source. Every figure is derived from stored bars
 *   that carry their own provider and bar time, and the bar dates are shown so
 *   the reader can judge how current the inputs are.
 *
 * Reads are cache-only. Opening this page spends no provider credits.
 */

function formatPrice(value: string): string {
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return value
  return asNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function formatBarTime(time: string): string {
  const date = new Date(time)
  if (Number.isNaN(date.valueOf())) return time.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export default async function MacroPage() {
  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const user = auth?.user

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Masuk dulu untuk melihat Macro Desk.</p>
      </div>
    )
  }

  const [selected, catalogue] = await Promise.all([listSelected(user.id), listCatalogue()])
  const catalogueByPair = new Map(catalogue.map(entry => [`${entry.provider}:${entry.symbol}`, entry]))

  // Cache-only: readStoredCandles touches the database and never the provider.
  const instruments = await Promise.all(
    selected.map(async item => {
      const candles: Candle[] = await readStoredCandles(item.provider, item.symbol, '1day', 200)
      const indicators = buildIndicators(candles)
      const last = candles.length ? candles[candles.length - 1] : null
      const previous = candles.length > 1 ? candles[candles.length - 2] : null
      const dayChange = last && previous
        ? (() => {
            const before = Number(previous.close)
            if (!before) return null
            return ((Number(last.close) - before) / before) * 100
          })()
        : null

      return {
        item,
        entry: catalogueByPair.get(`${item.provider}:${item.symbol}`) ?? null,
        candles,
        indicators,
        last,
        dayChange,
        position: rangePosition(candles, 20),
      }
    }),
  )

  const withData = instruments.filter(i => i.candles.length > 0)
  const totalBars = instruments.reduce((sum, i) => sum + i.candles.length, 0)

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Market intelligence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Macro Desk</h1>
          <p className="mt-2 text-sm text-muted">
            Indikator dihitung dari bar harian tersimpan — bukan dari kutipan live.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] text-muted">
          <Database size={11} />
          {selected.length} dipilih · {totalBars} bar tersimpan
        </span>
      </div>

      {/* The distinction the numbers depend on, stated before the numbers. */}
      <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
        <Info size={17} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-xs font-medium">Turunan, bukan kutipan</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Setiap nilai di halaman ini dihitung Fynence dari bar yang tersimpan, memakai definisi
            standar yang bisa diperiksa. Tanggal bar terakhir ditampilkan di tiap kartu: bar harian
            bisa tertinggal beberapa hari, dan itu terlihat, bukan disembunyikan.
          </p>
        </div>
      </div>

      {/* The commercial gate applies to showing these figures to other users. */}
      <div className="flex gap-3 rounded-xl border border-warning/20 bg-warning/[.045] p-4">
        <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-xs font-medium">Lisensi penyedia data pasar belum menyetujui tampilan komersial</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Plan Individual yang dipakai saat ini untuk pemakaian personal/internal. Menampilkan angka
            turunan dari data ini ke pengguna lain tetap memerlukan hak redistribusi. Halaman ini
            jujur soal asal angkanya, bukan soal izin menampilkannya.
          </p>
        </div>
      </div>

      {!selected.length ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <Activity size={22} className="mx-auto text-muted" />
          <p className="mt-3 text-sm font-medium">Belum ada instrumen dipilih</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted">
            Macro Desk membaca instrumen yang sudah kamu pilih di halaman Pasar. Pilih sampai lima
            instrumen yang benar-benar terverifikasi di sana, lalu kembali ke sini.
          </p>
          <Link href="/pasar" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a]">
            Buka Pasar<ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {instruments.map(({ item, entry, candles, indicators, last, dayChange, position }) => {
            const hasBars = candles.length > 0
            const changeUp = dayChange !== null && dayChange >= 0
            return (
              <section key={`${item.provider}:${item.symbol}`} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-medium">{item.symbol}</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {entry?.instrumentType ?? 'Jenis tidak diketahui'}
                      {entry?.exchange ? ` · ${entry.exchange}` : ''}
                    </p>
                  </div>
                  {hasBars && dayChange !== null && (
                    <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${changeUp ? 'text-accent' : 'text-warning'}`}>
                      {changeUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {changeUp ? '+' : ''}{dayChange.toFixed(2)}%
                    </span>
                  )}
                </div>

                {!hasBars ? (
                  <p className="mt-4 rounded-lg border border-warning/20 bg-warning/[.05] px-3 py-2 text-[11px] leading-5 text-warning">
                    Belum ada bar tersimpan untuk instrumen ini. Buka halaman Pasar sekali supaya
                    datanya terambil — Macro Desk sendiri tidak memanggil penyedia.
                  </p>
                ) : (
                  <>
                    <div className="mt-4 flex items-baseline justify-between">
                      <span className="font-mono text-xl">{formatPrice(last!.close)}</span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                        <CalendarClock size={11} />bar {formatBarTime(last!.time)}
                      </span>
                    </div>

                    {position !== null && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[10px] text-muted">
                          <span>Posisi dalam rentang 20 bar</span>
                          <span className="font-mono">{position.toFixed(1)}%</span>
                        </div>
                        {/* A labelled bar beats a coloured one: the value is the fact. */}
                        <div
                          className="mt-1.5 h-1.5 rounded-full bg-[#0e1519]"
                          role="img"
                          aria-label={`Close berada di ${position.toFixed(1)} persen rentang 20 bar`}
                        >
                          <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(1, Math.min(100, Number(position)))}%` }} />
                        </div>
                      </div>
                    )}

                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
                      {indicators.values
                        .filter(v => v.key !== 'last')
                        .map(value => (
                          <div key={value.key}>
                            <dt className="text-[10px] text-muted" title={value.note}>{value.label}</dt>
                            <dd className={`mt-1 font-mono text-[13px] ${value.value === null ? 'text-muted' : ''}`}>
                              {value.value ?? '—'}
                            </dd>
                            {value.value === null && (
                              <dd className="mt-0.5 text-[9px] text-muted">
                                perlu {value.required} bar · ada {indicators.barCount}
                              </dd>
                            )}
                          </div>
                        ))}
                    </dl>
                  </>
                )}

                <Link
                  href={`/macro/${encodeURIComponent(item.symbol)}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-accent hover:underline"
                >
                  Detail<ArrowRight size={12} />
                </Link>
              </section>
            )
          })}
        </div>
      )}

      {selected.length > 0 && withData.length < selected.length && (
        <p className="text-[11px] leading-5 text-muted">
          {selected.length - withData.length} dari {selected.length} instrumen belum punya bar tersimpan.
          Itu ditampilkan apa adanya, bukan diisi angka nol.
        </p>
      )}
    </div>
  )
}
