'use server'
import { revalidatePath } from 'next/cache'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export type AccountActionState = { error?: string; success?: string }

const money = /^\d+(\.\d+)?$/
const CURRENCY = /^[A-Z]{3}$/

async function owner() {
  const client = await getInsForgeServerClient()
  const { data, error } = await client.auth.getCurrentUser()
  if (error || !data?.user) return { client, userId: null as string | null }
  return { client, userId: data.user.id }
}

type Parsed = { error: string } | { row: Record<string, unknown> }

function parse(form: FormData): Parsed {
  const name = String(form.get('name') ?? '').trim()
  const currency = String(form.get('base_currency') ?? '').trim().toUpperCase()
  const accountType = String(form.get('account_type') ?? 'journal').trim()
  const balance = String(form.get('initial_balance') ?? '').trim()
  const notes = String(form.get('notes') ?? '').trim()

  if (name.length < 1 || name.length > 80) return { error: 'Nama akun wajib diisi (maksimal 80 karakter).' }
  if (!CURRENCY.test(currency)) return { error: 'Gunakan kode mata uang 3 huruf, misalnya USD.' }
  if (!['journal', 'demo', 'manual'].includes(accountType)) return { error: 'Jenis akun tidak valid.' }
  if (balance && (!money.test(balance) || Number(balance) < 0)) return { error: 'Saldo awal harus angka positif atau nol.' }

  return {
    row: {
      name,
      base_currency: currency,
      account_type: accountType,
      initial_balance: balance || null,
      notes: notes || null,
    },
  }
}

export async function createAccount(_prev: AccountActionState, form: FormData): Promise<AccountActionState> {
  const parsed = parse(form)
  if ('error' in parsed) return { error: parsed.error }

  const { client, userId } = await owner()
  if (!userId) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  const { error } = await client.database.from('trading_accounts').insert([{ user_id: userId, ...parsed.row }])
  if (error) return { error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/journal')
  return { success: 'Akun berhasil dibuat.' }
}

export async function updateAccount(_prev: AccountActionState, form: FormData): Promise<AccountActionState> {
  const id = String(form.get('id') ?? '').trim()
  if (!id) return { error: 'Akun tidak ditemukan.' }

  const parsed = parse(form)
  if ('error' in parsed) return { error: parsed.error }

  const { client, userId } = await owner()
  if (!userId) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  const { error } = await client.database
    .from('trading_accounts')
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) return { error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/journal')
  return { success: 'Akun diperbarui.' }
}

export async function deleteAccount(id: string): Promise<AccountActionState> {
  if (!id) return { error: 'Akun tidak ditemukan.' }

  const { client, userId } = await owner()
  if (!userId) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  // The composite FK from trades uses ON DELETE RESTRICT, so a populated account
  // cannot be removed by accident. Surface that as a readable message.
  const { count } = await client.database
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', id)
    .eq('user_id', userId)

  if (count && count > 0) {
    return { error: `Akun masih dipakai oleh ${count} trade. Pindahkan trade tersebut ke akun lain sebelum menghapus.` }
  }

  const { error } = await client.database.from('trading_accounts').delete().eq('id', id).eq('user_id', userId)
  if (error) return { error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/journal')
  return { success: 'Akun dihapus.' }
}
