# Fynence — Data Sources and Provenance

**Status:** Kandidat awal; belum ada provider pasar, kalender, berita, atau AI yang disetujui untuk produksi. Verifikasi dokumentasi, coverage, lisensi, kuota, dan privasi sebelum mengaktifkan integrasi.

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
- [Alpha Vantage](https://www.alphavantage.co/documentation/) — kandidat historis/market data; allowance dan endpoint yang berlaku harus dicek ulang.
- Observasi manual — boleh sebagai catatan, tetapi setiap rekaman harus diberi label `manual` dan waktu input.
- Dataset historis — gunakan hanya setelah sumber, lisensi, redistribusi, retention, dan cakupan instrumen diverifikasi.

### Pemeriksaan sebelum aktivasi

Catat URL harga/dokumentasi resmi, limit free yang berlaku di akun, aturan kredit per request, endpoint/simbol/timeframe, historical depth, delay, hak display komersial, aturan cache/redistribusi, serta tanggal verifikasi. Uji coverage terpisah untuk XAUUSD, BTCUSD, US30, US500, dan MNQ; jangan menganggap nama simbol mirip berarti instrumen/kontrak identik.

### Kebijakan pengambilan

Minta hanya interval/simbol yang diperlukan; deduplicate request; cache secara bounded hanya jika diizinkan; batasi retry/concurrency; hormati HTTP 429; jangan rotasi key/akun untuk melewati limit. Saat quota habis: hentikan request, gunakan cache sah dengan timestamp nyata, gunakan alternatif yang sudah disetujui untuk data/instrumen yang sama, atau tampilkan unavailable. Jangan menampilkan data historis sebagai live.

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
| Market API | Belum dipilih; quota dan coverage belum disetujui. |
| Kalender | Belum dipilih. |
| Berita | Belum dipilih; lisensi/retention perlu ditinjau. |
| Kurs referensi | Kandidat Frankfurter; terms/current behavior perlu ditinjau. |
| AI | Kandidat Gemini; model, quota, dan data-use terms harus ditinjau. |
| Manual trade entry | Diputuskan sebagai jalur input trade MVP; tanpa MT5. |

**Jangan aktifkan provider hanya karena endpoint dapat dipanggil.** Persetujuan integrasi baru mensyaratkan dokumentasi resmi, penggunaan yang diizinkan, limit yang diketahui, secret server-side, fallback teruji, dan update dokumen ini.
