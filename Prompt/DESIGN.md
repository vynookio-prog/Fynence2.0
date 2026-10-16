# Fynence — Design System

**Status:** Draft awal  
**Arah visual yang diputuskan:** antarmuka dark-first bergaya financial terminal, glassmorphism yang subtle, dan neon/emerald glow yang subtle. Tujuan utamanya tetap keterbacaan, kejelasan data, dan UI yang responsif.

## 1. Prinsip desain

1. **Data first:** angka, label, timestamp, dan sumber lebih penting daripada dekorasi.
2. **Subtle glass:** gunakan translucent surfaces seperlunya; bukan blur besar pada seluruh layar.
3. **Subtle neon:** emerald sebagai aksen aktif/fokus, bukan warna dominan pada semua elemen.
4. **Clear status:** profit/loss, stale/unavailable, AI-generated, dan data provenance dibedakan dengan label + warna + teks.
5. **Calm density:** dashboard bisa padat tetapi memiliki hierarki, whitespace, dan alignment konsisten.
6. **Accessible:** kontras, focus state, keyboard, ukuran target sentuh, dan reduced-motion preference diperhatikan.
7. **Responsive:** tabel dan chart tetap dapat digunakan di mobile, bukan sekadar dikecilkan.

## 2. Fondasi visual

Gunakan token semantik CSS/Tailwind; nilai berikut merupakan titik awal untuk diuji pada UI nyata.

### Warna

| Token | Nilai awal | Penggunaan |
|---|---|---|
| `background` | `#080C10` | Latar utama dark. |
| `surface` | `#0E151B` | Panel/card dasar. |
| `surface-raised` | `#121D24` | Popover, dialog, elevated card. |
| `surface-glass` | `rgba(20, 30, 37, 0.72)` | Glass surface dengan border halus. |
| `border-subtle` | `rgba(148, 163, 184, 0.14)` | Border pemisah. |
| `text-primary` | `#E8F0F2` | Konten utama. |
| `text-secondary` | `#97A6AD` | Metadata dan label sekunder. |
| `accent-emerald` | `#35D39A` | Primary action/focus/positive accent. |
| `accent-glow` | `rgba(53, 211, 154, 0.16)` | Glow tipis pada active/focus surface. |
| `positive` | `#35D39A` | Nilai positif; tetap disertai simbol/teks. |
| `negative` | `#FF6B75` | Nilai negatif; jangan mengandalkan warna saja. |
| `warning` | `#F0B75E` | Warning/stale/medium impact. |
| `info` | `#66B8F4` | Informasi dan status netral. |

Pastikan kombinasi teks memenuhi kontras WCAG yang relevan; cek dengan alat sebelum shipping. Warna P&L harus selalu disertai tanda +/− atau label, bukan warna tunggal.

### Tipografi

- UI: gunakan sans-serif sistem atau font UI yang sudah ada dalam repo; jangan menambah font dependency tanpa kebutuhan.
- Angka finansial: pilih tabular numerals (`font-variant-numeric: tabular-nums`) agar kolom stabil.
- Heading: jelas, semibold; hindari all caps yang panjang.
- Label data: pendek dan konsisten; timestamp/source jangan disembunyikan.

### Spacing, radius, elevation

- Gunakan skala spacing konsisten berbasis 4 px.
- Panel/card: radius moderat (sekitar 12–16 px); control kecil lebih rendah.
- Border tipis dan shadow lembut; glassmorphism hanya pada panel yang perlu pemisahan visual.
- Hindari efek blur berat yang menurunkan kontras atau performa mobile.

## 3. Glassmorphism dan neon

**Surface recipe:** dark translucent fill, border 1 px yang ringan, shadow halus, blur lokal secukupnya. Pastikan teks di atas glass tetap terbaca di seluruh state dan background.

**Glow recipe:** gunakan satu halo emerald lembut pada primary action, focus ring, atau selected state. Jangan menambahkan glow ke setiap card/chart/angka. Neon tidak menandakan profit; gunakan hanya sebagai aksen interaksi.

## 4. Layout dan navigasi

- Desktop: sidebar navigasi yang stabil, header dengan judul halaman, konteks akun/periode, dan quick action.
- Mobile: navigasi ringkas; action utama tetap mudah dijangkau; filter/table berpindah ke layout yang dapat di-scroll atau daftar kartu.
- Gunakan page container, grid, dan spacing yang konsisten.
- Modul inti: Dashboard, Macro Desk, Journal, Analytics, Psychology, Reports, Calendar, News, Community, Settings. Deep Dive dibuka dari aset di Macro Desk (bukan wajib menjadi menu utama terpisah).

## 5. Komponen dasar

- Buttons: primary, secondary, ghost, destructive; disabled/loading state.
- Inputs: label, helper text, error state, keyboard focus.
- Selects, dropdowns, tabs, dialogs, tooltips.
- Cards/panels, badges, tables, pagination, chart containers.
- Skeleton loading, empty state, error state, confirmation dialog, toast.
- Data-provenance label: provider/manual/derived/AI; last updated; stale/unavailable.

Semua control harus punya state dan tindakan nyata; jangan tampilkan tombol dekoratif yang belum berfungsi.

## 6. Pola visual per modul

### Dashboard & Analytics

Ringkasan performa di bagian atas; P&L dan metrik memiliki satuan, periode, serta konteks account. Chart equity hanya dari transaksi valid; empty state memberi langkah menambah trade. Hindari chart yang membuat perubahan kecil tampak dramatis.

### Journal

Prioritaskan scanability: symbol, direction, status, tanggal, result, setup. Angka rata kanan dan tabular. Di mobile, gunakan row/card yang menampilkan data penting tanpa memaksa tabel horizontal yang berlebihan. Filter aktif terlihat dan bisa dihapus.

### Macro Desk & Deep Dive

Tampilkan sumber, timeframe, klasifikasi live/delayed/historical, dan waktu update dekat dengan nilai. Bias, conviction, dan skor disertai alasan, definisi, serta status data. Jangan gunakan chip warna tanpa arti yang terdokumentasi.

### Psychology & AI

Tone netral dan tidak menghakimi. Pisahkan bukti tercatat, aturan deterministik, dan interpretasi AI. Label AI-generated terlihat; sediakan konteks dan keterbatasan. Tidak ada bahasa diagnosis.

### News & Calendar

Headline menautkan ke sumber asli; timestamp dan timezone eksplisit. Impact color memiliki label teks. Event stale/unavailable tidak disamarkan sebagai update terbaru.

## 7. Chart dan status

- Chart menunjukkan label instrumen, timeframe, sumber, klasifikasi data, dan last updated.
- Grid/axis subdued; warna seri konsisten; tooltip menyertakan nilai dan waktu.
- Jangan menampilkan harga contoh sebagai quote sungguhan. Fixtures hanya untuk test dan harus diberi label jelas.
- Status states: `Current`, `Delayed`, `Historical`, `Manual`, `Derived`, `AI-generated`, `Stale`, `Unavailable`, `Insufficient data`.

## 8. Interaksi dan aksesibilitas

- Focus ring terlihat, sejalan dengan accent namun memiliki kontras yang memadai.
- Target sentuh mobile idealnya minimal 44×44 CSS px.
- Jangan menyampaikan status hanya lewat warna; sertakan ikon/teks.
- Hormati prefers-reduced-motion; hindari animasi dekoratif berulang.
- Modal dapat dinavigasi keyboard, memiliki label, dan memulihkan focus setelah ditutup.
- Form error terhubung ke field dan menjelaskan cara memperbaiki.

## 9. Implementasi

Gunakan Tailwind CSS + shadcn/ui dengan CSS variables/tokens semantik. Pertahankan library chart yang telah disetujui project; pilih Recharts untuk analytics dan pertimbangkan Lightweight Charts untuk chart pasar hanya setelah lisensi/kompatibilitas diperiksa. Hindari custom CSS berulang; buat komponen bersama untuk status provenance, metric card, chart container, dan empty/error states.

## 10. Acceptance checklist

- [ ] Dark-first UI dengan glassmorphism yang terbatas dan halus.
- [ ] Emerald/neon glow dipakai sebagai aksen, bukan dekorasi berlebihan.
- [ ] Kontras teks, angka, badge, dan status telah diuji.
- [ ] Profit/loss dan data status tidak hanya dibedakan melalui warna.
- [ ] Loading, empty, error, unavailable, stale, dan success states tercakup.
- [ ] Journal/table/chart dapat digunakan pada mobile.
- [ ] Focus, keyboard, touch targets, dan reduced motion diperiksa.
- [ ] UI tidak menyiratkan data palsu sebagai data real-time.
