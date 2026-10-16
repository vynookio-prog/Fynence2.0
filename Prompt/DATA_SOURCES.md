# Fynence — Data Sources and Provenance

**Status:** Kandidat awal; belum ada provider pasar, kalender, berita, atau AI yang disetujui untuk produksi. Verifikasi dokumentasi, coverage, lisensi, kuota, dan privasi sebelum mengaktifkan integrasi.

**Update 2026-10-16:** Verifikasi teknis pertama selesai untuk Twelve Data, Alpha Vantage, dan Gemini API (hasil di bawah). Ini verifikasi teknis — bukan persetujuan produksi. Keputusan lisensi display dan kuota harian akun masih perlu konfirmasi sebelum modul pasar/AI diaktifkan. Key disimpan di root `.env.local` (gitignored): `TWELVEDATA_API_KEY`, `ALPHAVANTAGE_API_KEY`, `GEMINI_API_KEY` — server-side saja, jangan pernah di `NEXT_PUBLIC_*`.

## 1. Prinsip

1. Jangan pernah mengarang harga, berita, event, atau positioning.
2. Bedakan data **live/near-live**, **delayed**, **historical**, **manual**, **derived**, dan **AI-generated interpretation**.
3. Simpan provider/source, timestamp sumber, waktu pengambilan, instrumen, timeframe, dan keterbatasan data.
4. Historical/reference rates bukan harga trading real-time.
5. API yang dapat diakses publik belum tentu bebas untuk ditampilkan, disimpan, atau didistribusikan.
6. Core trading journal tetap dapat dipakai tanpa provider mana pun.
7. Tidak ada sinkronisasi MT5/broker; input trade tetap manual.

## 2. Market data

### Kandidat

- [Twelve Data](https://twelvedata.com/docs) — kandidat quote/series; kuota per akun, endpoint, simbol, interval, delay, dan lisensi harus dikonfirmasi.
- [Alpha Vantage](https://www.alphavantage.co/documentation/) — kandidat historis/market data; allowance dan endpoint yang berlaku harus dicek ulang. **Verifikasi 2026-10-16:** key valid (`TIME_SERIES_DAILY` IBM → 200, bar 2026-10-15); limit free dari respons API resminya: **25 request/hari, 1 request/detik**. Coverage 5 instrumen (1 request masing-masing): `BTCUSD` via `TIME_SERIES_DAILY` **OK**; XAU **tidak tersedia di free** (`FX_DAILY`/`CURRENCY_EXCHANGE_RATE` invalid, `FX_INTRADAY` berstatus premium endpoint); `US30` invalid; `SPX` respons kosong `{}`; `MNQ` invalid. Kesimpulan: dari 5 instrumen Fynence, hanya BTC yang tercakup — Alpha Vantage bukan solusi pasar/indeks.
- Observasi manual — boleh sebagai catatan, tetapi setiap rekaman harus diberi label `manual` dan waktu input.
- Dataset historis — gunakan hanya setelah sumber, lisensi, redistribusi, retention, dan cakupan instrumen diverifikasi.

### Hasil verifikasi 2026-10-16 (Twelve Data)

Akun Basic (free) terverifikasi, key valid. Coverage diuji terpisah sesuai pemeriksaan wajib di atas:

| Instrumen Fynence | Simbol diuji | Hasil |
|---|---|---|
| XAUUSD | `XAU/USD` | OK — `time_series` 1 hari, `status ok`, `type: Precious Metal`. Bar terakhir close `4177.42008` (2026-10-16). |
| BTCUSD | `BTC/USD` | OK — `status ok`, `type: Digital Currency`. |
| US500 | `US500`, `SPX` | Dikenali tapi **terkunci plan** — error: "available starting with the Pro or Venture plan". Tidak ada di free tier. |
| US100 | `US100`, `NDX` | **Terkunci plan** — `US100` butuh **Pro/Venture**, `NDX` butuh **Grow/Venture**. Tidak ada di free tier. |
| US30 | `US30`, `DJI` | **Tidak ditemukan** — error: symbol invalid pada reference data. Ticker asli belum terkonfirmasi; jangan asumsikan. |
| MNQ | `MNQ`, `MNQ1!` | **Tidak didukung** — Twelve Data punya katalog stocks/forex/crypto/ETF/funds/commodities/bonds; tanpa katalog futures. Jangan menganggap MNQ tersedia. |

**Temuan katalog 2026-10-17 — verifikasi ulang US100/US30:** katalog `/indices` berisi 1.309 simbol dari 37 negara, tetapi **nol indeks Amerika Serikat**. `?exchange=NASDAQ` dan `?exchange=NYSE` keduanya mengembalikan `count: 0`. Tidak ada US30, US100, NDX, DJI, SPX, maupun US500 di katalog mana pun yang dapat diakses free tier.

Konsekuensi: masalahnya **bukan hanya plan-gating**. `US100`/`NDX` memang ada tetapi berbayar; `US30`/`DJI` tidak ada di katalognya sama sekali. Yang tersedia gratis bagi instrumen AS hanyalah **ETF proxy**: `QQQ` (NASDAQ-100) dan `DIA` (Dow Jones) — keduanya `type: ETF`, bukan indeks. ETF melacak indeks tetapi bukan indeks itu sendiri, dan harganya berbeda (ada tracking error, dividen, dan struktur NAV). Menampilkan harga QQQ sebagai "US100" adalah klaim yang salah.

Jalan yang sah bila indeks AS tetap dibutuhkan: naik ke plan Grow/Pro/Venture, atau tampilkan QQQ/DIA dengan **label eksplisit sebagai ETF proxy**, bukan sebagai indeks.

**Koreksi kategori 2026-10-17 — equity Nasdaq, bukan indeks.** Kebutuhan "Nasdaq" ternyata merujuk pada **saham yang tercatat di bursa Nasdaq**, bukan indeks. Ini katalog dan jalur yang berbeda, dan hasilnya positif:

| Yang diuji | Katalog | Hasil |
|---|---|---|
| `/indices` (indeks) | — | **0 simbol AS** dari 1.309. Semua indeks AS tertutup. |
| `/stocks?exchange=NASDAQ` (equity) | ✅ | **4.531 saham** tersedia, `status: ok` |

Uji `time_series` pada equity Nasdaq free tier — semua `200`, `type: Common Stock`, `exchange: NASDAQ`:

| Simbol | Hasil |
|---|---|
| `AAPL` | ✅ 200 |
| `MSFT` | ✅ 200 |
| `NVDA` | ✅ 200 |
| `TSLA` | ✅ 200 |
| `AMD` | ✅ 200 |

**Kesimpulan:** jalur indeks AS buntu di free tier, tetapi jalur **equity Nasdaq terbuka lebar**. Saham individual tidak terkena plan-gate seperti indeks. Ini membuka Macro Desk/Deep Dive berbasis emiten (mis. NVDA, AAPL) alih-alih berbasis indeks.

Catatan penting: equity adalah **instrumen yang berbeda** dari indeks. Jangan menampilkan saham sebagai pengganti indeks, dan sebaliknya. `/stocks` juga memuat `Warrant`, `Right`, `American Depositary Receipt`, dan `Unit` — bukan hanya `Common Stock`. Filter berdasarkan `type` sebelum menampilkan atau menghitung apa pun.



Fakta kuota/lisensi dari halaman resmi ([pricing](https://twelvedata.com/pricing), Basic): 8 API kredit/menit, 800 kredit/hari, 8 trial WS kredit, hanya 3 markets, dan **"Internal non-display usage"**.

**Putusan lisensi 2026-10-17** (dari [Terms of Use](https://twelvedata.com/terms) + [artikel Commercial and personal usage](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage), terakhir diubah 2026-08-04): plan Individual (termasuk Basic) **strictly untuk personal/internal use** — non-production, tools internal, riset/edukasi. **Tidak mengizinkan** redistribution maupun commercial display ke pihak ketiga. External display butuh Redistribution Rights Add-On atau perjanjian tertulis; attribution wajib bila data ditampilkan publik. Implikasi untuk Fynence: journal pribadi = masih personal use, wajib atribusi bila ditampilkan publik; **SaaS untuk user lain = tidak boleh di free tier** — gate rilis komersial, bukan sekadar TODO teknis.

Biaya kredit: `/time_series` = 1/simbol, `/quote` `/price` `/eod` = 1/simbol, `/time_series/cross` = 5/request. Hormati 429; batasi ≤ 8 kredit/menit dan ≤ 800/hari; jangan rotasi key.

Endpoint reference `/search` dan `/indexes` `/futures` `/forex` mengembalikan 404 (tidak ada). Yang hidup: `/stocks` `/etfs` `/funds` (200). `/symbol_search` ada tapi fuzzy — hasil tidak cocok untuk klaim coverage.

### Pemeriksaan sebelum aktivasi

Catat URL harga/dokumentasi resmi, limit free yang berlaku di akun, aturan kredit per request, endpoint/simbol/timeframe, historical depth, delay, hak display komersial, aturan cache/redistribusi, serta tanggal verifikasi. Uji coverage terpisah untuk setiap instrumen yang benar-benar dibutuhkan; jangan menganggap nama simbol mirip berarti instrumen/kontrak identik.

**Cakupan setelah penyesuaian 2026-10-17** (US500 dihapus; US100 dan US30 menggantikannya):

| Instrumen | Twelve Data free | Alpha Vantage free | Catatan |
|---|---|---|---|
| XAUUSD | ✅ `XAU/USD` | ❌ premium | Hanya Twelve Data |
| BTCUSD | ✅ `BTC/USD` | ✅ `TIME_SERIES_DAILY` | Satu-satunya yang lolos di dua provider |
| Saham Nasdaq (equity) | ✅ (`/stocks?exchange=NASDAQ`, 4.531 simbol; AAPL/MSFT/NVDA/TSLA/AMD semua 200) | ❌ tidak diuji | **Jalur terbuka** — tidak kena plan-gate |
| US100 | ❌ plan-gated (`US100` Pro/Venture, `NDX` Grow/Venture) | ❌ tidak diuji | Butuh plan berbayar, atau pakai `QQQ` dengan label ETF proxy |
| US30 | ❌ tidak ada di katalog (`count: 0`) | ❌ invalid | Tidak ada bahkan di katalog; hanya `DIA` sebagai ETF proxy |
| MNQ | ❌ tidak didukung (tanpa katalog futures) | ❌ invalid | Tidak akan tersedia di provider ini berapa pun plan-nya |

**Kesimpulan cakupan:** indeks AS tidak dapat dipenuhi di free tier (US100 plan-gated, US30 tidak ada di katalog). Yang terbuka: **XAUUSD, BTCUSD, dan seluruh equity Nasdaq** (4.531 simbol). Bila Macro Desk dipindahkan dari indeks ke emiten, cakupannya justru paling luas — tetapi lisensi Twelve Data free tier tetap personal/internal saja.



### Kebijakan pengambilan

Minta hanya interval/simbol yang diperlukan; deduplicate request; cache secara bounded hanya jika diizinkan; batasi retry/concurrency; hormati HTTP 429; jangan rotasi key/akun untuk melewati limit. Saat quota habis: hentikan request, gunakan cache sah dengan timestamp nyata, gunakan alternatif yang sudah disetujui untuk data/instrumen yang sama, atau tampilkan unavailable. Jangan menampilkan data historis sebagai live.

### Catatan implementasi InsForge SDK (2026-10-17)

Diverifikasi terhadap project nyata, bukan dari dokumentasi:

- **SDK tidak menerjemahkan nama field.** Objek ber-key camelCase dikirim apa adanya dan ditolak `PGRST204 Could not find the '<field>' column`. Setiap insert/upsert harus memakai nama kolom snake_case secara eksplisit. Ini pernah membuat seluruh `market_fetch_log` senyap tidak tertulis.
- **Insert yang berhasil mengembalikan `data: []`** dengan `status: 201`. Sukses tidak bisa disimpulkan dari `data.length`; periksa `error` dan `status`.
- **`error` yang tidak diperiksa = kegagalan senyap.** Konsekuensinya nyata di sini: anggaran kredit dibaca dari `market_fetch_log`, jadi log yang tidak tertulis membuat setiap fetch tampak gratis dan `checkBudget` selalu mengizinkan.
- `market_fetch_log` sengaja **tanpa policy apa pun**. Hanya `project_admin` (service key) yang punya grant; ini disengaja, bukan RLS yang lupa dikonfigurasi.

## 3. Kurs referensi

[Kandidat Frankfurter](https://frankfurter.dev/) untuk kurs referensi harian/historis. Periksa terms, sumber, jadwal update, dan cache policy. Jangan gunakan kurs referensi harian sebagai harga forex trading real-time. Simpan tanggal rate dan source; jika rate historis tidak ada, ungkapkan kekurangan tersebut.

## 4. Kalender ekonomi

Kandidat: rilis resmi bank sentral/lembaga statistik pemerintah; [Trading Economics API](https://docs.tradingeconomics.com/get_started/) sebagai opsi yang harus diverifikasi, bukan sumber yang telah disetujui. Pastikan akses gratis, coverage, actual/forecast/previous, impact classification, historical events, timezone, update frequency, attribution, dan redistribution rights. Default zona waktu aplikasi `Asia/Jakarta`.

Jika provider gagal, gunakan event cache yang sah dengan status stale, atau tampilkan empty/unavailable. Jangan membuat jadwal, forecast, atau impact yang tidak bersumber.

## 5. Berita pasar

Kandidat: publisher APIs, RSS feed publisher bila diizinkan, pengumuman institusi resmi, dan [GDELT](https://www.gdeltproject.org/). Tidak diasumsikan ada satu kuota universal yang gratis. Untuk setiap sumber, periksa request limit, terms, content licensing, retention, attribution, reliability, dan izin menampilkan teks artikel.

Utamakan metadata dan tautan ke artikel asli; hindari menyalin artikel penuh; deduplicate; simpan waktu publikasi dan waktu retrieval. Jika tak ada sumber yang memenuhi syarat, gunakan empty state—jangan membuat headline fiktif.

## 6. AI

[Kandidat Gemini API — pricing](https://ai.google.dev/gemini-api/docs/pricing) dan [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). Akses dan quota bergantung model, project, serta ketentuan terkini; jangan mengunci satu angka request harian tanpa pemeriksaan. Periksa ketentuan penggunaan data untuk free tier sebelum mengirim jurnal privat.

**Verifikasi 2026-10-16:** key valid — `/v1beta/models` → 200. Generasi terverifikasi end-to-end dengan `gemini-flash-lite-latest` → 200, `finishReason: STOP`. Catatan model: `gemini-2.0-flash` dan `gemini-2.5-flash` sudah pensiun untuk user baru (404, arahkan ke `gemini-3.8-flash`); `gemini-3.8-flash` dan `gemini-flash-latest` sempat 503 "high demand" (transien — tangani sebagai retry-with-backoff, bukan key rusak).

**Rate limit 2026-10-17:** halaman [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) resmi kini berbasis spend + tier project — **tidak ada satu angka publik yang bisa di-hardcode**. Angka RPM/TPM/RPD yang berlaku harus dibaca dari AI Studio pada project yang dipakai (pilih model, catat angka yang tampil). Kebijakan lama di dokumen ini ("jangan mengunci angka harian tanpa pemeriksaan") tetap berlaku dan sekarang jadi satu-satunya jalur yang sah. Data-use terms free tier belum ditinjau — tetap wajib sebelum kirim data jurnal privat.

AI opsional; jangan mengirim rahasia atau data jurnal yang tidak diperlukan. Gunakan formula deterministik untuk metrik finansial, validasi response, hindari regenerasi identik, dan batasi request. Fallback rule-based harus dilabeli sebagai rule-based, bukan AI. Jika tugas tidak aman/andal tanpa AI, tandai fitur unavailable.

## 7. Kontrak metadata provenance

Setiap rekaman pasar/event/berita yang disimpan sebaiknya mencatat:

- `provider` atau nama sumber dan URL sumber jika relevan.
- `source_timestamp` / waktu publikasi dan `retrieved_at`.
- `instrument`/currency/timeframe atau kategori yang sesuai.
- `data_class`: live, delayed, historical, manual, derived, atau AI interpretation.
- `status`: current, stale, unavailable, partial, atau insufficient-data.
- Attribution/licensing/retention notes jika disyaratkan.

Untuk analisis turunan, catat versi metode, input yang dipakai, timeframe, evaluation timestamp, alasan, serta data yang tidak tersedia. Pisahkan indikator kalkulasi dari interpretasi AI.

## 8. Sumber dan fallback per modul

| Modul | Sumber utama yang mungkin | Fallback |
|---|---|---|
| Journal/analytics | Record manual pengguna | Tetap gunakan data tersimpan; tidak perlu API eksternal. |
| Macro Desk/Deep Dive | Provider market yang sudah diverifikasi + kalkulasi Fynence | Cache valid bertimestamp; jika tidak ada, unavailable/insufficient data. |
| FX conversion | Frankfurter atau sumber yang disetujui | Rate manual yang diberi label atau ungkapkan rate tidak tersedia. |
| Calendar | Sumber resmi atau provider disetujui | Cache sah berlabel stale; bila tidak ada, empty/unavailable. |
| News | Publisher/API/RSS/GDELT yang terms-nya sesuai | Empty state dan tautan sumber bila metadata tersedia. |
| Psychology | Catatan trade dan aturan deterministik | Tampilkan hanya insight yang didukung data. |
| AI Coach/reports | Model opsional yang disetujui | Rule-based untuk tugas yang didukung; selain itu AI unavailable. |

## 9. Status persetujuan awal

| Domain | Status |
|---|---|
| Market API | Twelve Data: teknis terverifikasi 2026-10-16 (XAU/USD, BTC/USD ok; US100/US500 plan-gated; US30 tidak ada di katalog — 0 indeks AS dari 1.309; MNQ tidak didukung); **lisensi 2026-10-17: free tier personal/internal only — SaaS komersial dilarang di plan Individual**. Alpha Vantage: 2026-10-17 coverage hanya BTCUSD; XAU premium, US30/MNQ invalid, SPX kosong. |
| Kalender | Belum dipilih. |
| Berita | Belum dipilih; lisensi/retention perlu ditinjau. |
| Kurs referensi | Frankfurter: MCP `https://mcp.frankfurter.dev/` terpasang di OpenCode global dan `connected` (tools: `convert`, `get_rates`, `list_currencies`, `list_providers`), endpoint 200 tanpa auth. Terms/update/cache tetap perlu ditinjau sebelum dipakai app. |
| AI | Gemini: teknis terverifikasi 2026-10-16 (`gemini-flash-lite-latest` generasi OK) — rate limit tier dan data-use terms belum ditinjau. |
| Manual trade entry | Diputuskan sebagai jalur input trade MVP; tanpa MT5. |

**Jangan aktifkan provider hanya karena endpoint dapat dipanggil.** Persetujuan integrasi baru mensyaratkan dokumentasi resmi, penggunaan yang diizinkan, limit yang diketahui, secret server-side, fallback teruji, dan update dokumen ini.
