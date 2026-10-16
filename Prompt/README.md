# Fynence — Project Blueprint

Dokumen awal untuk memulai **Fynence**, aplikasi trading journal dan market intelligence. Paket ini diturunkan dari percakapan referensi yang dibagikan dan dirapikan menjadi spesifikasi yang dapat dipakai sebagai konteks kerja developer atau coding agent.

## Keputusan inti

- Stack target: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, InsForge/PostgreSQL, dan Vercel Hobby untuk penggunaan yang memenuhi ketentuannya.
- Jurnal transaksi menggunakan **input manual saja**; tidak ada integrasi MT5, broker, atau eksekusi order.
- Target biaya Rp0 hanya berlaku selama pemakaian memenuhi kuota dan ketentuan layanan gratis.
- Data pasar, berita, kalender, dan AI bersifat opsional; fitur inti journal dan analytics tidak boleh bergantung padanya.
- HybridTrader menjadi referensi tingkat fitur dan alur UX saja. Fynence memakai implementasi, formula, dan logika sendiri.

## Dokumen

| Dokumen | Tujuan |
|---|---|
| [PRD.md](PRD.md) | Tujuan produk, pengguna, fitur, scope, dan kriteria penerimaan. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Batas sistem, modul aplikasi, model data, keamanan, dan pola integrasi. |
| [DATA_SOURCES.md](DATA_SOURCES.md) | Kandidat provider, status verifikasi, provenance, dan fallback. |
| [FREE_TIER_LIMITS.md](FREE_TIER_LIMITS.md) | Baseline kuota gratis dan pengendalian biaya; angka harus diverifikasi ulang. |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Urutan fase, backlog awal, dan acceptance criteria. |
| [AI_CODING_WORKFLOW.md](AI_CODING_WORKFLOW.md) | Instruksi kerja untuk Codex, OpenCode, atau coding agent lain. |
| [DESIGN.md](DESIGN.md) | Design system dengan glassmorphism dan aksen neon yang subtle. |

## Cara mulai

1. Audit repository Fynence yang sudah ada; jangan membuat ulang atau mengubahnya sebelum kondisinya dipahami.
2. Baca PRD, arsitektur, sumber data, dan batas free tier.
3. Mulai dari Phase 0–2: audit, fondasi/autentikasi, lalu manual journal.
4. Implementasikan analytics setelah kontrak trade dan formula disepakati.
5. Aktifkan provider eksternal hanya setelah kuota, lisensi, coverage, privasi, dan perilaku fallback diverifikasi.

## Status dokumen

Semua dokumen adalah **draft awal**. Dokumen arsitektur, sumber data, dan desain mengubah keputusan yang ada menjadi rencana implementasi; detail SDK, provider, izin data, dan angka layanan yang berubah perlu dikonfirmasi lagi saat implementasi. Lihat [FREE_TIER_LIMITS.md](FREE_TIER_LIMITS.md) untuk provenance angka yang dikutip.
