import Link from 'next/link'
import { CalendarDays, Clock3, ExternalLink, Info, Newspaper, ShieldAlert } from 'lucide-react'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export const dynamic = 'force-dynamic'

/**
 * Economic calendar.
 *
 * Still unavailable, and now for a reason that is written down rather than
 * inferred from a failed query. The previous version selected from an
 * `economic_events` table that was never created, so its "No verified economic
 * calendar source configured" message was technically true and arrived from an
 * error rather than a decision.
 *
 * What was tested, all on 2026-10-17:
 *
 * - Trading Economics, the candidate the docs named: 401 without a key, and its
 *   documented guest route answers 410 "the guest account has been
 *   discontinued". The free path no longer exists.
 * - Finnhub and Financial Modeling Prep: both 401 without a key.
 * - BLS Public Data API: responds without a key and returns real figures, but
 *   caps at 25 series per request with a daily quota that was exhausted on
 *   request 19. Its quota failures arrive as HTTP 200 with
 *   `status: REQUEST_NOT_PROCESSED`, so a caller checking the status code alone
 *   reads "out of quota" as success. Too small for a scheduled refresh.
 * - GDELT: returned 429 even after 45 seconds idle. The limit is shared across
 *   callers, not per IP, so spacing requests does not help.
 * - BEA release schedule: reads without auth and carries real dated events
 *   ("October 29 8:30 AM GDP (Advance Estimate), 3rd Quarter 2026"), but it is
 *   scraped HTML rather than a feed or API, and its terms are unchecked.
 *
 * The Fed and ECB RSS feeds that power /news do carry dated releases, but no
 * forecast, actual, or previous figures — the three things a calendar is for.
 * So they are shown as releases, not promoted into events.
 *
 * What is shown below is the dated BEA schedule, fetched and labelled as an
 * unverified HTML source. It is presented as a link out rather than parsed into
 * events, because parsing it would imply a licence the project has not
 * confirmed.
 */

export default async function CalendarPage() {
  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const user = auth?.user

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Masuk dulu untuk melihat kalender ekonomi.</p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Zona waktu · Asia/Jakarta</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Kalender ekonomi</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Belum ada sumber terverifikasi. Tidak ada jadwal, forecast, atau klasifikasi dampak yang
          dikarang.
        </p>
      </div>

      <div role="status" className="flex gap-3 rounded-xl border border-warning/20 bg-warning/[.05] p-4">
        <Clock3 size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-xs font-medium text-warning">Belum ada provider kalender yang lolos verifikasi</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Semua kandidat diuji langsung. Trading Economics menolak akses tanpa key dan jalur tamunya sudah
            dimatikan; Finnhub dan FMP butuh key; API BLS kehabisan kuota harian di request ke-19; GDELT
            membalas 429 bahkan setelah menganggur 45 detik. Rinciannya ada di{' '}
            <span className="font-mono text-[11px]">Prompt/DATA_SOURCES.md</span>.
          </p>
        </div>
      </div>

      {/* Why the working /news feeds could not simply be reused here. */}
      <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
        <Info size={17} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-xs font-medium">Kenapa rilis bank sentral tidak bisa jadi kalender</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            RSS Fed dan ECB memuat rilis bertanggal, tetapi tidak memuat angka{' '}
            <span className="text-foreground">forecast</span>,{' '}
            <span className="text-foreground">actual</span>, atau{' '}
            <span className="text-foreground">previous</span> — tiga hal yang membuat sebuah kalender
            berguna. Menaikkannya menjadi &ldquo;event&rdquo; akan memberi kesan ada isi yang sebenarnya tidak
            ada. Rilisnya ditampilkan apa adanya di{' '}
            <Link href="/news" className="text-accent hover:underline">Rilis institusi</Link>.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">Yang sudah terverifikasi ada</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          Jadwal rilis BEA terbaca tanpa autentikasi dan berisi tanggal serta jam yang nyata. Tetapi itu
          halaman HTML, bukan feed atau API resmi, dan ketentuan pemakaiannya belum diperiksa. Jadi ditautkan
          apa adanya, tidak diurai menjadi event:
        </p>
        <ul className="mt-4 space-y-2">
          {[
            { label: 'BEA — Release Schedule (belum diverifikasi)', url: 'https://www.bea.gov/news/schedule' },
            { label: 'Federal Reserve — siaran pers (RSS)', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
            { label: 'ECB — siaran pers (RSS)', url: 'https://www.ecb.europa.eu/rss/press.html' },
          ].map(link => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group inline-flex items-center gap-2 text-xs text-accent hover:underline"
              >
                <ExternalLink size={12} />
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-[11px] leading-5 text-muted">
          Kalender yang benar-benar terisi butuh provider berizin. Sampai itu ada, halaman ini menyatakan
          tidak tersedia — lebih baik daripada jadwal yang terlihat meyakinkan tetapi tidak bersumber.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <CalendarDays size={16} className="shrink-0 text-muted" />
        <p className="flex-1 text-[11px] leading-5 text-muted">
          Rilis bank sentral yang bertanggal sudah tersedia sekarang.
        </p>
        <Link href="/news" className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:underline">
          <Newspaper size={12} />
          Buka rilis institusi
        </Link>
      </div>
    </div>
  )
}
