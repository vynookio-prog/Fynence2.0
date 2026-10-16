# Fynence — Free-Tier Limits and Cost Control

**Status:** Baseline awal dari percakapan yang dibagikan; angka di bawah belum diverifikasi ulang dalam sesi ini.  
**Tujuan biaya:** Rp0 selama penggunaan memenuhi kuota dan terms layanan.  
**Peringatan:** Kuota, harga, eligibility, dan data-use terms dapat berubah. Verifikasi sumber resmi dan dashboard akun sebelum implementasi/deploy.

## 1. Kebijakan biaya

- Core journal tidak memerlukan market/news/calendar/AI API.
- Tidak ada auto-upgrade atau fallback berbayar otomatis.
- Jangan menganggap free tier tidak terbatas atau akan tersedia selamanya.
- Jangan mengirim request/polling tanpa batas; deduplicate, cache hanya jika diizinkan, batasi concurrency dan retry.
- Jangan memutar API key/akun untuk melewati quota.
- Saat layanan limit/paused: degraded state yang jelas, bukan data buatan atau perpindahan database diam-diam.
- Rp0 adalah sasaran desain, bukan jaminan biaya permanen atau data real-time tanpa batas.

## 2. Baseline kuota yang tercantum dalam chat sumber

### Vercel Hobby

Referensi resmi: [Pricing](https://vercel.com/pricing), [Limits](https://vercel.com/docs/limits), [Plans](https://vercel.com/docs/plans), [Terms](https://vercel.com/legal/terms).

| Resource | Angka yang disebut dalam chat sumber |
|---|---:|
| Harga | $0 |
| Deployments per hari | 100 |
| Build time per deployment | 45 menit |
| Build execution | 6.000 menit |
| Fast Data Transfer | 100 GB |
| Function invocations | 1 juta |
| Active CPU | 4 CPU-hours |
| Provisioned memory | 360 GB-hours |
| Concurrent builds | 1 |
| Runtime log retention | 1 jam |
| CLI source upload | 100 MB |

Chat sumber menyatakan Hobby untuk penggunaan personal/nonkomersial. **Sebelum meluncurkan SaaS komersial, pastikan eligibility hosting; jangan menganggap Hobby sesuai.** Kuota bukan jaminan performa atau traffic tanpa batas. Bila limit tercapai, hentikan polling nonesensial, pertahankan deploy stabil yang masih bekerja, dan jangan membuat loop redeploy.

### InsForge Free

Referensi resmi yang dicantumkan: [Pricing](https://insforge.dev/pricing), [repository dokumentasi](https://github.com/InsForge/InsForge), [FAQ](https://github.com/InsForge/InsForge/blob/main/docs/faq.mdx).

| Resource | Angka yang disebut dalam chat sumber |
|---|---:|
| Harga | $0/bulan |
| Monthly active users | 50.000 |
| Database | 500 MB |
| Bandwidth | 5 GB |
| File storage | 1 GB |
| Edge function calls | 100.000 |
| Site build time | 600 menit |
| Custom compute | 120 jam pada spesifikasi default |
| AI model credits | $1 |

Chat sumber menyatakan free project dapat dijeda setelah 7 hari tanpa aktivitas atau saat batas penggunaan terlampaui. Periksa perilaku resume dan retention saat deploy. Hemat database dengan index/pagination, simpan gambar di file storage (bukan DB blobs), batasi field response, hindari full reload dan always-on worker. Jangan menganggap semua CRUD menggunakan atau tidak menggunakan edge-function quota tanpa verifikasi billing model aktual. Backend unavailable berarti write tidak diklaim berhasil.

## 3. Provider lain — status quota

| Provider/jenis | Status di chat sumber | Kebijakan |
|---|---|---|
| Twelve Data | Kuota persis untuk akun/endpoint belum dikonfirmasi | Verifikasi akun, plan, simbol, interval, dan kredit request. |
| Alpha Vantage | Ada batas free; angka/endpoint yang berlaku harus dicek lagi | Gunakan dokumentasi endpoint terkini dan cek limit per akun. |
| Manual observations | Tidak memakai quota API | Setiap item harus diberi label manual dan waktu input. |
| Historical datasets | Bergantung sumber dan lisensi | Verifikasi akuisisi, penyimpanan, dan reuse. |
| Frankfurter | Kandidat kurs referensi | Periksa terms, sumber, update, dan cache policy. |
| Kalender | Provider belum dipilih | Jangan menganggap situs publik berarti API gratis/unrestricted. |
| Berita/GDELT/RSS | Tidak ada kuota universal yang diasumsikan | Periksa request limits, lisensi, retention, dan atribusi per sumber. |
| Gemini API | Batas spesifik per model/project | Recheck pricing/rate limits dan ketentuan penggunaan data. |

Dokumentasi kandidat: [Twelve Data](https://twelvedata.com/docs), [Alpha Vantage](https://www.alphavantage.co/documentation/), [Frankfurter](https://frankfurter.dev/), [Trading Economics](https://docs.tradingeconomics.com/get_started/), [GDELT](https://www.gdeltproject.org/), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## 4. Pemeriksaan wajib sebelum mengaktifkan layanan

Catat URL resmi, quota pada akun yang dipilih, rules per endpoint, simbol/instrumen, historical depth, market delay, lisensi display komersial, caching/redistribution, retention, privasi/data-use, dan tanggal pemeriksaan. Untuk AI, jangan mengirim trade journal privat sebelum ketentuan data-use ditinjau dan data yang dikirim diminimalkan.

## 5. Degradasi fitur

| Fitur | Saat layanan eksternal gagal |
|---|---|
| Manual journal & transaksi tersimpan | Tetap berfungsi selama backend tersedia. |
| Analytics | Hitung dari data transaksi tersimpan. |
| Dashboard | Tampilkan metrik journal; hilangkan atau tandai widget pasar yang unavailable. |
| Macro Desk/Deep Dive | Cache yang sah dengan timestamp nyata atau unavailable/insufficient data. |
| News/calendar | Cache yang diizinkan dan label stale; jika tidak ada, empty/unavailable. |
| Psychology/Trade Coach | Gunakan aturan deterministik yang terdokumentasi; tandai jika AI tidak tersedia. |
| Reports | Buat laporan rule-based hanya bila sumber datanya cukup; simpan provenance. |
| Community | Bergantung pada backend; tampilkan error terkontrol jika backend tidak ada. |

Tidak ada klaim penyimpanan offline saat database down kecuali local draft mechanism benar-benar dibangun dan diuji.

## 6. Pengendalian penggunaan dan monitoring

- Batasi jumlah instrumen, rentang waktu, frekuensi refresh, concurrency, dan retry.
- Gunakan pagination dan field selection; jangan repeatedly load seluruh trade history.
- Hindari duplikasi request dan report generation yang sama.
- Pantau deploy/build, bandwidth/functions, database size, storage, edge calls, provider quota/error/staleness, dan AI quota.
- Buat alert jika tersedia, tanpa mengasumsikan setiap layanan menyediakannya.
- Jangan menyimpan lebih banyak market/news data daripada izin sumber.
- Hentikan request ke provider yang limitnya habis sampai reset/recovery yang sah.

## 7. Release gates

1. **Core Journal:** bekerja tanpa market, news, calendar, atau AI.
2. **Market analysis:** aktif hanya setelah coverage, quality, licensing, caching, quota, dan provenance terverifikasi.
3. **News/calendar:** aktif hanya setelah terms dan akurasi sumber ditinjau.
4. **AI:** aktif hanya setelah model, kuota, privacy/data-use, response validation, dan fallback direview.
5. **Public/commercial launch:** tinjau ulang eligibility hosting/layanan dan seluruh kuota.

## 8. Catatan verifikasi

| Layanan | URL | Status |
|---|---|---|
| Vercel Hobby | [Limits](https://vercel.com/docs/limits) | Angka berasal dari chat sumber; verifikasi ulang sebelum deploy. |
| InsForge Free | [Pricing](https://insforge.dev/pricing) | Angka berasal dari chat sumber; verifikasi ulang di dashboard. |
| Market API | [Twelve Data](https://twelvedata.com/docs), [Alpha Vantage](https://www.alphavantage.co/documentation/) | Pending account/endpoint check. |
| FX reference | [Frankfurter](https://frankfurter.dev/) | Kandidat; terms/update perlu dicek. |
| Calendar/news | Provider belum dipilih | Pending. |
| AI | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) | Model-specific; review data-use terms. |

**Prinsip akhir:** Rp0 harus dijaga oleh arsitektur dan kontrol penggunaan—bukan asumsi bahwa semua layanan gratis tanpa batas.
