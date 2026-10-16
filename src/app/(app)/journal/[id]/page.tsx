import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CircleAlert, Pencil } from 'lucide-react'
import { DeleteTradeButton } from '@/components/delete-trade-button'
import { getTrade } from '@/lib/trades/query'
import { realizedNetPnl, type Trade } from '@/lib/domain/trades'

export const dynamic = 'force-dynamic'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatMoney(value: string | null | undefined) {
  if (value == null) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right font-mono text-xs tabular">{value}</dd>
    </div>
  )
}

function Stars({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1" aria-label={value == null ? 'Tidak dinilai' : `${value} dari 5`}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} className={`h-2 w-4 rounded-sm ${value != null && n <= value ? 'bg-accent' : 'bg-secondary'}`} />
        ))}
        <span className="ml-2 font-mono text-xs tabular">{value ?? '—'}</span>
      </span>
    </div>
  )
}

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await getTrade(id)
  if (!row) notFound()

  const trade: Trade = {
    id: row.id, symbol: row.symbol, direction: row.direction, status: row.status,
    openedAt: row.opened_at, closedAt: row.closed_at, entryPrice: row.entry_price,
    exitPrice: row.exit_price, size: row.size, fees: row.fees, realizedPnl: row.realized_pnl,
  }
  const net = realizedNetPnl(trade)
  const netValue = net === null ? '—' : formatMoney(net.toFixed(2))
  const isClosed = row.status === 'closed'
  const missingResult = isClosed && row.realized_pnl == null

  return (
    <div className="mx-auto max-w-[860px] space-y-7">
      <div>
        <Link href="/journal" className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground">
          <ArrowLeft size={14} />Kembali ke jurnal
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-3xl font-semibold tracking-tight">{row.symbol}</h1>
              <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase ${row.direction === 'long' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'}`}>{row.direction}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase ${isClosed ? 'bg-accent/10 text-accent' : 'bg-info/10 text-info'}`}>{row.status}</span>
            </div>
            <p className="mt-2 text-sm text-muted">Dibuka {formatDateTime(row.opened_at)} · {row.setup || 'tanpa setup'}{row.timeframe ? ` · ${row.timeframe}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/journal/${row.id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-xs font-medium hover:bg-secondary">
              <Pencil size={14} />Ubah
            </Link>
            <DeleteTradeButton id={row.id} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs text-muted">Hasil bersih</p>
          <p className={`mt-3 font-mono text-2xl tabular ${net === null ? 'text-muted' : net.gte(0) ? 'text-positive' : 'text-negative'}`}>{netValue}</p>
          <p className="mt-2 text-[11px] text-muted">Realized P&L dikurangi fee tercatat</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs text-muted">Realized P&L</p>
          <p className="mt-3 font-mono text-2xl tabular">{formatMoney(row.realized_pnl)}</p>
          <p className="mt-2 text-[11px] text-muted">Diisi manual oleh kamu</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs text-muted">Fees</p>
          <p className="mt-3 font-mono text-2xl tabular">{formatMoney(row.fees)}</p>
          <p className="mt-2 text-[11px] text-muted">Biaya tercatat</p>
        </div>
      </div>

      {missingResult && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/[.05] p-4">
          <CircleAlert size={17} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-xs font-medium text-warning">Hasil belum tercatat</p>
            <p className="mt-1 text-xs leading-5 text-muted">Trade ini tertutup tetapi belum punya realized P&L manual, jadi tidak dihitung di analytics. Ubah trade untuk mengisinya.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Eksekusi</h2>
          <dl className="mt-4">
            <Row label="Entry price" value={row.entry_price} />
            <Row label="Exit price" value={row.exit_price ?? '—'} />
            <Row label="Position size" value={row.size} />
            <Row label="Stop loss" value={row.stop_loss ?? '—'} />
            <Row label="Take profit" value={row.take_profit ?? '—'} />
            <Row label="Ditutup pada" value={formatDateTime(row.closed_at)} />
            <Row label="Alasan keluar" value={row.exit_reason ?? '—'} />
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Refleksi</h2>
          <dl className="mt-4">
            <Stars label="Kualitas setup" value={row.setup_grade} />
            <Stars label="Kualitas eksekusi" value={row.execution_quality} />
            <Row label="Mengikuti rencana" value={row.plan_adherence == null ? 'Tidak dicatat' : row.plan_adherence ? 'Ya' : 'Tidak'} />
            <Row label="Emosi dominan" value={row.emotion ?? '—'} />
          </dl>
          <div className="mt-4 rounded-lg border border-border bg-[#0a1115] p-3">
            <p className="text-[11px] text-muted">Catatan</p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5">{row.notes || 'Tidak ada catatan untuk trade ini.'}</p>
          </div>
        </section>
      </div>

      <p className="text-[11px] leading-5 text-muted">Semua nilai di halaman ini berasal dari catatanmu sendiri. Tidak ada harga pasar, saldo broker, atau hasil yang disimpulkan dari pergerakan harga.</p>
    </div>
  )
}
