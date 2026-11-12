# 📖 Panduan Penggunaan ProPresenter Lyric Animator

Aplikasi desktop mandiri berbasis **Electron** untuk **ProPresenter v7 / v20.x** yang menampilkan lirik dengan animasi In & Out bergaya **After Effects**, membaca **Theme / Slide ProPresenter 1:1**, menampilkan **Media** langsung dari ProPresenter tanpa NDI, serta mendeteksi resolusi layar fisik langsung dari Windows.

---

## 🚀 Cara Menjalankan Aplikasi

Klik dua kali file shortcut:
- [`Jalankan_Lyric_Animator.bat`](Jalankan_Lyric_Animator.bat)

Atau melalui terminal:
```bash
npm run app
```

*(Tekan **F12** di jendela utama kapan saja untuk membuka/menutup panel DevTools.)*

---

## 🛠️ 1. Pengaturan di ProPresenter

1. Buka **ProPresenter** -> **Settings / Preferences** -> **Network**.
2. Centang **"Enable Network"** (Port bawaan: `50001`).

---

## 🎨 2. Sinkronisasi Theme & Media (Tanpa NDI)

Aplikasi secara otomatis mengikuti layer yang aktif di ProPresenter:
* **Slide & Theme 1:1:** Membaca otomatis font, ukuran, warna, posisi kotak, blur, bayangan, serta aset PNG dari Theme/Look yang aktif maupun langsung dari file `.pro` presentasi.
* **Media Layer:** Video/gambar dari *Media Bin* atau *Media Action* pada slide langsung diputar di layer background tanpa perlu NDI.
* **Messages Layer:** Pesan aktif ProPresenter tampil otomatis sebagai overlay.

*(Jika aplikasi dijalankan di komputer yang berbeda dari komputer ProPresenter, arahkan field **Folder Share ProPresenter** ke folder jaringan ProPresenter agar file `.pro`, Theme, dan Media lokal tetap terbaca langsung.)*

---

## 📺 3. Output Langsung ke Proyektor / Videotron LED

1. Daftar monitor di pojok kanan atas membaca resolusi fisik langsung dari Windows (mis. `1920x1200`, `1920x1080`).
2. Pilih monitor tujuan pada dropdown lalu klik **tombol bulat Output** di sebelah kanan:
   * **Merah**: Output belum aktif (non-aktif) — klik untuk menampilkan layar Fullscreen di monitor tujuan.
   * **Hijau**: Output sedang aktif (Live) — klik untuk mematikan/menutup layar output.
3. Tekan **F1** (atau klik **Clear (F1)**) untuk membersihkan lirik sementara hingga slide berikutnya ditekan di ProPresenter.
