import Link from 'next/link'
import { ArrowRight, BarChart3, CalendarDays, FileText, Newspaper, Sparkles } from 'lucide-react'

/**
 * Other modules a user can move to from an unavailable one.
 *
 * The descriptions state what each module actually does today. Listing Macro
 * Desk as "market mood, movers, and watchlist" described features that were
 * never built, and the watchlist has since been removed in favour of the
 * per-user instrument selection on Pasar.
 */
const items = [
  { title: 'Macro Desk', href: '/macro', desc: 'Indikator dihitung dari bar harian yang tersimpan.', icon: BarChart3 },
  { title: 'Economic Calendar', href: '/calendar', desc: 'Event terverifikasi dengan waktu sumber dan zona waktu.', icon: CalendarDays },
  { title: 'Market News', href: '/news', desc: 'Judul dengan tautan ke sumber aslinya.', icon: Newspaper },
  { title: 'Psychology', href: '/psychology', desc: 'Refleksi berbasis catatan jurnalmu sendiri.', icon: Sparkles },
  { title: 'Reports', href: '/reports', desc: 'Ringkasan periode beserta status sumbernya.', icon: FileText },
]

export function ModuleUnavailable({ active }: { active: string }) {
  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Fynence workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{active}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Modul ini punya state tidak tersedia yang aman. Tidak ada nilai pasar, judul berita, atau event
          yang dikarang.
        </p>
      </div>

      <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/[.05] p-4">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-warning" />
        <div>
          <p className="text-xs font-medium text-warning">Belum ada sumber terverifikasi</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Pemilihan provider, cakupan, lisensi, kuota, dan syarat penggunaan data masih tertunda.
            Jurnal, analitik, dan Macro Desk tetap berjalan tanpa layanan ini.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.filter(i => i.title !== active).map(({ title, href, desc, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-xl border border-border bg-surface p-5 transition hover:border-white/20">
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-[#121b20] text-muted group-hover:text-accent">
                <Icon size={17} />
              </div>
              <ArrowRight size={15} className="text-muted group-hover:text-accent" />
            </div>
            <h2 className="mt-4 text-sm font-medium">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
