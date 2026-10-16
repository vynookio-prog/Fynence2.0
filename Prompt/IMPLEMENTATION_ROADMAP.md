# Fynence — Implementation Roadmap

**Status:** Rencana eksekusi awal  
**Stack target:** Next.js + TypeScript + Tailwind + shadcn/ui + InsForge/PostgreSQL  
**Input transaksi:** Manual saja; tidak ada MT5/broker sync

## Prinsip pengerjaan

1. Selesaikan dan uji satu fase sebelum menyatakan fase berikutnya siap.
2. Prioritaskan fungsionalitas, data correctness, dan keamanan sebelum polish visual.
3. Jangan menampilkan data pasar dummy sebagai aktual.
4. Jangan mengaktifkan provider sebelum quota, instrument coverage, lisensi, dan fallback diverifikasi.
5. Audit repository dan pertahankan konfigurasi valid yang sudah ada.
6. Gunakan domain/calculation layer bersama; jangan menduplikasi formula antarhalaman.
7. Tiap fitur memiliki loading, empty, error, success, dan bila perlu stale/unavailable states.
8. Bila keputusan baru mengubah PRD, arsitektur, sources, atau free-tier policy, perbarui dokumen terlebih dahulu.

## Ringkasan fase

| Fase | Fokus | Hasil |
|---:|---|---|
| 0 | Audit repository dan planning | Kondisi proyek diketahui; backlog dan risiko tercatat. |
| 1 | Fondasi dan autentikasi | Design system, auth, database awal, authorization, deploy baseline. |
| 2 | Manual trading journal | Akun dan CRUD trade Open/Closed yang aman. |
| 3 | Analytics dan dashboard | Formula tunggal, tests, dashboard dari journal. |
| 4 | Fondasi data pasar | Provider abstraction, chart, provenance, fallback. |
| 5 | Macro Desk dan Deep Dive | Overview dan analisis aset dengan data cukup. |
| 6 | Berita, kalender, reports | Sumber terverifikasi dan arsip laporan. |
| 7 | Psychology dan AI Coach | Insights evidence-based dan AI opsional. |
| 8 | Community dan release | Moderation, security/performance review, rilis. |

Fase 0–3 adalah prioritas tertinggi. Produk sudah harus berguna setelah analytics/dashboard, meski provider eksternal belum aktif.

## Phase 0 — Audit repository

**Tugas:** periksa struktur, package manager, `package.json`, versi framework, Tailwind/shadcn, environment, InsForge connection, Git status, perubahan lokal, komponen reusable, dan test/build commands. Cocokkan dengan dokumen ini tanpa mengganti konfigurasi secara membabi buta.

**Deliverable:** audit notes, dependency inventory, daftar risiko/verifikasi tertunda, development commands, dan checklist.

**Lulus jika:** proyek yang ada dapat dijalankan atau blocker dicatat; perubahan yang belum di-commit tetap teridentifikasi; SDK/backend yang belum diverifikasi ditandai pending.

## Phase 1 — Foundation dan authentication

**Tugas:** Next.js App Router, TypeScript strict bila kompatibel, lint/format, Tailwind/shadcn, layout/sidebar/header, design tokens dari `DESIGN.md`, state components, InsForge API verification, environment config, migrations untuk `profiles`, `trading_accounts`, `trades`, auth pages/session/protected routes, dan authorization tests dua pengguna.

**Lulus jika:** register/login/logout berfungsi; private pages require session; cross-user access ditolak; secrets tidak ada di bundle client; migration repeatable; deploy cocok dengan plan terms.

## Phase 2 — Manual Trading Journal

**Tugas:** CRUD akun trading; form trade bertahap (information, plan, entry, exit, reflection); list/detail; search/filter/sort/pagination; edit/delete dengan relasi konsisten; attachment opsional/private; validasi server-side.

**Lulus jika:** create/read/edit/delete dan Open/Closed workflow benar; account/trade ownership diperiksa; form menolak input invalid; open trade tidak butuh exit; fee tidak dihitung dua kali; jurnal berfungsi tanpa market API dan AI.

## Phase 3 — Analytics dan dashboard

**Tugas:** domain functions gross/net P&L, win rate, profit factor, avg win/loss, expectancy, equity curve, drawdown, breakdown simbol/setup/waktu/account; definisikan breakeven, fee, currency, missing data, zero denominator, dan treatment trade Open. Bangun card, chart, recent trades, empty state, Quick Add.

**Tes:** Long/Short, win/loss/breakeven, fees, no gross loss, missing values, empty account, beberapa trade, edit/delete, konsistensi detail/dashboard/analytics.

**Lulus jika:** semua metrik berasal dari calculation layer tunggal; open trade bukan realized P&L; perubahan data langsung tercermin secara konsisten.

## Phase 4 — Market-data foundation

**Tugas:** verifikasi provider/simbol/timeframe/historical depth/terms; buat provider interface dan adapter; normalisasi OHLC; validasi timestamp; cache sesuai izin; timeout, bounded retries, 429, stale/unavailable handling; chart dan indikator EMA50/200, RSI, MACD, ATR hanya dari input cukup.

**Lulus jika:** setiap bar memiliki provenance; data historis tidak dilabel live; provider failure tidak menghasilkan harga palsu; instrumen tak didukung menunjukkan unavailable; quota exhaustion tidak membuat retry loop.

## Phase 5 — Macro Desk dan Deep Dive

**Tugas:** Macro Desk untuk mood/bias/movers/watchlist/event preview/news preview; navigasi aset ke Deep Dive. Deep Dive menyusun chart, technical breakdown, Edge Factor, Flow, Bearing, Pulse, market sessions, related assets, positioning/outlook/news hanya bila sumber tersedia. Dokumentasikan formula, confidence semantics, timeframe, alasan, versi, dan evaluation time.

**Lulus jika:** navigasi berfungsi; semua skor punya definisi dan alasan; data kurang menghasilkan unavailable/insufficient-data; rule-based dan AI output dibedakan jelas.

## Phase 6 — News, calendar, reports

**Tugas:** pilih sumber setelah izin/kuota diverifikasi; normalisasi/deduplicate news metadata; source URL dan publication/retrieval time; calendar timezone (default `Asia/Jakarta`), currency/impact/date filters; report Daily Brief/Weekly Outlook/Special Event/Post-event Recap; simpan owner, periode, waktu, status, provenance.

**Lulus jika:** tidak ada headline/event fiktif; timezone konsisten; sumber dapat ditelusuri; report lama dibedakan dari report terbaru; fallback empty/unavailable bekerja.

## Phase 7 — Psychology dan AI Trade Coach

**Tugas:** rule-based insight dari plan adherence, recorded emotions, losing streaks, setup performance, dan risk behavior; review provider/model terms/quota/privacy; server-side adapter; minimize payload; schema-validate output; timeout/rate-limit/error handling; AI-generated labels; rule-based fallback.

**Lulus jika:** tiap insight memiliki basis data/evidence; tidak ada diagnosis psikologi atau klaim trading tanpa dukungan; core tetap berfungsi saat AI gagal; AI data-use terms sudah direview.

## Phase 8 — Community dan release

**Tugas:** channels, messages, replies, reactions, attachments, pagination, authorization, rate limiting, moderation/reporting. Lakukan security review (cross-user, files, XSS, secrets, logging, deletion) dan performance review (indexes, pagination, chart lazy-load, bundle, mobile, provider concurrency). Jalankan unit/integration/E2E/build, cek migrations, backups/recovery, quota, hosting eligibility.

**Lulus jika:** prioritas acceptance criteria terpenuhi; build/tests lulus; authorization, provider terms, dan free-tier eligibility ditinjau; tidak ada fitur yang melaporkan save sukses tanpa konfirmasi backend.

## Backlog awal yang disarankan

1. Audit repository Fynence yang sudah ada.
2. Cocokkan repo dengan PRD dan arsitektur.
3. Tambahkan/rapikan dokumentasi.
4. Verifikasi integrasi InsForge dan authorization.
5. Terapkan design system dasar.
6. Implementasikan autentikasi.
7. Buat migration tabel inti.
8. Uji isolasi data.
9. Bangun trading accounts.
10. Implementasikan manual trade entry.

Jangan mulai dari AI, komunitas, atau integrasi pasar kompleks sebelum fondasi tersebut stabil.

## Coding agent workflow

Ikuti instruksi lengkap di [AI_CODING_WORKFLOW.md](AI_CODING_WORKFLOW.md). Minta agent memulai dengan **audit repo**, bukan rewrite atau membangun semua modul sekaligus. Setelah setiap task: lint, typecheck, unit tests, build, integration/E2E yang relevan, diff review, update docs; perbaiki test gagal sebelum melanjutkan.

**Urutan produk:** Reliable Journal → Correct Analytics → Verified Market Data → Macro Intelligence → Psychology and AI → Community.
