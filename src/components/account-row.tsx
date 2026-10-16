'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, LoaderCircle, Pencil, Trash2, X } from 'lucide-react'
import { deleteAccount, updateAccount, type AccountActionState } from '@/app/account-actions'
import type { Account } from '@/lib/accounts/query'

const fields = 'h-10 w-full rounded-lg border border-border bg-[#0a1115] px-3 text-sm outline-none focus:border-accent/50'
const initial: AccountActionState = {}

const TYPE_LABEL: Record<Account['account_type'], string> = {
  journal: 'Jurnal',
  demo: 'Demo',
  manual: 'Manual',
}

export function AccountRow({ account, tradeCount }: { account: Account; tradeCount: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<AccountActionState>(initial)
  const [pending, startTransition] = useTransition()

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateAccount(initial, formData)
      setState(result)
      if (result?.success) { setEditing(false); router.refresh() }
    })
  }

  function onDelete() {
    if (!window.confirm(`Hapus akun "${account.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setState(initial)
    startTransition(async () => {
      const result = await deleteAccount(account.id)
      setState(result)
      if (result?.success) router.refresh()
    })
  }

  if (editing) {
    return (
      <form onSubmit={onSave} className="space-y-3 p-4 sm:p-5">
        <input type="hidden" name="id" value={account.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-medium">Nama akun</span>
            <input name="name" defaultValue={account.name} required maxLength={80} className={fields} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium">Jenis</span>
            <select name="account_type" defaultValue={account.account_type} className={fields}>
              <option value="journal">Jurnal</option>
              <option value="demo">Demo</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium">Mata uang dasar</span>
            <input name="base_currency" defaultValue={account.base_currency} required maxLength={3} className={`${fields} uppercase`} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium">Saldo awal <span className="font-normal text-muted">(opsional)</span></span>
            <input name="initial_balance" type="number" min="0" step="any" defaultValue={account.initial_balance ?? ''} className={fields} />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-medium">Catatan <span className="font-normal text-muted">(opsional)</span></span>
          <textarea name="notes" rows={2} defaultValue={account.notes ?? ''} className="w-full resize-y rounded-lg border border-border bg-[#0a1115] px-3 py-2 text-sm outline-none focus:border-accent/50" />
        </label>

        {state?.error && <p role="alert" className="text-xs text-negative">{state.error}</p>}

        <div className="flex items-center gap-2">
          <button disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a] disabled:opacity-50">
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Simpan
          </button>
          <button type="button" onClick={() => { setEditing(false); setState(initial) }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-xs text-muted hover:bg-secondary">
            <X size={14} />Batal
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{account.name}</p>
          <span className="rounded-md border border-border bg-[#111a1f] px-2 py-0.5 text-[10px] text-muted">{TYPE_LABEL[account.account_type]}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {account.base_currency}
          {account.initial_balance ? ` · saldo awal ${Number(account.initial_balance).toLocaleString('id-ID')}` : ' · saldo awal tidak diisi'}
          {` · ${tradeCount} trade`}
        </p>
        {state?.error && <p role="alert" className="mt-2 max-w-md text-[11px] text-negative">{state.error}</p>}
        {state?.success && <p role="status" className="mt-2 text-[11px] text-accent">{state.success}</p>}
      </div>

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setEditing(true)} aria-label={`Ubah ${account.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-secondary hover:text-foreground">
          <Pencil size={14} />
        </button>
        <button type="button" onClick={onDelete} disabled={pending} aria-label={`Hapus ${account.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-negative/10 hover:text-negative disabled:opacity-50">
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  )
}
