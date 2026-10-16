import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-surface text-muted">
        <Compass size={20} />
      </div>
      <h1 className="mt-5 text-lg font-semibold">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-md text-xs leading-5 text-muted">
        Alamat ini tidak ada, atau datanya milik akun lain sehingga tidak bisa ditampilkan.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-xs font-semibold text-[#06251a]">
          Buka dashboard
        </Link>
        <Link href="/journal" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-xs font-medium hover:bg-secondary">
          Buka jurnal
        </Link>
      </div>
    </div>
  )
}
