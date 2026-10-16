import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Activity, ArrowLeft, CalendarClock, Database, Info, ShieldAlert } from 'lucide-react'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { listCatalogue, listSelected, readStoredCandles } from '@/lib/market/view'
import { buildIndicators, rangePosition } from '@/lib/market/indicators'
import { CandleChart } from '@/components/candle-chart'

export const dynamic = 'force-dynamic'

/**
 * Instrument detail.
 *
 * Replaces a placeholder that rendered four named scores ("Edge Factor", "Flow",
 * "Bearing", "Pulse") as em-dashes. Those names imply a method that does not
 * exist in this codebase. Showing a proprietary-looking score backed by nothing
 * is worse than showing no score, because the label itself reads as a claim.
 *
 * What is shown instead is what can actually be computed from stored bars, using
 * definitions that are published and checkable. If the bars are not there, the
 * page says so.
 *
 * A symbol outside the catalogue is a 404 rather than an empty page: the
 * catalogue is the list of things verified to exist, and rendering an unknown
 * symbol would imply it was checked.
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

export default async function InstrumentPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params
  const symbol = decodeURIComponent(raw ?? '').toUpperCase()

  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const user = auth?.user

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Masuk dulu untuk melihat detail instrumen.</p>
      </div>
    )
  }

  const catalogue = await listCatalogue()
  const entry = catalogue.find(item => item.symbol.toUpperCase() === symbol)
  // Not in the verified catalogue. Rendering it would imply it was verified.
  if (!entry) notFound()

  const [selected, candles] = await Promise.all([
    listSelected(user.id),
    readStoredCandles(entry.provider, entry.symbol, '1day', 200),
  ])

  const indicators = buildIndicators(candles)
  const position = rangePosition(candles, 20)
  const last = candles.length ? candles[candles.length - 1] : null
  const isSelected = selected.some(item => item.provider === entry.provider && item.symbol === entry.symbol)

  return (
    <div className="space-y-7">
      <Link href="/macro" className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground">
        <ArrowLeft size={14} />Macro Desk
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Market Deep Dive</p>
          <h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight">{entry.symbol}</h1>
          <p className="mt-2 text-sm text-muted">
            {entry.instrumentType}
            {entry.exchange ? ` · ${entry.exchange}` : ''}
            {entry.currency ? ` · ${entry.currency}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {candles.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] text-muted">
              <CalendarClock size={11} />bar terakhir {formatBarTime(last!.time)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] text-muted">
            <Database size={11} />{candles.length} bar
          </span>
        </div>
      </div>

      {!isSelected && (
        <p className="flex gap-2 rounded-xl border border-border bg-surface p-4 text-xs leading-5 text-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Instrumen ini tidak ada di pilihanmu. Yang ditampilkan hanya bar yang kebetulan sudah
            tersimpan. Tambahkan di <Link href="/pasar" className="text-accent hover:underline">Pasar</Link> untuk
            menyegarkan datanya secara berkala.
          </span>
        </p>
      )}

      <div className="flex gap-3 rounded-xl border border-warning/20 bg-warning/[.045] p-4">
        <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-xs font-medium">Bar harian tersimpan, bukan kutipan live</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Angka di halaman ini dihitung dari data historis harian. Terakhir diperbarui saat cache
            disegarkan — tanggal bar terakhir di atas menunjukkan seberapa baru datanya. Bukan harga
            real-time, dan bukan rekomendasi.
          </p>
        </div>
      </div>

      {candles.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-border bg-surface text-center">
          <Activity size={24} className="text-muted" />
          <h2 className="mt-4 text-sm font-medium">Belum ada bar tersimpan</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted">
            Instrumen ini terverifikasi ada, tetapi datanya belum pernah terambil. Buka
            halaman Pasar sekali dengan instrumen ini dipilih, lalu kembali ke sini.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Close terakhir</p>
                <p className="mt-1 font-mono text-2xl">{formatPrice(last!.close)}</p>
              </div>
              {position !== null && (
                <p className="text-[10px] text-muted">
                  Posisi rentang 20 bar · <span className="font-mono text-foreground">{position.toFixed(1)}%</span>
                </p>
              )}
            </div>
            <div className="mt-6 h-[240px] w-full sm:h-[280px]">
              <CandleChart data={candles} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Indikator</h2>
            <p className="mt-1 text-xs text-muted">
              Definisi standar, dihitung dari bar yang tersimpan. Nilai yang tidak bisa dihitung
              ditampilkan kosong beserta jumlah bar yang kurang.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {indicators.values.map(value => (
                <div key={value.key} className="rounded-xl border border-border bg-surface p-4">
                  <dt className="text-[11px] text-muted">{value.label}</dt>
                  <dd className={`mt-2 font-mono text-lg ${value.value === null ? 'text-muted' : ''}`}>
                    {value.value ?? '—'}
                  </dd>
                  <dd className="mt-2 text-[10px] leading-4 text-muted">
                    {value.value === null ? `Perlu ${value.required} bar · tersedia ${indicators.barCount}` : value.note}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="text-[10px] leading-5 text-muted">
            Sumber bar: {entry.provider}. Rentang tersimpan {formatBarTime(indicators.earliestBar!)}
            {' — '}{formatBarTime(indicators.latestBar!)}. Angka ini turunan Fynence dari data penyedia,
            bukan terbitan penyedia.
          </p>
        </>
      )}
    </div>
  )
}
