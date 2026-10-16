'use client'

import { useActionState, useMemo, useState } from 'react'
import { Check, Loader2, Plus, Search, X } from 'lucide-react'
import { addInstrument, removeInstrument, type SelectionResult } from '@/app/pasar/selection-actions'
import type { CatalogueEntry, SelectedInstrument } from '@/lib/market/selection'

/**
 * Instrument selection.
 *
 * The catalogue is large enough now that one flat list is unusable, so entries
 * are grouped by the provider's own instrument type and filtered by a search
 * box. Grouping is a presentation choice only: nothing here decides what is
 * available, it only arranges what the server already confirmed.
 *
 * A gated or unsupported symbol is absent from the catalogue rather than shown
 * greyed out, so a user cannot spend one of five slots on something that fails
 * to load.
 */

type Props = {
  selected: SelectedInstrument[]
  catalogue: CatalogueEntry[]
  max: number
}

/** Display order and labels for the provider's instrument types. */
const GROUPS: { match: string; label: string }[] = [
  { match: 'Common Stock', label: 'Saham Nasdaq' },
  { match: 'ETF', label: 'ETF' },
  { match: 'Digital Currency', label: 'Crypto' },
  { match: 'Physical Currency', label: 'Forex' },
  { match: 'Precious Metal', label: 'Logam mulia' },
]

function groupLabel(instrumentType: string): string {
  return GROUPS.find(group => group.match === instrumentType)?.label ?? instrumentType
}

export function InstrumentPicker({ selected, catalogue, max }: Props) {
  const [addState, add] = useActionState<SelectionResult | null, FormData>(addInstrument, null)
  const [removeState, remove] = useActionState<SelectionResult | null, FormData>(removeInstrument, null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const chosen = new Set(selected.map(item => `${item.provider}:${item.symbol}`))
  const atCapacity = selected.length >= max

  const { grouped, total } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const remaining = catalogue.filter(entry => {
      if (chosen.has(`${entry.provider}:${entry.symbol}`)) return false
      if (!needle) return true
      return entry.symbol.toLowerCase().includes(needle)
        || entry.instrumentType.toLowerCase().includes(needle)
        || groupLabel(entry.instrumentType).toLowerCase().includes(needle)
    })

    const buckets = new Map<string, CatalogueEntry[]>()
    for (const entry of remaining) {
      const label = groupLabel(entry.instrumentType)
      buckets.set(label, [...(buckets.get(label) ?? []), entry])
    }

    // Ordered by GROUPS, then anything unrecognised alphabetically at the end.
    const order = GROUPS.map(group => group.label)
    const sorted = [...buckets.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0])
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0])
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

    return { grouped: sorted, total: remaining.length }
  }, [catalogue, chosen, query])

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Instrumen kamu</h2>
          <span className={`text-[11px] ${atCapacity ? 'text-warning' : 'text-muted'}`}>
            {selected.length}/{max}
          </span>
        </div>

        {selected.length === 0 ? (
          <p className="mt-3 text-xs leading-5 text-muted">
            Belum ada yang dipilih. Pilih maksimal {max} — hanya yang ini yang diambil datanya.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {selected.map(item => {
              const key = `${item.provider}:${item.symbol}`
              const entry = catalogue.find(c => c.provider === item.provider && c.symbol === item.symbol)
              return (
                <li key={key} className="flex items-center justify-between rounded-lg border border-border bg-[#0e1519] px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Check size={13} className="shrink-0 text-accent" />
                      <span className="font-mono text-[13px]">{item.symbol}</span>
                    </div>
                    <p className="mt-0.5 pl-5 text-[10px] text-muted">
                      {entry ? groupLabel(entry.instrumentType) : item.provider}
                    </p>
                  </div>
                  <form action={remove}>
                    <input type="hidden" name="provider" value={item.provider} />
                    <input type="hidden" name="symbol" value={item.symbol} />
                    <button
                      type="submit"
                      aria-label={`Hapus ${item.symbol} dari daftar`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition hover:bg-white/[.06] hover:text-danger"
                      onClick={() => setBusyKey(key)}
                    >
                      {busyKey === key ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}

        {removeState && !removeState.ok && <p className="mt-3 text-xs text-danger">{removeState.error}</p>}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tersedia</h2>
          <span className="text-[11px] text-muted">{catalogue.length} terverifikasi</span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted">
          Hanya instrumen yang sudah terbukti bisa diakses pada plan saat ini.
        </p>

        <div className="relative mt-3">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Cari simbol, mis. BTC atau saham"
            aria-label="Cari instrumen"
            className="w-full rounded-lg border border-border bg-[#0e1519] py-2 pl-9 pr-3 text-[12px] text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none"
          />
        </div>

        {total === 0 ? (
          <p className="mt-3 text-xs text-muted">
            {atCapacity ? 'Semua slot sudah terpakai.' : query ? 'Tidak ada yang cocok.' : 'Semua instrumen tersedia sudah dipilih.'}
          </p>
        ) : (
          <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {grouped.map(([label, entries]) => (
              <div key={label}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-muted">
                  {label} <span className="font-normal normal-case tracking-normal">· {entries.length}</span>
                </p>
                <ul className="space-y-1.5">
                  {entries.map(entry => (
                    <li key={`${entry.provider}:${entry.symbol}`}>
                      <form action={add}>
                        <input type="hidden" name="provider" value={entry.provider} />
                        <input type="hidden" name="symbol" value={entry.symbol} />
                        <button
                          type="submit"
                          disabled={atCapacity}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-[#0e1519] px-3 py-2 text-left transition enabled:hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Plus size={13} className="shrink-0 text-muted" />
                            <span className="truncate font-mono text-[12px]">{entry.symbol}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-muted">{entry.exchange ?? entry.provider}</span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {atCapacity && (
          <p className="mt-3 text-[11px] text-warning">
            Batas {max} instrumen tercapai. Hapus satu untuk menambah yang lain.
          </p>
        )}
        {addState && !addState.ok && <p className="mt-3 text-xs text-danger">{addState.error}</p>}
      </section>

      <p className="text-[10px] leading-4 text-muted">
        Data pasar disediakan Twelve Data. Plan Individual hanya untuk pemakaian pribadi/internal.
      </p>
    </div>
  )
}
