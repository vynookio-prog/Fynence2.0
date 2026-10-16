import { Brain, CheckCircle2, CircleAlert } from 'lucide-react'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export const dynamic = 'force-dynamic'

type Row = {
  plan_adherence: boolean | null
  execution_quality: number | null
  setup_grade: number | null
  emotion: string | null
  status: string
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-3 font-mono text-2xl tabular">{value}</p>
      <p className="mt-2 text-[11px] leading-4 text-muted">{hint}</p>
    </div>
  )
}

export default async function PsychologyPage() {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()

  let rows: Row[] = []
  let loadError = ''
  if (userData?.user) {
    const { data, error } = await client.database
      .from('trades')
      .select('plan_adherence,execution_quality,setup_grade,emotion,status')
      .eq('user_id', userData.user.id)
      .order('opened_at', { ascending: false })
      .limit(200)
    if (error) loadError = error.message
    else rows = (data ?? []) as unknown as Row[]
  }

  const adherence = rows.filter(r => r.plan_adherence !== null)
  const followed = adherence.filter(r => r.plan_adherence === true).length
  const graded = rows.filter(r => r.execution_quality != null)
  const lowQuality = graded.filter(r => (r.execution_quality ?? 0) <= 2).length
  const ratedSetups = rows.filter(r => r.setup_grade != null)
  const weakSetups = ratedSetups.filter(r => (r.setup_grade ?? 0) <= 2).length

  const emotions = new Map<string, number>()
  for (const r of rows) if (r.emotion) emotions.set(r.emotion, (emotions.get(r.emotion) ?? 0) + 1)
  const rankedEmotions = [...emotions.entries()].sort((a, b) => b[1] - a[1])
  const maxEmotion = rankedEmotions[0]?.[1] ?? 0

  const hasAnything = adherence.length || graded.length || ratedSetups.length || emotions.size
  const summary = !rows.length
    ? 'Belum ada catatan trade. Tambahkan trade pertamamu dan catat bagaimana rencananya terasa.'
    : !hasAnything
      ? `Ada ${rows.length} trade, tetapi belum ada data refleksi. Isi penilaian setup, kualitas eksekusi, kepatuhan rencana, atau emosi pada trade mana pun.`
      : `Dari ${rows.length} trade terakhir, ${adherence.length || 0} menandai kepatuhan rencana dan ${graded.length || 0} menilai kualitas eksekusi.`

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-medium uppercase tracking-[.14em] text-accent">Bukti di atas penilaian</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Psikologi & refleksi</h1>
        <p className="mt-2 text-sm text-muted">Ringkasan netral dari field yang kamu isi sendiri. Ini bukan diagnosis.</p>
      </div>

      {loadError && <p role="alert" className="rounded-lg border border-warning/20 bg-warning/[.06] p-3 text-xs text-warning">Data refleksi tidak bisa dimuat: {loadError}</p>}

      <article className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-accent/15 bg-accent/[.06] text-accent"><Brain size={19} /></div>
          <div>
            <h2 className="text-sm font-semibold">Pola jurnal</h2>
            <p className="mt-1 text-[11px] text-muted">Deterministik · 200 catatan terakhir · Tanpa AI</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6">{summary}</p>
        <div className="mt-5 flex gap-2 rounded-lg border border-border bg-[#0a1115] p-3 text-[11px] leading-5 text-muted">
          {hasAnything
            ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-accent" />
            : <CircleAlert size={15} className="mt-0.5 shrink-0 text-warning" />}
          Pola hanya merangkum jawaban yang tercatat. Data yang kosong tidak dianggap sebagai bukti perilaku.
        </div>
      </article>

      {hasAnything && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Sesuai rencana"
              value={adherence.length ? `${followed}/${adherence.length}` : '—'}
              hint={adherence.length ? 'Dari trade yang menandai kepatuhan rencana' : 'Belum ada trade yang ditandai'}
            />
            <Stat
              label="Eksekusi 1–2"
              value={graded.length ? `${lowQuality}/${graded.length}` : '—'}
              hint={graded.length ? 'Trade dengan kualitas eksekusi rendah' : 'Belum ada penilaian eksekusi'}
            />
            <Stat
              label="Setup 1–2"
              value={ratedSetups.length ? `${weakSetups}/${ratedSetups.length}` : '—'}
              hint={ratedSetups.length ? 'Trade dengan penilaian setup lemah' : 'Belum ada penilaian setup'}
            />
          </div>

          {rankedEmotions.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="text-sm font-semibold">Emosi yang tercatat</h2>
              <p className="mt-1 text-xs text-muted">Hitungan dari field emosi, bukan penilaian baik atau buruk.</p>
              <div className="mt-5 space-y-3">
                {rankedEmotions.map(([emotion, count]) => (
                  <div key={emotion} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-muted">{emotion}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(count / maxEmotion) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right font-mono text-xs tabular">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-[11px] leading-5 text-muted">Tidak ada inferensi dari pergerakan harga, dan tidak ada diagnosis. Semua angka berasal dari field yang kamu isi di form trade.</p>
    </div>
  )
}
