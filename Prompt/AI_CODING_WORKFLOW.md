# Fynence — AI Coding Agent Workflow

Instruksi untuk Codex, OpenCode, atau coding agent lain yang membantu membangun repository Fynence.

## Konteks wajib

Sebelum mengubah kode, baca:

1. `README.md`
2. `PRD.md`
3. `ARCHITECTURE.md`
4. `DATA_SOURCES.md`
5. `FREE_TIER_LIMITS.md`
6. `IMPLEMENTATION_ROADMAP.md`
7. `DESIGN.md` untuk task UI

Lalu periksa repo yang sudah ada, package manager, scripts, Git status/diff, framework version, environment keys (tanpa mencetak secret), tests, dan integrasi yang telah berjalan.

## Batas produk yang tidak boleh diubah diam-diam

- Trade entry manual only; jangan menambahkan MT5, broker sync, atau order execution.
- HybridTrader hanya referensi fitur/UX. Jangan klaim menyalin formula/source code proprietary.
- Jangan mengganti provider/backend atau menambah layanan berbayar tanpa proposal/perubahan dokumentasi yang jelas.
- Jangan tampilkan dummy/fixture market data sebagai harga aktual.
- Jangan mengarang API/SDK InsForge atau provider. Cek dokumentasi dan versi terpasang.
- Jangan mengirim data jurnal privat ke model eksternal sebelum terms dan minimisasi data ditinjau.
- Jangan menghapus konfigurasi valid atau mengubah scope tanpa catatan.

## Sebelum coding

- Pilih satu task kecil yang memenuhi roadmap; sebutkan scope dan acceptance tests.
- Identifikasi files/components/domain services yang bisa dipakai ulang.
- Catat asumsi, blocker, dan integrasi yang belum terverifikasi.
- Jika ada keputusan yang mengubah behavior, privacy, provider, biaya, atau scope, update dokumen yang relevan sebelum implementasi.

## Saat coding

- Hindari rewrite seluruh aplikasi tanpa alasan teknis yang terukur.
- Gunakan reusable components dan shared services.
- Simpan business rules di domain/application layer; jangan duplikasi kalkulasi di komponen UI.
- Terapkan server-side validation dan authorization untuk setiap akses/mutasi privat.
- Gunakan decimal-safe calculation untuk nilai finansial.
- Pastikan loading, empty, error, success, stale/unavailable states tersedia.
- Batasi API request, concurrency, dan retries; hormati rate limits.
- Jangan menambahkan dependency tanpa kebutuhan dan alasan.
- Jangan menaruh keys/secrets dalam client bundle, repo, log, atau test output.

## Setelah coding

1. Jalankan lint.
2. Jalankan typecheck.
3. Jalankan unit tests.
4. Jalankan build.
5. Jalankan integration/E2E yang relevan.
6. Periksa Git diff/status dan pastikan tidak ada perubahan tak terkait.
7. Perbarui dokumentasi terkait.
8. Laporkan files changed, test yang dijalankan/hasilnya, asumsi, dan blocker.

Jika test penting gagal, perbaiki sebelum melanjutkan. Jangan melaporkan test yang tidak dijalankan sebagai lulus.

## Task pertama yang disarankan

Audit repository Fynence yang telah ada; jangan langsung membuat ulang proyek dari nol. Berikan ringkasan struktur, scripts, dependensi, status Git, fitur yang bisa digunakan kembali, kekurangan terhadap dokumen ini, dan rencana Phase 0–1. Tunggu keputusan baru hanya jika memang diperlukan untuk mencegah perubahan yang materially mengubah scope atau kebijakan.
