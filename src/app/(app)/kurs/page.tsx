import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarClock, Info, Percent, ShieldCheck } from 'lucide-react'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { loadRates } from '@/lib/rates/store'
import {
  DEFAULT_DISPLAY_CURRENCY,
  convertForDisplay,
  isDisplayCurrency,
  pairKey,
  sumForDisplay,
} from '@/lib/domain/currency'

export const dynamic = 'force-dynamic'

/**
 * Reference rates, and a worked conversion.
 *
 * Two things this page is careful about:
 *
 * - The rate's own effective date is shown, not the date of the request. Asking
 *   for a weekend returns the last business day, and presenting that as "today"
 *   would be wrong.
 * - The conversion is a demonstration of the display path, using the same
 *   functions the portfolio will use. It converts a figure the user typed; it
 *   never re-derives a recorded trade result.
 */

/** Pairs shown as a reference table. Anchored on USD, which is what most trades use. */
const DISPLAY_PAIRS: [string, string][] = [
  ['USD', 'IDR'],
  ['USD', 'EUR'],
  ['USD', 'GBP'],
  ['USD', 'JPY'],
  ['USD', 'SGD'],
  ['USD', 'AUD'],
  ['EUR', 'IDR'],
  ['EUR', 'USD'],
]

function formatRate(value: string): string {
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return value
  // Small rates need more digits to be meaningful than large ones.
  const digits = Math.abs(asNumber) >= 100 ? 2 : 4
  return asNumber.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export default async function KursPage() {
  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const user = auth?.user

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Masuk dulu untuk melihat kurs referensi.</p>
      </div>
    )
  }

  const { data: profile } = await client.database
    .from('profiles')
    .select('display_currency')
    .eq('id', user.id)
    .limit(1)

  const configured = (profile?.[0] as { display_currency?: string | null } | undefined)?.display_currency
  const target = isDisplayCurrency(configured) ? configured : DEFAULT_DISPLAY_CURRENCY

  const { rates, rateDate } = await loadRates(['USD', 'EUR', 'GBP', 'JPY', 'IDR', 'SGD', 'AUD'], target)

  // A worked example, so the conversion is shown rather than only described.
  const sample = convertForDisplay('1000', 'USD', target, rates)
  const sampleTotal = sumForDisplay(
    [{ amount: '1000', currency: 'USD' }, { amount: '500', currency: 'EUR' }],
    target,
    rates,
  )

  const available = DISPLAY_PAIRS
    .map(([base, quote]) => ({ base, quote, lookup: rates.get(pairKey(base, quote)) }))

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Reference data</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Kurs Referensi</h1>
          <p className="mt-2 text-sm text-muted">
            Kurs harian dari bank sentral dan sumber resmi, untuk menampilkan nilai dalam satu mata uang.
          </p>
        </div>
        {rateDate && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] text-muted">
            <CalendarClock size={11} />Efektif {rateDate}
          </span>
        )}
      </div>

      {/* The licence here is permissive, and saying so is the point of contrast
          with the market data page. */}
      <div className="flex gap-3 rounded-xl border border-accent/20 bg-accent/[.04] p-4">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-xs font-medium">Bebas dipakai komersial, tanpa kuota</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Rate blended adalah perhitungan Frankfurter sendiri dan bebas dipakai. Tidak ada batas harian, dan
            menyimpan kurs secara lokal memang dianjurkan penyedianya.
          </p>
        </div>
      </div>

      {/* Not a live price. Saying so prevents the most likely misreading. */}
      <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
        <Info size={17} className="mt-0.5 shrink-0 text-muted" />
        <div>
          <p className="text-xs font-medium">Ini bukan harga live</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Kurs ini mid-market harian, bukan bid/ask, dan penyedianya menyatakan tidak dibangun untuk live trading.
            Permintaan pada akhir pekan atau hari libur mundur ke hari bursa terakhir — tanggal efektif di atas
            adalah tanggal rate itu sendiri, bukan tanggal permintaan.
          </p>
        </div>
      </div>

      {!rateDate ? (
        <div className="rounded-xl border border-warning/20 bg-warning/[.045] p-6">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle size={16} />
            <p className="text-xs font-medium">Belum ada kurs tersimpan</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Tabel tidak bisa ditampilkan karena datanya belum ada. Nilai tidak dikarang-karang.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Kurs harian</h2>
              <span className="text-[11px] text-muted">{available.length} pasangan</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-[#0e1519] text-[10px] uppercase tracking-[.1em] text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">Pasangan</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Kurs</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map(({ base, quote, lookup }) => (
                    <tr key={`${base}${quote}`} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="px-3 py-2.5 text-left font-mono text-[12px] font-normal">
                        <span className="text-foreground">{base}</span>
                        <span className="mx-1 text-muted">/</span>
                        <span className="text-foreground">{quote}</span>
                      </th>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]">
                        {lookup ? formatRate(lookup.rate) : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[11px] text-muted">
                        {lookup?.rateDate ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-muted">
              Attribution: Rates provided by Frankfurter (frankfurter.dev).
            </p>
          </section>

          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Mata uang tampilan</h2>
                <Link href="/settings" className="text-[11px] text-accent hover:underline">Ubah</Link>
              </div>
              <p className="mt-3 font-mono text-2xl">{target}</p>
              <p className="mt-1 text-[11px] text-muted">
                Total portfolio ditampilkan dalam mata uang ini.
              </p>
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Percent size={14} className="text-muted" />Contoh konversi
              </h2>
              {sample ? (
                <>
                  <div className="mt-3 flex items-baseline justify-between font-mono text-[12px]">
                    <span className="text-muted">1,000.00 USD</span>
                    <ArrowRight size={13} className="text-muted" />
                    <span>{Number(sample.amount).toLocaleString('en-US')} {sample.to}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-muted">
                    1 USD = {formatRate(sample.rate)} {sample.to} · rate {sample.rateDate}
                  </p>

                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-[10px] uppercase tracking-[.1em] text-muted">Total campuran</p>
                    <p className="mt-1.5 font-mono text-lg">
                      {Number(sampleTotal.total).toLocaleString('en-US')} {sampleTotal.currency}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      1,000 USD + 500 EUR
                    </p>
                    {!sampleTotal.complete && (
                      <p className="mt-2 rounded-md border border-warning/20 bg-warning/[.05] px-2 py-1.5 text-[10px] text-warning">
                        Sebagian tidak bisa dikonversi ({sampleTotal.missing.join(', ')}), jadi total ini tidak lengkap.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Tidak ada kurs yang cocok, jadi tidak ada angka yang ditampilkan.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">Yang tidak dilakukan kurs ini</h2>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                Hasil trade yang kamu catat tidak pernah dihitung ulang dari kurs. P&amp;L tetap angka yang kamu
                masukkan. Kurs hanya mengubah cara sebuah total ditampilkan, dan tanggal rate-nya selalu ikut
                ditampilkan supaya bisa diperiksa.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
