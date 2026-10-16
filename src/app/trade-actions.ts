'use server'
import { revalidatePath } from 'next/cache'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export type TradeActionState = { error?: string; success?: string }

const money = /^-?\d+(\.\d+)?$/

type Parsed = { error: string } | { row: Record<string, unknown> }

function parseTrade(form: FormData): Parsed {
  const v = (k: string) => String(form.get(k) ?? '').trim()
  const symbol = v('symbol').toUpperCase()
  const direction = v('direction')
  const status = v('status')
  const entry = v('entry_price')
  const size = v('size')
  const fees = v('fees') || '0'
  const realized = v('realized_pnl')
  const accountId = v('account_id')

  if (symbol.length < 1 || symbol.length > 32) return { error: 'Symbol wajib diisi (maksimal 32 karakter).' }
  if (accountId && !/^[0-9a-f-]{36}$/i.test(accountId)) return { error: 'Akun yang dipilih tidak valid.' }
  if (!['long', 'short'].includes(direction)) return { error: 'Arah trade tidak valid.' }
  if (!['open', 'closed'].includes(status)) return { error: 'Status trade tidak valid.' }
  if (!money.test(entry) || Number(entry) < 0) return { error: 'Entry price harus angka positif atau nol.' }
  if (!money.test(size) || Number(size) <= 0) return { error: 'Position size harus angka lebih besar dari nol.' }
  if (!money.test(fees) || Number(fees) < 0) return { error: 'Fee harus angka positif atau nol.' }

  const opened = new Date(v('opened_at'))
  if (Number.isNaN(opened.valueOf())) return { error: 'Waktu pembukaan tidak valid.' }

  const closedRaw = v('closed_at')
  const closed = status === 'closed' ? new Date(closedRaw) : null
  if (status === 'closed') {
    if (!closedRaw || !closed || Number.isNaN(closed.valueOf())) return { error: 'Closed trade memerlukan waktu penutupan.' }
    if (closed.getTime() < opened.getTime()) return { error: 'Waktu penutupan tidak boleh sebelum waktu pembukaan.' }
    const exit = v('exit_price')
    if (!money.test(exit) || Number(exit) < 0) return { error: 'Closed trade memerlukan exit price yang valid.' }
  }
  if (realized && !money.test(realized)) return { error: 'Realized P&L harus berupa angka.' }

  const stopLoss = v('stop_loss')
  const takeProfit = v('take_profit')
  if (stopLoss && (!money.test(stopLoss) || Number(stopLoss) < 0)) return { error: 'Stop loss harus angka positif atau nol.' }
  if (takeProfit && (!money.test(takeProfit) || Number(takeProfit) < 0)) return { error: 'Take profit harus angka positif atau nol.' }

  // The stop and target must sit on the correct side of entry, otherwise R is
  // meaningless. The database enforces this too; checking here gives a readable
  // message instead of a raw constraint error.
  if (stopLoss) {
    const wrongSide = direction === 'long' ? Number(stopLoss) >= Number(entry) : Number(stopLoss) <= Number(entry)
    if (wrongSide) {
      return { error: direction === 'long'
        ? 'Stop loss harus di bawah entry price untuk posisi long.'
        : 'Stop loss harus di atas entry price untuk posisi short.' }
    }
  }
  if (takeProfit) {
    const wrongSide = direction === 'long' ? Number(takeProfit) <= Number(entry) : Number(takeProfit) >= Number(entry)
    if (wrongSide) {
      return { error: direction === 'long'
        ? 'Take profit harus di atas entry price untuk posisi long.'
        : 'Take profit harus di bawah entry price untuk posisi short.' }
    }
  }

  const riskAmount = v('risk_amount')
  if (riskAmount && (!money.test(riskAmount) || Number(riskAmount) <= 0)) {
    return { error: 'Risk amount harus angka lebih besar dari nol.' }
  }

  const grade = v('setup_grade')
  const quality = v('execution_quality')
  if (grade && !['1', '2', '3', '4', '5'].includes(grade)) return { error: 'Penilaian setup harus 1 sampai 5.' }
  if (quality && !['1', '2', '3', '4', '5'].includes(quality)) return { error: 'Kualitas eksekusi harus 1 sampai 5.' }

  const adherence = v('plan_adherence')

  return {
    row: {
      symbol,
      direction,
      status,
      account_id: accountId || null,
      opened_at: opened.toISOString(),
      closed_at: closed ? closed.toISOString() : null,
      entry_price: entry,
      exit_price: status === 'closed' ? v('exit_price') : null,
      size,
      fees,
      realized_pnl: status === 'closed' && realized ? realized : null,
      stop_loss: stopLoss || null,
      take_profit: takeProfit || null,
      risk_amount: riskAmount || null,
      setup: v('setup') || null,
      timeframe: v('timeframe') || null,
      exit_reason: v('exit_reason') || null,
      notes: v('notes') || null,
      setup_grade: grade ? Number(grade) : null,
      execution_quality: quality ? Number(quality) : null,
      plan_adherence: adherence === '' ? null : adherence === 'yes',
      emotion: v('emotion') || null,
    },
  }
}

function revalidateTradeViews() {
  revalidatePath('/journal')
  revalidatePath('/dashboard')
  revalidatePath('/analytics')
  revalidatePath('/psychology')
}

/**
 * A client-supplied account_id must belong to the caller. RLS and the composite
 * FK also protect this, but checking here turns a database error into a clear message.
 */
async function accountOwnershipError(
  client: Awaited<ReturnType<typeof getInsForgeServerClient>>,
  userId: string,
  accountId: string | null,
): Promise<string | null> {
  if (!accountId) return null
  const { data, error } = await client.database
    .from('trading_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .limit(1)
  if (error) return 'Akun tidak bisa diverifikasi. Coba lagi.'
  if (!data?.length) return 'Akun yang dipilih bukan milikmu.'
  return null
}

export async function saveTrade(_prev: TradeActionState, form: FormData): Promise<TradeActionState> {
  const parsed = parseTrade(form)
  if ('error' in parsed) return { error: parsed.error }

  const client = await getInsForgeServerClient()
  const { data, error: authError } = await client.auth.getCurrentUser()
  if (authError || !data?.user) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  const ownership = await accountOwnershipError(client, data.user.id, parsed.row.account_id as string | null)
  if (ownership) return { error: ownership }

  const { error } = await client.database.from('trades').insert([{ user_id: data.user.id, ...parsed.row }])
  if (error) return { error: error.message }

  revalidateTradeViews()
  return { success: 'Trade tersimpan.' }
}

export async function updateTrade(_prev: TradeActionState, form: FormData): Promise<TradeActionState> {
  const id = String(form.get('id') ?? '').trim()
  if (!id) return { error: 'Trade tidak ditemukan.' }

  const parsed = parseTrade(form)
  if ('error' in parsed) return { error: parsed.error }

  const client = await getInsForgeServerClient()
  const { data, error: authError } = await client.auth.getCurrentUser()
  if (authError || !data?.user) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  const ownership = await accountOwnershipError(client, data.user.id, parsed.row.account_id as string | null)
  if (ownership) return { error: ownership }

  // RLS already scopes rows to the signed-in user; the id filter keeps the update explicit.
  const { error } = await client.database.from('trades').update({ ...parsed.row, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', data.user.id)
  if (error) return { error: error.message }

  revalidateTradeViews()
  revalidatePath(`/journal/${id}`)
  return { success: 'Perubahan trade tersimpan.' }
}

export async function deleteTrade(id: string): Promise<TradeActionState> {
  if (!id) return { error: 'Trade tidak ditemukan.' }

  const client = await getInsForgeServerClient()
  const { data, error: authError } = await client.auth.getCurrentUser()
  if (authError || !data?.user) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  const { error } = await client.database.from('trades').delete().eq('id', id).eq('user_id', data.user.id)
  if (error) return { error: error.message }

  revalidateTradeViews()
  return { success: 'Trade dihapus.' }
}
