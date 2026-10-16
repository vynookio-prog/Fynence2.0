'use server'
import { revalidatePath } from 'next/cache'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export type WatchlistState = { error?: string; success?: string }

const SYMBOL = /^[A-Za-z0-9._-]{1,32}$/
const MAX_SYMBOLS = 100

export async function saveWatchlist(_prev: WatchlistState, form: FormData): Promise<WatchlistState> {
  const raw = String(form.get('symbols') ?? '')
  const name = String(form.get('name') ?? 'Utama').trim() || 'Utama'

  // Accept comma or newline separated input; upper-case and de-duplicate.
  const symbols = [...new Set(
    raw.split(/[\n,]/).map(s => s.trim().toUpperCase()).filter(Boolean),
  )]

  if (name.length > 80) return { error: 'Nama watchlist maksimal 80 karakter.' }
  if (symbols.length > MAX_SYMBOLS) return { error: `Maksimal ${MAX_SYMBOLS} symbol per watchlist.` }
  const invalid = symbols.find(s => !SYMBOL.test(s))
  if (invalid) return { error: `Symbol tidak valid: ${invalid}. Gunakan huruf, angka, titik, garis bawah, atau tanda hubung.` }

  const client = await getInsForgeServerClient()
  const { data: userData, error: authError } = await client.auth.getCurrentUser()
  if (authError || !userData?.user) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  const { error } = await client.database
    .from('watchlists')
    .upsert([{ user_id: userData.user.id, name, symbols, updated_at: new Date().toISOString() }], { onConflict: 'user_id,name' })
  if (error) return { error: error.message }

  revalidatePath('/macro')
  return { success: `Watchlist "${name}" tersimpan (${symbols.length} symbol).` }
}
