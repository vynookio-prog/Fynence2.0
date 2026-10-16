'use client'

import Link from 'next/link'
import { CircleAlert } from 'lucide-react'

/**
 * Catches failures in the root layout itself, where the app shell is not
 * available. This is the only place that renders its own <html> and <body>.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, background: '#080C10', color: '#e8f0f2', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Aplikasi gagal dimuat</h1>
          <p style={{ marginTop: 10, maxWidth: 420, fontSize: 13, lineHeight: 1.6, color: '#8b979d' }}>
            Terjadi kesalahan sebelum halaman sempat dirender. Catatanmu tersimpan di server dan tidak terpengaruh.
          </p>
          {error.digest && (
            <p style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 11, color: '#7c8b92' }}>Kode: {error.digest}</p>
          )}
          <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: 40, padding: '0 16px', borderRadius: 8, border: 0, background: '#35D39A', color: '#06251a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Coba lagi
            </button>
            <Link
              href="/dashboard"
              style={{ display: 'inline-flex', minHeight: 40, alignItems: 'center', padding: '0 16px', borderRadius: 8, border: '1px solid rgba(148,163,184,.2)', color: '#e8f0f2', fontSize: 12, textDecoration: 'none' }}
            >
              Kembali ke dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
