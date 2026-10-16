'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { deleteTrade } from '@/app/trade-actions'

export function DeleteTradeButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function onDelete() {
    if (!window.confirm('Hapus trade ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) return
    setError('')
    startTransition(async () => {
      const result = await deleteTrade(id)
      if (result?.error) { setError(result.error); return }
      router.push('/journal')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label={compact ? 'Hapus trade' : undefined}
        className={compact
          ? 'grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-negative/10 hover:text-negative disabled:opacity-50'
          : 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-negative/25 px-4 text-xs font-medium text-negative hover:bg-negative/[.08] disabled:opacity-50'}
      >
        {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {!compact && 'Hapus trade'}
      </button>
      {error && <p role="alert" className="text-xs text-negative">{error}</p>}
    </>
  )
}
