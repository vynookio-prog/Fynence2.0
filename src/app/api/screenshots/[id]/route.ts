import { NextResponse } from 'next/server'
import { getInsForgeServerClient } from '@/lib/insforge/server'

/**
 * Streams a screenshot from the private bucket. The bucket is private, so the
 * object is never exposed as a public URL: the caller must own the metadata row
 * (metadata read is RLS-scoped) and the object read runs with the same session.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getInsForgeServerClient()

  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: rows, error } = await client.database
    .from('trade_screenshots')
    .select('storage_key,mime_type')
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .limit(1)

  if (error || !rows?.length) return new NextResponse('Not found', { status: 404 })

  const shot = rows[0] as { storage_key: string; mime_type: string | null }
  const { data: blob, error: downloadError } = await client.storage
    .from('trade-screenshots')
    .download(shot.storage_key)

  if (downloadError || !blob) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(blob, {
    headers: {
      'Content-Type': shot.mime_type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=60',
      'Content-Disposition': 'inline',
    },
  })
}
