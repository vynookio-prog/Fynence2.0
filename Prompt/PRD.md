# Fynence — Product Requirements Document

**Status:** Draft awal  
**Tipe produk:** Aplikasi web untuk trading journal dan market intelligence  
**Input trade:** Manual saja; tanpa sinkronisasi MT5/broker  
**Sasaran biaya:** Rp0 dalam batas free tier yang berlaku

## 1. Ringkasan produk

Fynence membantu trader mencatat transaksi, mengevaluasi performa, memahami konteks pasar, dan merefleksikan kualitas eksekusi serta kebiasaan trading. Aplikasi menggabungkan trading journal, analytics, Macro Desk, Market Deep Dive, psychology insights, laporan, kalender ekonomi, berita, komunitas, dan pengaturan.

HybridTrader hanya menjadi referensi untuk konsep modul dan alur pengalaman pengguna. Fynence tidak menyalin source code, formula proprietary, maupun mengklaim mereproduksi algoritma internal HybridTrader. Seluruh perhitungan dan logika harus didefinisikan serta diuji sendiri.

## 2. Tujuan produk

1. Membuat pencatatan transaksi manual cepat, konsisten, dan dapat direfleksikan.
2. Menghasilkan statistik yang dapat ditelusuri ke transaksi pengguna.
3. Menyediakan overview pasar melalui Macro Desk dan analisis per instrumen melalui Deep Dive.
4. Mengidentifikasi pola disiplin dan eksekusi dari data yang benar-benar tersedia.
5. Menyediakan laporan pasar/performa dengan timestamp dan sumber yang jelas.
6. Menjaga privasi, isolasi data pengguna, dan transparansi keterbatasan data.
7. Mempertahankan core journal meski API pasar, AI, berita, atau kalender tidak tersedia.

## 3. Non-goals dan pengecualian

- Tidak ada koneksi, sinkronisasi, atau impor otomatis dari MT5/broker.
- Tidak ada eksekusi order.
- Tidak ada klaim bahwa AI menjamin profit, memprediksi harga dengan pasti, atau memberi diagnosis psikologis.
- Tidak ada data pasar, berita, atau event fiktif yang disajikan sebagai aktual.
- Tidak ada ketergantungan wajib pada API berbayar untuk fitur inti.
- Tidak menggunakan Supabase; stack backend target adalah InsForge/PostgreSQL.
- CSV import bukan bagian MVP; evaluasi terpisah setelah manual journal stabil.
- Algoritma internal HybridTrader tidak diketahui dan tidak menjadi spesifikasi Fynence.

## 4. Pengguna sasaran

Trader retail forex, indeks, komoditas, dan kripto yang ingin mencatat trade, memeriksa konsistensi strategi, melihat pola keputusan, serta memahami kondisi pasar. Kebutuhan utama: entry jurnal yang praktis, statistik performa, review rencana/eksekusi, watchlist aset, chart, berita/event yang bersumber, dan refleksi pribadi.

## 5. Struktur produk dan kebutuhan fitur

### 5.1 Dashboard

Ringkasan total/net P&L, win rate, profit factor, jumlah transaksi, equity curve, transaksi terbaru, akun, quick-add trade, dan ringkasan psikologi. Widget pasar, berita, dan event harus terpisah dari statistik akun dan boleh menampilkan unavailable state bila provider belum aktif.

### 5.2 Macro Desk

Overview Market Mood, Asset Bias, conviction/alignment, movers, perubahan bias, watchlist, event mendatang, berita lintas aset, dan ringkasan/assistant. Setiap kartu aset membuka Deep Dive terkait. Bias wajib menyertakan alasan, timeframe, waktu evaluasi, dan provenance; bila data tidak cukup, tampilkan unavailable/insufficient-data.

### 5.3 Market Deep Dive

Halaman detail satu instrumen. Kandidat aset awal: XAUUSD, US30, US500, MNQ, dan BTCUSD. Modul dapat mencakup harga terakhir yang tersedia, chart/timeframe, indikator teknikal, Edge Factor, Flow, Bearing, Pulse, investor positioning bila tersedia, market policy, economic outlook, related assets, sessions, relative strength, news, notes, dan coverage. Istilah Edge Factor/Flow/Bearing/Pulse adalah konsep Fynence; definisi serta formula harus ditentukan dan diuji sendiri.

### 5.4 Trading Journal

- Daftar transaksi dengan pencarian simbol, filter tanggal/status/akun/arah, sorting, pagination, dan detail.
- CRUD transaksi manual; status Open dan Closed.
- Form bertahap: trade information; trade plan; actual entry; exit untuk transaksi Closed; reflection.
- Data: symbol, account, Long/Short, status, waktu buka/tutup, entry/exit, position size, stop-loss, take-profit, fees, setup, timeframe, risk, alasan exit, notes, rating setup, kualitas eksekusi, kepatuhan rencana, emosi, screenshot opsional.
- Open trade tidak memerlukan harga exit dan tidak dihitung sebagai realized P&L.
- Validasi harga, ukuran, waktu, account ownership, status, dan aturan kelengkapan Closed. Penghapusan harus menjaga integritas record terkait.

### 5.5 Trading Analytics

Net/gross P&L, win rate, profit factor, average win/loss, expectancy, equity curve, drawdown, breakdown waktu/simbol/setup/session/account, dan durasi trade bila timestamp tersedia. Satu calculation layer harus dipakai oleh detail, dashboard, dan analytics. Definisi breakeven, fee, konversi mata uang, incomplete data, dan denominator nol wajib konsisten serta terdokumentasi.

### 5.6 Psychology dan AI Trade Coach

Insight deterministik dari plan adherence, emosi yang dicatat, pola loss, dan kualitas eksekusi. AI bersifat opsional untuk menjelaskan data atau membantu review; kirim data seminimal mungkin, validasi respons, labeli AI-generated, dan sediakan fallback rule-based yang jelas. Tidak membuat diagnosis psikologis atau menyimpulkan hal yang tak tercatat.

### 5.7 Reports

Daily Brief, Weekly Outlook, Special Event, dan Post-event Recap. Simpan tipe/periode, waktu pembuatan, status, dan provenance. Laporan historis tidak boleh ditampilkan seolah-olah terbaru.

### 5.8 Economic Calendar dan News Feed

Kalender: waktu + timezone pengguna (default `Asia/Jakarta`), currency, impact, date filters, detail, dan sumber. Berita: headline/metadata, publisher, waktu terbit, waktu pengambilan, filter aset/kategori, dan tautan ke sumber asli. Jangan menyalin isi artikel penuh tanpa izin atau mengarang event/headline.

### 5.9 Community

Channel directory, percakapan, replies, reactions, dan attachments. Prioritas setelah fitur inti stabil; rilis publik memerlukan authorization, pagination, rate limiting, moderation, dan pelaporan konten.

### 5.10 Settings dan trading accounts

Profile, preferensi, tema, timezone, akun trading, journal settings, watchlist, data management, dan account security. Pengguna dapat memiliki beberapa akun virtual/jurnal bila batas layanan mendukung. Saldo/equity adalah input manual atau kalkulasi internal, bukan saldo broker aktual.

## 6. Persyaratan non-fungsional

- Responsive desktop, tablet, dan mobile; komponen reusable dan aksesibel.
- Loading, empty, error, success, unavailable, stale, serta insufficient-data states.
- Server-side validation; semua record privat dibatasi ke pengguna terautentikasi.
- API key hanya di server; attachment dibatasi tipe/ukuran dan diotorisasi.
- Pagination/indexing untuk dataset; hindari polling dan retry tanpa batas.
- Journal harus tetap berjalan tanpa market API, news/calendar API, dan AI.
- Tidak mengklaim offline persistence kecuali mekanisme local draft dibuat dan diuji.

## 7. Stack target

Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide, Recharts (analytics), dan Lightweight Charts (market chart setelah lisensi/kompatibilitas diperiksa); InsForge dengan PostgreSQL; GitHub; Vercel Hobby untuk penggunaan personal/nonkomersial yang memenuhi ketentuan. Nama SDK/API InsForge harus diverifikasi dari dokumentasi resmi sebelum implementasi.

## 8. Prioritas rilis

1. Fondasi, autentikasi, authorization, dan design system.
2. Akun trading + manual journal.
3. Calculation engine + analytics/dashboard.
4. Market-data foundation + chart.
5. Macro Desk + Deep Dive.
6. News, calendar, reports.
7. Psychology + AI.
8. Community + release review.

## 9. Kriteria penerimaan MVP

- User dapat mendaftar/login/logout; halaman privat membutuhkan sesi.
- Data antar-pengguna terisolasi dan diuji.
- User dapat membuat akun dan create/read/update/delete trade manual.
- Open/Closed, validation, trade plan, reflection, dan attachment opsional berfungsi.
- Filter/pencarian journal berjalan dan dashboard sesuai calculation layer.
- Open trades tidak masuk realized performance.
- Journal tetap berfungsi tanpa MT5, market API, dan AI.
- Tidak ada harga/news/event palsu yang ditampilkan sebagai aktual.

## 10. Prinsip keputusan

Keberhasilan diukur dari fitur yang benar-benar bekerja, kalkulasi konsisten, sumber dan timestamp yang dapat ditelusuri, keamanan yang diuji, dan biaya terkendali—bukan dari jumlah halaman yang tampak selesai.
