import Link from 'next/link'
import { CalendarRange, FileText, ShieldCheck } from 'lucide-react'
import { buildReport, type PeriodKey } from '@/lib/domain/reports'
import { currencyComposition } from '@/lib/domain/analytics'
import { loadTradesWithCurrency } from '@/lib/trades/currency-query'

export const dynamic = 'force-dynamic'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: '7 hari' },
  { key: 'month', label: '30 hari' },
  { key: 'quarter', label: '90 hari' },
  { key: 'all', label: 'Semua' },
]

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: periodParam } = await searchParams
  const periodKey: PeriodKey = PERIODS.some(p => p.key === periodParam) ? (periodParam as PeriodKey) : 'month'

  const loaded = await loadTradesWithCurrency(1000)
  const trades = loaded.trades
  const loadError = loaded.error ?? ''

  // The report's money figures assume one currency. Where trades disagree, the
  // figures are withheld and the disagreement is named, rather than producing a
  // total that adds different currencies together.
  const composition = currencyComposition(trades)
  const mixedCurrency = !composition.uniform && composition.currencies.length > 1

  const report = buildReport(trades, periodKey, new Date())
  const range = periodKey === 'all'
    ? 'Seluruh catatan'
    : `${report.period.start.toLocaleDateString('id-ID', { dateStyle: 'medium' })} — ${report.period.end.toLocaleDateString('id-ID', { dateStyle: 'medium' })}`

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Ringkasan dari catatanmu</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Laporan</h1>
          <p className="mt-2 text-sm text-muted">Dibuat langsung dari jurnalmu. Tanpa AI, tanpa data pasar.</p>
        </div>
        <Link href="/journal" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-xs font-medium hover:bg-secondary">Buka jurnal</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
        <span className="flex items-center gap-2 pl-1 pr-2 text-[11px] text-muted"><CalendarRange size={14} />Periode</span>
        {PERIODS.map(p => (
          <Link
            key={p.key}
            href={`/reports?period=${p.key}`}
            className={`inline-flex min-h-9 items-center rounded-lg px-3 text-xs ${p.key === periodKey ? 'bg-accent/10 font-medium text-accent' : 'text-muted hover:bg-secondary hover:text-foreground'}`}
          >
            {p.label}
          </Link>
        ))}
        <span className="ml-auto pr-1 text-[11px] text-muted">{range}</span>
      </div>

      {loadError && <p role="alert" className="rounded-lg border border-warning/20 bg-warning/[.06] p-3 text-xs text-warning">Laporan tidak bisa dimuat: {loadError}</p>}

      {mixedCurrency && (
        <p className="rounded-lg border border-warning/20 bg-warning/[.05] p-4 text-xs leading-5 text-warning">
          Trade pada periode ini tercatat dalam {composition.currencies.join(', ')}. Angka uang tidak digabung lintas
          mata uang, jadi metrik yang bergantung padanya tidak ditampilkan.
        </p>
      )}

      {report.tradeCount === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <FileText size={22} className="mx-auto text-muted" />
          <h2 className="mt-4 text-sm font-medium">Belum ada trade pada periode ini</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted">Laporan dibentuk dari catatan jurnalmu. Tidak ada ringkasan yang dibuat ketika datanya kosong.</p>
          <Link href="/journal/new" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a]">Catat trade</Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {report.sections.map(section => (
            <section key={section.heading} className="rounded-xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="text-sm font-semibold">{section.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {section.lines.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-5 text-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-accent/15 bg-[linear-gradient(120deg,rgba(53,211,154,.06),rgba(14,21,27,.8)_52%)] p-4">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-xs font-medium">Batas data</p>
          <p className="mt-1 text-xs leading-5 text-muted">Laporan dibuat {report.generatedAt ? new Date(report.generatedAt).toLocaleString('id-ID') : '—'}. Semua angka adalah hitungan atau nilai yang kamu catat sendiri. Tidak ada proyeksi, rekomendasi, atau data pasar.</p>
        </div>
      </div>
    </div>
  )
}
