# Fynence

Trading journal dan market intelligence workspace. Next.js App Router + TypeScript + Tailwind + InsForge/PostgreSQL.

Spesifikasi produk ada di [`Prompt/`](./Prompt/). Kode aplikasi ada di `src/` pada root repo — `Prompt/` hanya berisi dokumen, migration, dan state CLI.

## Prinsip yang mengikat

Empat aturan ini menentukan hampir semua keputusan teknis di repo. Kalau mengubah kode, jangan dilanggar tanpa memperbarui dokumen di `Prompt/` lebih dulu.

1. **Input manual saja.** Tidak ada MT5, broker sync, atau order execution. Tidak ada adapter untuk itu, dan tidak akan ditambahkan tanpa keputusan produk.
2. **Hasil trade dicatat pengguna.** P&L tidak pernah disimpulkan dari pergerakan harga, ukuran lot, atau multiplier kontrak. `realizedNetPnl()` mengembalikan `null` kecuali `status === 'closed'` dan `realized_pnl` terisi.
3. **Tidak ada angka palsu.** Data yang tidak tersedia tampil sebagai *tidak tersedia*, bukan angka sintetis. Provider eksternal tidak dinyalakan sebelum kuota, lisensi, cakupan instrumen, dan fallback diverifikasi.
4. **Layer kalkulasi tunggal.** Semua metrik berasal dari `src/lib/domain/`. Tidak ada halaman yang punya rumusnya sendiri.

## Setup

Butuh Node 20+ dan akses ke project InsForge.

```bash
npm install
cp .env.example .env.local   # isi NEXT_PUBLIC_INSFORGE_URL dan NEXT_PUBLIC_INSFORGE_ANON_KEY
npm run dev
```

Ambil anon key dari CLI InsForge:

```bash
cd Prompt
npx -y @insforge/cli secrets get ANON_KEY
```

### Migration database

CLI InsForge hanya membaca `Prompt/.insforge/project.json`, jadi migration **harus dijalankan dari `Prompt/`**:

```bash
cd Prompt
npx -y @insforge/cli db migrations up --all
```

Nama file migration wajib `<version>_<lowercase-hyphens>.sql`, dan file tidak boleh kosong — CLI membatalkan migration kosong dengan "Migration file is empty".

## Checks

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run build       # next build
```

Keempatnya harus hijau sebelum commit. `npm run build` juga menjalankan lint dan validasi tipe.

## Struktur

```
src/
  app/                     route, server action, dan route handler
    (app)/                 halaman yang butuh sesi: dashboard, journal, analytics, dll.
    api/                   refresh sesi dan streaming screenshot privat
    *-actions.ts           server action per domain (trade, account, screenshot, watchlist, auth)
  components/              komponen UI
  lib/
    domain/                kalkulasi murni + test. Tidak menyentuh jaringan atau DB.
    insforge/              client browser dan server
    trades/, accounts/     query baca
middleware.ts              refresh sesi InsForge tiap request
```

Aturan praktis: `lib/domain/` adalah fungsi murni yang bisa dites tanpa DB. Halaman dan server action memanggilnya; mereka tidak menghitung ulang.

### Layer domain

| File | Isi |
|---|---|
| `trades.ts` | Tipe `Trade`, `realizedNetPnl()`, re-export dari `analytics.ts` |
| `analytics.ts` | `calculateAnalytics()`, kurva equity, drawdown, breakdown per symbol/setup/timeframe/hari |
| `risk.ts` | `plannedRR()`, `realizedR()`, `summarizeRisk()` |
| `reports.ts` | `buildReport()` — ringkasan berbasis aturan, tanpa AI |

Nilai uang di Postgres bertipe `numeric` dan di TypeScript berupa `string`. Semua aritmetika lewat `decimal.js`. Tidak ada `parseFloat` pada nilai uang.

## Model keamanan

Otorisasi ada di database, bukan di UI.

- **RLS aktif di semua tabel aplikasi.** 19 policy di `profiles`, `trading_accounts`, `trades`, `trade_screenshots`, `watchlists`, semuanya memakai `auth.uid()`.
- **Validasi server-side.** Setiap server action memvalidasi ulang input dan memverifikasi kepemilikan sebelum menulis. `account_id` dari client dicek terhadap akun milik pemanggil sebelum insert.
- **Composite FK.** `trades (account_id, user_id) → trading_accounts (id, user_id)` mencegah trade menunjuk akun milik user lain, bahkan kalau ada kode yang lupa mengecek.
- **Bucket privat.** Screenshot ada di bucket privat `trade-screenshots`, key-nya `<user_id>/<trade_id>/<file>`. RLS `storage.objects` membatasi berdasarkan prefix key. Gambar dibaca lewat route terautentikasi `/api/screenshots/[id]`, tidak pernah lewat URL publik.
- **Anon key aman di client.** Anon key memang untuk browser; yang melindungi data adalah RLS, bukan kerahasiaan key.
- **`anon` tidak punya grant apa pun.** Migrasi `20261017000100_revoke-anon-writes.sql` mencabut seluruh hak `anon` di schema `public`, termasuk default privileges untuk tabel baru. Sebelumnya `anon` memegang `INSERT/UPDATE/DELETE/SELECT` di semua tabel: tidak berbahaya karena RLS menolak semuanya, tapi API **berbohong** — `DELETE` menjawab `204` sambil menghapus nol baris, dan `SELECT` menjawab `200 []`. Sekarang semuanya `401`, jadi jawabannya sesuai kenyataan.

Kunci yang tidak boleh masuk repo: `.env.local`, `Prompt/.insforge/`, `insforge.toml`. Semuanya sudah ada di `.gitignore`.

### Hasil audit keamanan (2026-10-17)

Dijalankan manual: `diagnose advisor` dan `diagnose db` **tidak bisa dipakai** pada project yang di-link lewat `--api-key` (`advisor` mengembalikan `scan: null`, `diagnose db` gagal dengan "Unrestricted SQL execution is disabled"). Semua temuan di bawah diverifikasi lewat `db query` dan HTTP langsung dengan token nyata.

| Diuji | Hasil |
|---|---|
| Isolasi antar user (`trades`, `trading_accounts`) | baca/coba-update baris user lain → `200 []`, tidak bocor |
| Tulis lintas user | `401`/`403`, ditolak |
| Isolasi storage | upload ke folder orang lain ditolak **di langkah strategy** (403); baca & hapus objek orang lain → `404`, objek tetap utuh |
| `sub` JWT vs `id` user | identik — prefix `foldername(key)[1]` benar-benar mengikat |
| Tabel deny-all (`market_fetch_log`) | user login → `403`; `anon` → `401` |
| Grant `anon` | dicabut seluruhnya (lihat di atas) |
| Nilai rahasia di bundle klien | tidak ada; hanya anon key yang memang publik |
| Modul server bocor ke klien | tidak ada (`insforge/admin`, `market/ingest`, `rates/store` tidak muncul di `.next/static`) |
| Indeks | setiap kolom filter RLS (`user_id`) terindeks, plus indeks komposit penutup |

Jebakan yang perlu diketahui saat menguji:

- **Baca yang ditolak tidak menghasilkan error.** RLS memfilter baris, jadi PostgREST menjawab `200` dengan array kosong. "Tidak ada data" dan "tidak boleh lihat" terlihat identik dari klien. Saat mendiagnosis hasil kosong, query sebagai service role dulu untuk memastikan barisnya memang ada.
- **Storage upload bukan `POST /objects`.** Endpoint itu **mengabaikan** field path dan membuat key sendiri di root bucket, sehingga selalu gagal dengan `403`. Alur yang benar: `POST /upload-strategy` (validasi izin di sini) → `PUT /objects/<key>` multipart. Pola yang salah akan terlihat seperti masalah izin padahal bukan.
- **`diagnose db` tidak tersedia** di mode `--api-key`. Pakai `db query` langsung.

### Constraint yang menjaga integritas

- `trades_lifecycle_check`: trade `open` tidak boleh punya `closed_at`/`exit_price`/`realized_pnl`; trade `closed` wajib punya `closed_at` dan `exit_price`, dan `closed_at >= opened_at`.
- `trades_stop_side_check` / `trades_target_side_check`: stop harus di sisi rugi dari entry, target di sisi untung.
- FK `ON DELETE RESTRICT` pada akun: akun yang masih dipakai trade tidak bisa dihapus.

## Status per fase

Mengacu `Prompt/IMPLEMENTATION_ROADMAP.md`.

| Fase | Status | Catatan |
|---:|---|---|
| 0 Audit | selesai | — |
| 1 Fondasi & auth | selesai | Email/password + OAuth Google & GitHub |
| 2 Jurnal manual | selesai | CRUD open/closed, akun, screenshot privat, refleksi |
| 3 Analytics & dashboard | selesai | Formula tunggal, drawdown, breakdown, R multiple, laporan berbasis aturan |
| 4 Fondasi data pasar | **tertahan** | Butuh provider terverifikasi |
| 5 Macro Desk | **tertahan** | Tampil tidak tersedia |
| 6 Berita & kalender | **tertahan** | Tampil tidak tersedia |
| 7 Psychology & AI | sebagian | Psikologi berbasis aturan sudah jalan; bagian AI tertahan |
| 8 Community & release | belum | — |

Halaman `/macro`, `/news`, `/calendar` sengaja menampilkan status tidak tersedia. Itu state yang benar, bukan bug dan bukan tempat penampung untuk data dummy.

Kurs referensi (`/kurs`) sudah jalan dan **tidak** tertahan, karena Frankfurter tidak punya gate lisensi. Data pasar tertahan, jadi rilis publik tertahan oleh instrumen, bukan oleh kurs.

## Multi mata uang

Nilai uang sebuah trade tidak punya kolom mata uang sendiri; denominasinya berasal dari akun trade itu (`trading_accounts.base_currency`). Dua aturan mengikat:

1. **Kurs hanya mengubah tampilan, tidak pernah catatan.** P&L tetap angka yang user masukkan. `src/lib/domain/currency.ts` murni dan tidak menulis apa pun.
2. **Uang tidak pernah dijumlahkan lintas mata uang tanpa konversi.** `currencyComposition()` mendeteksi campuran; kalau konversinya tidak tersedia, totalnya **ditahan** dan kekurangannya disebutkan. $100 + Rp100 bukan "200".

Setiap pembacaan trade harus lewat `loadTradesWithCurrency()` (`src/lib/trades/currency-query.ts`) supaya mata uang tidak hilang di satu halaman saja. Trade tanpa akun mendapat `currency: null` — bukan ditebak `'USD'`, karena justru pengecualiannya yang tidak akan terlihat.

## Menambah provider eksternal

Jangan aktifkan provider sebelum semua ini terjawab dan tercatat:

1. **Kuota** — berapa request gratisnya, dan apa yang terjadi saat habis.
2. **Lisensi** — boleh dipakai untuk apa, boleh disimpan berapa lama.
3. **Cakupan** — instrumen mana yang benar-benar tersedia, bukan yang diklaim.
4. **Fallback** — apa yang ditampilkan kalau provider mati.

Kalau salah satu belum jelas, tampilkan state tidak tersedia. Lihat `Prompt/DATA_SOURCES.md` dan `Prompt/FREE_TIER_LIMITS.md`.

## Catatan implementasi

- **`Prefer: return=representation`.** Insert langsung lewat REST InsForge mengembalikan `[]` tanpa header ini, sehingga kelihatan seperti gagal padahal sukses. Lewat SDK tidak masalah.
- **Migrasi dari `Prompt/`.** Dijelaskan di atas. Salah direktori, CLI tidak menemukan project.
- **Nilai uang adalah string.** Jangan konversi ke `number` di tengah perhitungan.
- **Verifikasi RLS dengan user asli.** Beberapa kali pengujian dilakukan dengan membuat user nyata lewat `/api/auth/users` lalu mengecek user lain tidak bisa membaca apa pun, kemudian user tes dihapus. Pola ini lebih meyakinkan daripada membaca policy saja.
