'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { CircleAlert, RotateCcw } from 'lucide-react'

/**
 * Error boundary for the authenticated area. It does not print the raw error
 * message: those can carry database detail, and the user cannot act on it.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the error in the browser console for debugging without surfacing it in the UI.
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-warning/20 bg-warning/[.07] text-warning">
        <CircleAlert size={20} />
      </div>
      <h1 className="mt-5 text-lg font-semibold">Ada yang gagal dimuat</h1>
      <p className="mt-2 max-w-md text-xs leading-5 text-muted">
        Halaman ini tidak bisa ditampilkan. Catatanmu tidak terpengaruh — tidak ada data yang diubah.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[10px] text-muted">Kode: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a]"
        >
          <RotateCcw size={14} />
          Coba lagi
        </button>
        <Link
          href="/dashboard"
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-xs font-medium hover:bg-secondary"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </div>
  )
}
