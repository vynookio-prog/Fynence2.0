'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Search, SlidersHorizontal } from 'lucide-react'
import { DeleteTradeButton } from '@/components/delete-trade-button'
import { getInsForgeBrowserClient } from '@/lib/insforge/browser'

type Row = {
  id: string; symbol: string; direction: string; status: string
  account_id: string | null
  opened_at: string; closed_at: string | null
  entry_price: string; exit_price: string | null
  size: string; fees: string; realized_pnl: string | null
  setup: string | null; timeframe: string | null
}

const COLUMNS =
  'id,symbol,direction,status,account_id,opened_at,closed_at,entry_price,exit_price,size,fees,realized_pnl,setup,timeframe'

export default function JournalPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [page, setPage] = useState(0)
  const size = 20

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const client = getInsForgeBrowserClient()
        const { data: userData, error: userError } = await client.auth.getCurrentUser()
        if (userError || !userData?.user) throw new Error('Sesi berakhir. Silakan masuk kembali.')
        const [tradesResult, accountsResult] = await Promise.all([
          client.database.from('trades').select(COLUMNS).eq('user_id', userData.user.id).order('opened_at', { ascending: false }).limit(500),
          client.database.from('trading_accounts').select('id,name').eq('user_id', userData.user.id),
        ])
        if (tradesResult.error) throw new Error(tradesResult.error.message)
        if (alive) {
          setRows((tradesResult.data ?? []) as unknown as Row[])
          setAccounts((accountsResult.data ?? []) as unknown as { id: string; name: string }[])
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Jurnal tidak bisa dimuat.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const filtered = useMemo(
    () => rows.filter(r =>
      (!search || r.symbol.toLowerCase().includes(search.toLowerCase())) &&
      (status === 'all' || r.status === status) &&
      (accountFilter === 'all'
        || (accountFilter === 'none' ? r.account_id === null : r.account_id === accountFilter))),
    [rows, search, status, accountFilter],
  )
  const accountName = useMemo(() => {
    const map = new Map(accounts.map(a => [a.id, a.name]))
    return (id: string | null) => id ? map.get(id) ?? 'Akun dihapus' : null
  }, [accounts])
  const pageRows = filtered.slice(page * size, (page + 1) * size)
  const net = (r: Row) => r.realized_pnl == null ? '—' : `${Number(r.realized_pnl) - Number(r.fees) >= 0 ? '+' : ''}${(Number(r.realized_pnl) - Number(r.fees)).toFixed(2)}`

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Catatan trading kamu</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Jurnal trading</h1>
          <p className="mt-2 text-sm text-muted">{rows.length} trade tercatat · input manual saja</p>
        </div>
        <Link href="/journal/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-semibold text-[#06251a]">
          <ArrowRight size={15} />Catat trade
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
        <label className="flex h-10 min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-border bg-[#0a1115] px-3 text-muted">
          <Search size={15} />
          <input
            aria-label="Cari symbol"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Cari symbol..."
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
          />
        </label>
        <label className="sr-only" htmlFor="trade-status">Filter status</label>
        <select
          id="trade-status"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(0) }}
          className="h-10 rounded-lg border border-border bg-[#0a1115] px-3 text-xs text-muted"
        >
          <option value="all">Semua status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <label className="sr-only" htmlFor="trade-account">Filter akun</label>
        <select
          id="trade-account"
          value={accountFilter}
          onChange={e => { setAccountFilter(e.target.value); setPage(0) }}
          className="h-10 rounded-lg border border-border bg-[#0a1115] px-3 text-xs text-muted"
        >
          <option value="all">Semua akun</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value="none">Tanpa akun</option>
        </select>
        <span className="hidden h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted sm:flex">
          <SlidersHorizontal size={14} />{filtered.length} hasil
        </span>
      </div>

      {error && <p role="alert" className="rounded-lg border border-warning/20 bg-warning/[.06] p-3 text-xs text-warning">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="hidden grid-cols-[1.1fr_.6fr_1fr_1fr_.9fr_.7fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-[10px] font-medium uppercase tracking-wider text-muted md:grid">
          <span>Instrumen</span><span>Sisi</span><span>Dibuka</span><span>Setup</span><span>Akun</span><span>Status</span>
          <span className="text-right">Hasil bersih</span><span className="sr-only">Aksi</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-muted">Memuat jurnal privat…</div>
        ) : pageRows.length ? (
          <div className="divide-y divide-border">
            {pageRows.map(r => (
              <div key={r.id} className="grid gap-3 p-4 md:grid-cols-[1.1fr_.6fr_1fr_1fr_.9fr_.7fr_1fr_auto] md:items-center md:gap-4 md:px-5">
                <div className="flex items-center justify-between md:block">
                  <Link href={`/journal/${r.id}`} className="font-mono text-sm font-medium hover:text-accent">{r.symbol}</Link>
                  <span className={`rounded-full px-2 py-1 text-[10px] md:hidden ${r.status === 'open' ? 'bg-info/10 text-info' : 'bg-accent/10 text-accent'}`}>{r.status}</span>
                </div>
                <span className={`text-xs uppercase ${r.direction === 'long' ? 'text-positive' : 'text-negative'}`}>{r.direction}</span>
                <span className="text-xs text-muted">{new Date(r.opened_at).toLocaleString('id-ID')}</span>
                <span className="text-xs text-muted">{r.setup || '—'} {r.timeframe || ''}</span>
                <span className="hidden truncate text-xs text-muted md:block">{accountName(r.account_id) ?? 'Tanpa akun'}</span>
                <span className={`hidden text-xs capitalize md:block ${r.status === 'open' ? 'text-info' : 'text-accent'}`}>{r.status}</span>
                <span className={`font-mono text-xs tabular md:text-right ${r.realized_pnl == null ? 'text-muted' : ''}`}>{net(r)}</span>
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/journal/${r.id}`} className="hidden min-h-9 items-center rounded-lg px-2 text-[11px] text-muted hover:bg-secondary hover:text-foreground md:inline-flex">Detail</Link>
                  <DeleteTradeButton id={r.id} compact />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-7 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-[#111a1f] text-muted"><Clock3 size={19} /></div>
            <h2 className="mt-4 text-sm font-medium">{rows.length ? 'Tidak ada trade yang cocok' : 'Jurnalmu siap'}</h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
              {rows.length
                ? 'Ubah filter symbol atau status.'
                : 'Belum ada trade. Catat trade pertamamu secara manual. Catatanmu tidak butuh feed pasar atau koneksi broker.'}
            </p>
            {!rows.length && <Link href="/journal/new" className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-xs font-semibold text-[#06251a]">Catat trade pertama</Link>}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[11px] text-muted">
          <span>Menampilkan {filtered.length ? Math.min(page * size + 1, filtered.length) : 0}–{Math.min((page + 1) * size, filtered.length)} dari {filtered.length}</span>
          <div className="flex gap-2">
            <button aria-label="Halaman sebelumnya" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="grid h-8 w-8 place-items-center rounded border border-border disabled:opacity-40"><ChevronLeft size={15} /></button>
            <button aria-label="Halaman berikutnya" disabled={(page + 1) * size >= filtered.length} onClick={() => setPage(p => p + 1)} className="grid h-8 w-8 place-items-center rounded border border-border disabled:opacity-40"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
