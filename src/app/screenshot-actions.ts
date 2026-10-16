'use server'
import { revalidatePath } from 'next/cache'
import { getInsForgeServerClient } from '@/lib/insforge/server'

export type ScreenshotActionState = { error?: string; success?: string }

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
const MAX_BYTES = 5 * 1024 * 1024

export async function uploadScreenshot(_prev: ScreenshotActionState, form: FormData): Promise<ScreenshotActionState> {
  const tradeId = String(form.get('trade_id') ?? '').trim()
  const caption = String(form.get('caption') ?? '').trim()
  const file = form.get('file')

  if (!tradeId) return { error: 'Trade tidak ditemukan.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Pilih file gambar terlebih dahulu.' }
  const extension = ALLOWED[file.type]
  if (!extension) return { error: 'Format harus PNG, JPEG, atau WebP.' }
  if (file.size > MAX_BYTES) return { error: 'Ukuran file maksimal 5 MB.' }

  const client = await getInsForgeServerClient()
  const { data: userData, error: authError } = await client.auth.getCurrentUser()
  if (authError || !userData?.user) return { error: 'Sesi berakhir. Silakan masuk kembali.' }
  const userId = userData.user.id

  // Confirm the trade belongs to this user before writing anything.
  const { data: owned } = await client.database
    .from('trades').select('id').eq('id', tradeId).eq('user_id', userId).limit(1)
  if (!owned?.length) return { error: 'Trade tidak ditemukan.' }

  // The <user_id>/<trade_id>/ prefix matches the storage RLS foldername check.
  const key = `${userId}/${tradeId}/${crypto.randomUUID()}.${extension}`

  const { data: uploaded, error: uploadError } = await client.storage
    .from('trade-screenshots')
    .upload(key, file)
  if (uploadError || !uploaded) return { error: uploadError?.message ?? 'Upload gagal. Coba lagi.' }

  const { error: insertError } = await client.database.from('trade_screenshots').insert([{
    user_id: userId,
    trade_id: tradeId,
    storage_key: uploaded.key ?? key,
    storage_url: uploaded.url ?? null,
    file_name: file.name,
    mime_type: file.type,
    byte_size: file.size,
    caption: caption || null,
  }])
  if (insertError) {
    // Do not leave an orphaned object behind if metadata could not be saved.
    await client.storage.from('trade-screenshots').remove(uploaded.key ?? key)
    return { error: insertError.message }
  }

  revalidatePath(`/journal/${tradeId}`)
  return { success: 'Screenshot tersimpan.' }
}

export async function deleteScreenshot(id: string, storageKey: string, tradeId: string): Promise<ScreenshotActionState> {
  if (!id || !storageKey) return { error: 'Screenshot tidak ditemukan.' }

  const client = await getInsForgeServerClient()
  const { data: userData, error: authError } = await client.auth.getCurrentUser()
  if (authError || !userData?.user) return { error: 'Sesi berakhir. Silakan masuk kembali.' }

  const { error: rowError } = await client.database
    .from('trade_screenshots').delete().eq('id', id).eq('user_id', userData.user.id)
  if (rowError) return { error: rowError.message }

  // The object is removed after its metadata row, so a failed object delete cannot
  // leave a row pointing at a missing file.
  const { error: objectError } = await client.storage.from('trade-screenshots').remove(storageKey)
  if (objectError) return { error: `Metadata terhapus, tetapi file gagal dihapus: ${objectError.message}` }

  revalidatePath(`/journal/${tradeId}`)
  return { success: 'Screenshot dihapus.' }
}
