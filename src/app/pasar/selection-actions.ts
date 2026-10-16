'use server'

import { revalidatePath } from 'next/cache'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import { listSelected } from '@/lib/market/view'
import { MAX_INSTRUMENTS } from '@/lib/market/selection'

/**
 * Managing which instruments a user sees.
 *
 * The cap is checked here for a clear message, and enforced again by a database
 * trigger for safety. The user-visible error is the friendly one; the trigger
 * is what makes the limit actually hold.
 */

export type SelectionResult = { ok: true } | { ok: false; error: string }

/** Distinguishes a cap rejection from a generic failure, for a usable message. */
function friendlyError(message: string): string {
  if (message.includes('instrument_limit_reached')) {
    return `Maksimal ${MAX_INSTRUMENTS} instrumen. Hapus satu dulu untuk menambah yang lain.`
  }
  if (message.includes('duplicate key')) {
    return 'Instrumen itu sudah ada di daftar kamu.'
  }
  return 'Tidak bisa menyimpan pilihan. Coba lagi.'
}

export async function addInstrument(
  _prev: SelectionResult | null,
  formData: FormData,
): Promise<SelectionResult> {
  const provider = String(formData.get('provider') ?? '').trim()
  const symbol = String(formData.get('symbol') ?? '').trim()
  if (!provider || !symbol) return { ok: false, error: 'Instrumen tidak valid.' }

  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const userId = auth?.user?.id
  if (!userId) return { ok: false, error: 'Sesi tidak ditemukan. Masuk ulang.' }

  // The catalogue is the source of truth for what may be chosen. Accepting any
  // symbol here would let a request select something unverified and burn a
  // credit discovering that it cannot be fetched.
  const { data: catalogue } = await client.database
    .from('market_instruments')
    .select('symbol')
    .eq('provider', provider)
    .eq('symbol', symbol)
    .eq('coverage', 'available')
    .limit(1)

  if (!catalogue?.length) {
    return { ok: false, error: 'Instrumen itu belum terverifikasi bisa diakses.' }
  }

  const current = await listSelected(userId)
  if (current.length >= MAX_INSTRUMENTS) {
    return { ok: false, error: `Maksimal ${MAX_INSTRUMENTS} instrumen. Hapus satu dulu untuk menambah yang lain.` }
  }

  const nextPosition = current.reduce((max, item) => Math.max(max, item.position), -1) + 1

  const { error } = await client.database.from('user_instruments').insert([{
    user_id: userId, provider, symbol, position: nextPosition,
  }])

  if (error) return { ok: false, error: friendlyError(error.message) }

  revalidatePath('/pasar')
  return { ok: true }
}

/**
 * Removes an instrument from a user's selection.
 *
 * Eviction is deliberately conservative. Bars are shared, so deleting them
 * because one user moved on would pull data out from under anyone else still
 * selecting the same symbol. Bars go only when no user references them.
 */
export async function removeInstrument(
  _prev: SelectionResult | null,
  formData: FormData,
): Promise<SelectionResult> {
  const provider = String(formData.get('provider') ?? '').trim()
  const symbol = String(formData.get('symbol') ?? '').trim()
  if (!provider || !symbol) return { ok: false, error: 'Instrumen tidak valid.' }

  const client = await getInsForgeServerClient()
  const { data: auth } = await client.auth.getCurrentUser()
  const userId = auth?.user?.id
  if (!userId) return { ok: false, error: 'Sesi tidak ditemukan. Masuk ulang.' }

  const { error } = await client.database
    .from('user_instruments')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('symbol', symbol)

  if (error) return { ok: false, error: friendlyError(error.message) }

  // Admin client, because market_candles has no delete policy for end users.
  const admin = getInsForgeAdminClient()
  if (admin) {
    const { data: stillUsed } = await admin.database
      .from('user_instruments')
      .select('id')
      .eq('provider', provider)
      .eq('symbol', symbol)
      .limit(1)

    if (!stillUsed?.length) {
      const { error: evictError } = await admin.database
        .from('market_candles')
        .delete()
        .eq('provider', provider)
        .eq('symbol', symbol)
      // A failed eviction leaves data behind, which is harmless. It must not
      // fail the removal the user actually asked for.
      if (evictError) console.error('[market] candle eviction failed:', evictError.message)
    }
  }

  revalidatePath('/pasar')
  return { ok: true }
}
