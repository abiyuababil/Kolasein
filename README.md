# Kolasein

Aplikasi web modern dan responsif untuk membuat kolase foto dalam satu frame secara fleksibel. Bekerja langsung di browser (client-side) tanpa ketergantungan server dan tanpa perlu login.

## Fitur Utama

- **Multi-Upload Foto**: Unggah foto sebanyak apa pun sekaligus lewat drag and drop, file picker, atau paste dari clipboard (Ctrl+V).
- **Pilihan Aspect Ratio**: Rasio instan untuk Instagram Post (1:1), Instagram Portrait (4:5), Instagram Story/Reels (9:16), Landscape (16:9), serta rasio kustom bebas.
- **Resize Dinamis**: Geser border pemisah foto secara langsung. Memperbesar satu foto otomatis mengecilkan foto di sebelahnya secara proporsional.
- **Drag & Drop Reorder**:
  - Geser thumbnail foto di sidebar untuk mengubah urutan.
  - Tombol cepat geser (`‹` dan `›`) serta shortcut keyboard (`Alt + Panah`).
  - Tarik handle grip (`⋮⋮`) langsung pada frame kolase untuk bertukar posisi antar foto.
- **Template Layout Preset**:
  - Pilihan preset layout instan yang adaptif sesuai jumlah foto (Grid 2x2, Grid 3x3, 1 Atas + 3 Bawah, dll).
  - Dilengkapi ikon miniatur untuk memudahkan identifikasi susunan.
- **Simpan & Buka Proyek (.kolasein)**:
  - Simpan proyek ke dalam file mandiri `.kolasein` (memuat data gambar, posisi crop, rasio, gap, dan susunan baris).
  - Buka kembali file proyek kapan saja di perangkat mana pun.
  - Auto-save draf otomatis di browser (`localStorage`) agar pekerjaan tidak hilang saat refresh.
- **Mobile Responsive & Touch-First**:
  - Antarmuka khusus mobile dengan panel tab bawah terorganisir (Layout, Foto, Gaya, Proyek).
  - Fitur tap-to-swap: cukup tap dua thumbnail berturut-turut untuk bertukar posisi di layar sentuh.
  - Tombol download sticky di bagian bawah yang nyaman dijangkau ibu jari.
- **Ekspor Gambar**: Unduh hasil akhir kolase dalam format PNG jernih atau JPG ringan beresolusi tinggi.

## Teknologi

- **HTML5** (Semantik & ARIA accessible)
- **Vanilla CSS** (Modern CSS variables, Flexbox & Grid, media queries responsif)
- **Vanilla JavaScript** (ES Modules, Canvas API, Pointer Events)

## Cara Menjalankan

Aplikasi ini murni client-side dan tidak memerlukan proses compile:

1. Clone repositori:
   ```bash
   git clone https://github.com/abiyuababil/Kolasein.git
   ```
2. Buka file `index.html` langsung di peramban, atau jalankan menggunakan server lokal:
   ```bash
   npx serve .
   ```
3. Buka peramban di `http://localhost:3000`.

## Lisensi

MIT License
