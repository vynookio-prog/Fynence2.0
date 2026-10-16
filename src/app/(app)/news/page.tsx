import Link from 'next/link'
import { CalendarDays, ExternalLink, Info, Newspaper, RefreshCw, ShieldAlert } from 'lucide-react'
import { readReleases } from '@/lib/news/store'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export const dynamic = 'force-dynamic'

/**
 * Institutional releases.
 *
 * Formerly this page queried a `news_items` table that was never created, so it
 * rendered "No approved news source configured" — a correct-looking message
 * that arrived from an error rather than from a decision. The title said
 * "Market news" while nothing had been chosen.
 *
 * What is shown now is narrower than "market news", and says so. These are
 * central bank press releases from the Fed and the ECB: their own
 * announcements, nothing else. No equity coverage, no commodity stories, no
 * market commentary. Labelling that as market news would misstate the coverage.
 *
 * Only what the feeds publish is shown — headline, source, publication time,
 * and a link out. No article body is copied, which keeps the app inside the
 * description the Fed's own RSS page gives for aggregator use.
 *
 * Reads storage only. The page never calls a publisher; the cron job does that.
 */

function formatTime(value: string | null): string {
  if (!value) return 'Waktu terbit tidak tersedia'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Waktu terbit tidak tersedia'
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}

export default async function NewsPage() {
  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const user = auth?.user

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Masuk dulu untuk melihat rilis institusi.</p>
      </div>
    )
  }

  const feed = await readReleases(60)

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Sumber resmi, tautan asli</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Rilis institusi</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Siaran pers resmi dari bank sentral. Bukan berita pasar umum — cakupannya hanya rilis
            institusi itu sendiri.
          </p>
        </div>
        {feed.retrievedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] text-muted">
            <RefreshCw size={11} />
            Dibaca {formatTime(feed.retrievedAt)}
          </span>
        )}
      </div>

      {/* The scope limit, stated before the list. */}
      <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
        <Info size={17} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-xs font-medium">Cakupan sempit, dan itu disengaja</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Hanya <span className="text-foreground">Federal Reserve Board</span> dan{' '}
            <span className="text-foreground">European Central Bank</span> yang terhubung, lewat RSS resmi
            masing-masing. Tidak ada berita saham, komoditas, atau komentar pasar di sini. Yang ditampilkan
            hanya judul, sumber, waktu terbit, dan tautan ke rilis aslinya — tidak ada isi artikel yang
            disalin.
          </p>
        </div>
      </div>

      {/* The permission caveat, kept visible rather than buried in docs. */}
      <div className="flex gap-3 rounded-xl border border-warning/20 bg-warning/[.045] p-4">
        <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-xs font-medium">Izin pemakaian belum dinyatakan eksplisit</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Halaman RSS Fed menjelaskan bahwa aggregator menampilkan &ldquo;links, headlines, and a brief
            summary&rdquo;, dan USAGov memperingatkan materi pemerintah federal bisa punya pembatasan. Karena
            itu aplikasi hanya menyimpan metadata dan tautan, tidak pernah isi artikel. Kalau Anda pemilik
            produk ini, konfirmasi izin ke kedua institusi sebelum rilis komersial.
          </p>
        </div>
      </div>

      {feed.stale && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[11px] leading-5 text-muted">
          Data tersimpan lebih dari tiga jam. Penyegaran terjadwal berjalan lewat cron; rilis bank sentral
          terbit beberapa kali sehari, jadi jeda ini normal.
        </p>
      )}

      {feed.error ? (
        <div className="rounded-xl border border-warning/20 bg-warning/[.05] p-8 text-center">
          <ShieldAlert size={22} className="mx-auto text-warning" />
          <p className="mt-3 text-sm font-medium">Gagal membaca rilis tersimpan</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted">
            Penyimpanan membalas error, jadi tidak ada yang ditampilkan. Ini bukan &ldquo;tidak ada
            rilis&rdquo; — keduanya sengaja dibedakan.
          </p>
          <p className="mx-auto mt-2 max-w-md break-words font-mono text-[10px] text-muted">{feed.error}</p>
        </div>
      ) : feed.empty ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <Newspaper size={23} className="mx-auto text-warning" />
          <h2 className="mt-4 text-sm font-medium">Belum ada rilis tersimpan</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted">
            Sumber sudah ditetapkan, tetapi belum ada yang tersimpan. Penyegaran berjalan lewat cron
            terjadwal. Tidak ada judul yang dikarang untuk mengisi ruang kosong.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feed.items.map(item => (
            <article key={item.id} className="rounded-xl border border-border bg-surface p-5">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-start gap-3"
              >
                <Newspaper size={17} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium leading-6 group-hover:text-accent">{item.headline}</h2>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    <span className="text-foreground">{item.sourceName}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={item.publishedAt ?? undefined}>{formatTime(item.publishedAt)}</time>
                    {item.category && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{item.category}</span>
                      </>
                    )}
                  </p>
                </div>
                <ExternalLink size={14} className="mt-0.5 shrink-0 text-muted group-hover:text-accent" />
              </a>
              <p className="mt-3 border-t border-border pt-3 text-[10px] leading-4 text-muted">
                {item.attribution}
              </p>
            </article>
          ))}

          <p className="text-[10px] leading-5 text-muted">
            {feed.items.length} rilis dari {feed.sources.length} sumber. Tautan membuka halaman asli
            penerbit; Fynence tidak menyalin isinya.
          </p>
        </div>
      )}

      {/* Calendar is a separate question: these feeds carry no forecast figures. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <CalendarDays size={16} className="shrink-0 text-muted" />
        <p className="flex-1 text-[11px] leading-5 text-muted">
          Kalender ekonomi terpisah dan masih tidak tersedia: feed ini tidak memuat angka forecast,
          actual, atau previous.
        </p>
        <Link href="/calendar" className="text-[11px] text-accent hover:underline">
          Lihat kalender
        </Link>
      </div>
    </div>
  )
}
