'use client'
import { useActionState, useOptimistic } from 'react'
import { ListPlus, LoaderCircle } from 'lucide-react'
import { saveWatchlist, type WatchlistState } from '@/app/watchlist-actions'

const initial: WatchlistState = {}

export function WatchlistEditor({ symbols }: { symbols: string[] }) {
  const [state, formAction, pending] = useActionState(saveWatchlist, initial)
  const [optimistic, setOptimistic] = useOptimistic(symbols, (_current, next: string[]) => next)

  return (
    <form
      action={async (formData: FormData) => {
        const parsed = [...new Set(String(formData.get('symbols') ?? '').split(/[\n,]/).map(s => s.trim().toUpperCase()).filter(Boolean))]
        setOptimistic(parsed)
        formAction(formData)
      }}
      className="rounded-xl border border-border bg-surface p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Watchlist</h2>
          <p className="mt-1 text-xs text-muted">
            {optimistic.length ? `${optimistic.length} symbol dipantau` : 'Belum ada symbol dipantau'}
          </p>
        </div>
        <ListPlus size={16} className="mt-0.5 shrink-0 text-muted" />
      </div>

      {optimistic.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {optimistic.map(s => (
            <span key={s} className="rounded-md border border-border bg-[#0a1115] px-2.5 py-1 font-mono text-[11px]">{s}</span>
          ))}
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-medium">Symbol <span className="font-normal text-muted">(pisahkan dengan koma atau baris baru)</span></span>
        <textarea
          name="symbols"
          rows={3}
          defaultValue={symbols.join(', ')}
          placeholder="XAUUSD, BTCUSD, US500"
          className="w-full resize-y rounded-lg border border-border bg-[#0a1115] px-3 py-2.5 font-mono text-xs outline-none focus:border-accent/50"
        />
      </label>
      <input type="hidden" name="name" value="Utama" />

      {state?.error && <p role="alert" className="mt-3 rounded-lg border border-negative/20 bg-negative/[.06] p-3 text-xs text-negative">{state.error}</p>}
      {state?.success && <p role="status" className="mt-3 rounded-lg border border-accent/20 bg-accent/[.06] p-3 text-xs text-accent">{state.success}</p>}

      <button disabled={pending} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a] disabled:opacity-50">
        {pending ? <LoaderCircle size={14} className="animate-spin" /> : <ListPlus size={14} />}
        Simpan watchlist
      </button>
      <p className="mt-3 text-[11px] leading-5 text-muted">
        Symbol di sini hanya daftar pantauanmu. Tidak ada kuotasi yang diambil atau ditampilkan sampai sumber pasar terverifikasi.
      </p>
    </form>
  )
}
