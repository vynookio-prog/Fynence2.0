'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { saveTrade, updateTrade, type TradeActionState } from '@/app/trade-actions'
import type { Account } from '@/lib/accounts/query'

export type TradeFormValues = {
  id?: string
  account_id: string
  symbol: string
  direction: string
  status: string
  opened_at: string
  closed_at: string
  entry_price: string
  exit_price: string
  size: string
  fees: string
  realized_pnl: string
  setup: string
  timeframe: string
  stop_loss: string
  take_profit: string
  exit_reason: string
  notes: string
  setup_grade: string
  execution_quality: string
  plan_adherence: string
  emotion: string
}

const initial: TradeActionState = {}
const fields = 'h-11 w-full rounded-lg border border-border bg-[#0a1115] px-3 text-sm outline-none transition focus:border-accent/50'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-muted">{hint}</span>}
    </label>
  )
}

export function TradeForm({ mode, values, accounts }: { mode: 'create' | 'edit'; values: TradeFormValues; accounts: Account[] }) {
  const isEdit = mode === 'edit'
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<TradeFormValues>(values)
  const [state, formAction, pending] = useActionState(isEdit ? updateTrade : saveTrade, initial)
  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const steps = ['Detail trade', 'Rencana', 'Refleksi']

  return (
    <div className="mx-auto max-w-[760px] space-y-7">
      <div>
        <Link href={isEdit ? `/journal/${values.id}` : '/journal'} className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground">
          <ArrowLeft size={14} />{isEdit ? 'Kembali ke detail trade' : 'Kembali ke jurnal'}
        </Link>
        <p className="mt-5 text-xs font-medium uppercase tracking-[.14em] text-accent">Input manual · Tanpa koneksi broker</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{isEdit ? 'Ubah trade' : 'Catat trade'}</h1>
        <p className="mt-2 text-sm text-muted">Catat apa yang terjadi, lalu tinjau cara kamu mengeksekusinya.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {steps.map((x, i) => (
          <div key={x} className={`rounded-lg border p-3 ${step === i + 1 ? 'border-accent/30 bg-accent/[.06]' : 'border-border bg-surface'}`}>
            <div className="flex items-center gap-2">
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${step > i + 1 ? 'bg-accent text-[#06251a]' : step === i + 1 ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted'}`}>
                {step > i + 1 ? <Check size={12} /> : i + 1}
              </span>
              <span className={`text-[11px] ${step === i + 1 ? 'text-foreground' : 'text-muted'}`}>{x}</span>
            </div>
          </div>
        ))}
      </div>

      <form action={formAction} className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-7">
        {isEdit && <input type="hidden" name="id" value={values.id} />}
        <input type="hidden" name="account_id" value={form.account_id} />
        <input type="hidden" name="symbol" value={form.symbol} />
        <input type="hidden" name="direction" value={form.direction} />
        <input type="hidden" name="status" value={form.status} />
        <input type="hidden" name="opened_at" value={form.opened_at} />
        <input type="hidden" name="closed_at" value={form.closed_at} />
        <input type="hidden" name="entry_price" value={form.entry_price} />
        <input type="hidden" name="exit_price" value={form.exit_price} />
        <input type="hidden" name="size" value={form.size} />
        <input type="hidden" name="fees" value={form.fees} />
        <input type="hidden" name="realized_pnl" value={form.realized_pnl} />
        <input type="hidden" name="stop_loss" value={form.stop_loss} />
        <input type="hidden" name="take_profit" value={form.take_profit} />
        <input type="hidden" name="setup" value={form.setup} />
        <input type="hidden" name="timeframe" value={form.timeframe} />
        <input type="hidden" name="exit_reason" value={form.exit_reason} />
        <input type="hidden" name="notes" value={form.notes} />
        <input type="hidden" name="setup_grade" value={form.setup_grade} />
        <input type="hidden" name="execution_quality" value={form.execution_quality} />
        <input type="hidden" name="plan_adherence" value={form.plan_adherence} />
        <input type="hidden" name="emotion" value={form.emotion} />

        {step === 1 && <>
          <div>
            <h2 className="text-sm font-semibold">Detail trade</h2>
            <p className="mt-1 text-xs text-muted">Instrumen, arah, dan detail eksekusi.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Akun" hint={accounts.length ? 'Kelompokkan trade ke satu akun' : 'Belum ada akun — trade tetap bisa disimpan tanpa akun'}>
              <select name="account_id" value={form.account_id} onChange={update} className={fields}>
                <option value="">Tanpa akun</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.base_currency})</option>)}
              </select>
            </Field>
            <Field label="Symbol"><input required name="symbol" value={form.symbol} onChange={update} placeholder="mis. XAUUSD" className={fields} /></Field>
            <Field label="Arah"><select name="direction" value={form.direction} onChange={update} className={fields}><option value="long">Long</option><option value="short">Short</option></select></Field>
            <Field label="Status"><select name="status" value={form.status} onChange={update} className={fields}><option value="closed">Closed</option><option value="open">Open</option></select></Field>
            <Field label="Dibuka pada"><input required type="datetime-local" name="opened_at" value={form.opened_at} onChange={update} className={fields} /></Field>
            <Field label="Entry price"><input required min="0" step="any" type="number" name="entry_price" value={form.entry_price} onChange={update} placeholder="0.00" className={fields} /></Field>
            <Field label="Position size"><input required min="0" step="any" type="number" name="size" value={form.size} onChange={update} placeholder="0.00" className={fields} /></Field>
            {form.status === 'closed' && <>
              <Field label="Exit price"><input required min="0" step="any" type="number" name="exit_price" value={form.exit_price} onChange={update} placeholder="0.00" className={fields} /></Field>
              <Field label="Ditutup pada"><input required type="datetime-local" name="closed_at" value={form.closed_at} onChange={update} className={fields} /></Field>
            </>}
            <Field label="Realized P&L" hint="Hasil manual dalam mata uang akun. Jangan dihitung dari selisih harga."><input step="any" type="number" name="realized_pnl" value={form.realized_pnl} onChange={update} placeholder="Diisi manual" className={fields} /></Field>
            <Field label="Fees" hint="Total biaya untuk trade ini"><input min="0" step="any" type="number" name="fees" value={form.fees} onChange={update} className={fields} /></Field>
          </div>
        </>}

        {step === 2 && <>
          <div>
            <h2 className="text-sm font-semibold">Rencana trade</h2>
            <p className="mt-1 text-xs text-muted">Risiko, target, dan setup dalam kata-katamu sendiri.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stop loss"><input min="0" step="any" type="number" name="stop_loss" value={form.stop_loss} onChange={update} placeholder="Opsional" className={fields} /></Field>
            <Field label="Take profit"><input min="0" step="any" type="number" name="take_profit" value={form.take_profit} onChange={update} placeholder="Opsional" className={fields} /></Field>
            <Field label="Setup"><input name="setup" value={form.setup} onChange={update} placeholder="mis. Breakout retest" className={fields} /></Field>
            <Field label="Timeframe"><select name="timeframe" value={form.timeframe} onChange={update} className={fields}><option value="">Pilih timeframe</option>{['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'].map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Alasan keluar"><input name="exit_reason" value={form.exit_reason} onChange={update} placeholder="mis. Target tercapai" className={fields} /></Field>
            <Field label="Emosi dominan"><select name="emotion" value={form.emotion} onChange={update} className={fields}><option value="">Tidak dicatat</option>{['Tenang', 'Ragu', 'Terburu-buru', 'Takut', 'Serakah', 'Percaya diri'].map(e => <option key={e} value={e}>{e}</option>)}</select></Field>
          </div>
        </>}

        {step === 3 && <>
          <div>
            <h2 className="text-sm font-semibold">Refleksi</h2>
            <p className="mt-1 text-xs text-muted">Catat konteks keputusan. Ini penilaian diri, bukan diagnosis.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kualitas setup (1–5)"><select name="setup_grade" value={form.setup_grade} onChange={update} className={fields}><option value="">Tidak dinilai</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="Kualitas eksekusi (1–5)"><select name="execution_quality" value={form.execution_quality} onChange={update} className={fields}><option value="">Tidak dinilai</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="Mengikuti rencana?"><select name="plan_adherence" value={form.plan_adherence} onChange={update} className={fields}><option value="">Tidak dicatat</option><option value="yes">Ya</option><option value="no">Tidak</option></select></Field>
          </div>
          <Field label="Catatan"><textarea name="notes" rows={6} value={form.notes} onChange={update} placeholder="Apa rencanamu? Apa yang dieksekusi dengan baik? Apa yang perlu ditinjau?" className={`${fields} h-auto resize-y py-3`} /></Field>
          <p className="rounded-lg border border-border bg-[#0a1115] p-3 text-[11px] leading-5 text-muted">Realized P&L tidak disimpulkan dari pergerakan harga. Isi manual setelah akun, multiplier, dan perilaku mata uang dirancang.</p>
        </>}

        {state?.error && <p role="alert" className="rounded-lg border border-negative/20 bg-negative/[.06] p-3 text-xs text-negative">{state.error}</p>}
        {state?.success && <p role="status" className="rounded-lg border border-accent/20 bg-accent/[.06] p-3 text-xs text-accent">{state.success}</p>}

        <div className="flex items-center justify-between border-t border-border pt-5">
          <button type="button" onClick={() => step === 1 ? location.assign(isEdit ? `/journal/${values.id}` : '/journal') : setStep(step - 1)} className="min-h-10 rounded-lg border border-border px-4 text-xs text-muted hover:bg-secondary">
            {step === 1 ? 'Batal' : 'Kembali'}
          </button>
          {step < 3
            ? <button type="button" onClick={() => setStep(step + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a]">Lanjut<ArrowRight size={14} /></button>
            : <button disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a] disabled:opacity-60">{pending && <LoaderCircle size={14} className="animate-spin" />}{isEdit ? 'Simpan perubahan' : 'Simpan trade'}</button>}
        </div>
      </form>
    </div>
  )
}
