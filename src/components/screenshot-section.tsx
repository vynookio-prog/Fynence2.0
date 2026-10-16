'use client'
import { useActionState, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { deleteScreenshot, uploadScreenshot, type ScreenshotActionState } from '@/app/screenshot-actions'
import type { Screenshot } from '@/lib/trades/screenshots'

const initial: ScreenshotActionState = {}

function Thumb({ shot }: { shot: Screenshot }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function onDelete() {
    if (!window.confirm('Hapus screenshot ini secara permanen?')) return
    setError('')
    startTransition(async () => {
      const result = await deleteScreenshot(shot.id, shot.storage_key, shot.trade_id)
      if (result?.error) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-[#0a1115]">
      {/* Private bucket: the object is read through the authenticated storage route. */}
      <img
        src={`/api/screenshots/${shot.id}`}
        alt={shot.caption || shot.file_name || 'Screenshot trade'}
        className="h-32 w-full bg-[#0a1115] object-cover"
      />
      <figcaption className="flex items-start justify-between gap-2 border-t border-border p-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px]">{shot.caption || shot.file_name || 'Screenshot'}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted">
            {shot.byte_size ? `${(shot.byte_size / 1024).toFixed(0)} KB · ` : ''}
            {new Date(shot.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
          {error && <p className="mt-1 text-[10px] text-negative">{error}</p>}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label={`Hapus ${shot.file_name || 'screenshot'}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-negative/10 hover:text-negative disabled:opacity-50"
        >
          {pending ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </figcaption>
    </figure>
  )
}

export function ScreenshotSection({ tradeId, screenshots }: { tradeId: string; screenshots: Screenshot[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(uploadScreenshot, initial)
  const [fileName, setFileName] = useState('')

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Screenshot chart</h2>
          <p className="mt-1 text-xs text-muted">File privat. Hanya kamu yang bisa membukanya.</p>
        </div>
        <span className="rounded-md border border-border bg-[#111a1f] px-2.5 py-1 text-[10px] text-muted">PNG · JPEG · WebP · maks 5 MB</span>
      </div>

      {screenshots.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {screenshots.map(shot => <Thumb key={shot.id} shot={shot} />)}
        </div>
      )}

      <form
        ref={formRef}
        action={async (formData: FormData) => {
          formAction(formData)
          setFileName('')
          formRef.current?.reset()
        }}
        className="mt-5 space-y-3 border-t border-border pt-5"
      >
        <input type="hidden" name="trade_id" value={tradeId} />
        <label className="block">
          <span className="mb-2 block text-xs font-medium">Pilih gambar</span>
          <input
            required
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
            className="block w-full cursor-pointer rounded-lg border border-border bg-[#0a1115] px-3 py-2.5 text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:text-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium">Keterangan <span className="font-normal text-muted">(opsional)</span></span>
          <input name="caption" maxLength={160} placeholder="mis. Struktur sebelum entry" className="h-11 w-full rounded-lg border border-border bg-[#0a1115] px-3 text-sm outline-none focus:border-accent/50" />
        </label>

        {state?.error && <p role="alert" className="rounded-lg border border-negative/20 bg-negative/[.06] p-3 text-xs text-negative">{state.error}</p>}
        {state?.success && <p role="status" className="rounded-lg border border-accent/20 bg-accent/[.06] p-3 text-xs text-accent">{state.success}</p>}

        <button disabled={pending || !fileName} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a] disabled:opacity-50">
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {pending ? 'Mengunggah…' : 'Unggah screenshot'}
        </button>
      </form>
    </section>
  )
}
