'use client'

import { useActionState, useState } from 'react'
import { Check, Loader2, Plus, X } from 'lucide-react'
import { addInstrument, removeInstrument, type SelectionResult } from '@/app/pasar/selection-actions'
import type { CatalogueEntry, SelectedInstrument } from '@/lib/market/selection'

/**
 * Instrument selection.
 *
 * Two separate ideas are shown separately on purpose:
 *
 * - The selected list is what gets rendered and fetched. Capped at five.
 * - The catalogue is what a fetch has proven reachable. A symbol that is
 *   plan-gated or unsupported is absent from it rather than shown greyed out,
 *   so a user cannot spend one of their five slots on something that cannot
 *   load.
 */

type Props = {
  selected: SelectedInstrument[]
  catalogue: CatalogueEntry[]
  max: number
}

export function InstrumentPicker({ selected, catalogue, max }: Props) {
  const [addState, add] = useActionState<SelectionResult | null, FormData>(addInstrument, null)
  const [removeState, remove] = useActionState<SelectionResult | null, FormData>(removeInstrument, null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const chosen = new Set(selected.map(item => `${item.provider}:${item.symbol}`))
  const atCapacity = selected.length >= max
  const available = catalogue.filter(entry => !chosen.has(`${entry.provider}:${entry.symbol}`))

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
            Belum ada yang dipilih. Pilih maksimal {max} instrumen — hanya yang ini yang diambil datanya.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {selected.map(item => {
              const key = `${item.provider}:${item.symbol}`
              const busy = confirming === key
              return (
                <li key={key} className="flex items-center justify-between rounded-lg border border-border bg-[#0e1519] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Check size={14} className="text-accent" />
                    <span className="font-mono text-[13px]">{item.symbol}</span>
                    <span className="text-[10px] text-muted">{item.provider}</span>
                  </div>
                  <form action={remove}>
                    <input type="hidden" name="provider" value={item.provider} />
                    <input type="hidden" name="symbol" value={item.symbol} />
                    <button
                      type="submit"
                      aria-label={busy ? `Hapus ${item.symbol}` : `Hapus ${item.symbol} dan datanya`}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-white/[.06] hover:text-danger"
                      onClick={() => setConfirming(key)}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}

        {removeState && !removeState.ok && (
          <p className="mt-3 text-xs text-danger">{removeState.error}</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Tersedia</h2>
        <p className="mt-1 text-[11px] leading-4 text-muted">
          Hanya instrumen yang sudah terbukti bisa diakses pada plan saat ini. Yang terkunci plan tidak ditampilkan.
        </p>

        {available.length === 0 ? (
          <p className="mt-3 text-xs text-muted">
            {atCapacity ? 'Kamu sudah memakai semua slot.' : 'Semua instrumen yang tersedia sudah dipilih.'}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {available.map(entry => (
              <li key={`${entry.provider}:${entry.symbol}`}>
                <form action={add}>
                  <input type="hidden" name="provider" value={entry.provider} />
                  <input type="hidden" name="symbol" value={entry.symbol} />
                  <button
                    type="submit"
                    disabled={atCapacity}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-[#0e1519] px-3 py-2.5 text-left transition enabled:hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="flex items-center gap-3">
                      <Plus size={14} className="text-muted" />
                      <span className="font-mono text-[13px]">{entry.symbol}</span>
                      <span className="text-[10px] text-muted">{entry.instrumentType}</span>
                    </span>
                    <span className="text-[10px] text-muted">{entry.exchange ?? entry.provider}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
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
