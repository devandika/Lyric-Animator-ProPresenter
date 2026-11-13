# 📖 Panduan Lengkap Penggunaan ProPresenter Lyric Animator

Buku panduan resmi pengoperasian aplikasi **ProPresenter Lyric Animator** untuk operator multimedia gereja, konser, dan siaran langsung.

> 💡 **Versi Notepad:** Panduan ini juga tersedia dalam format teks biasa di file [`PANDUAN_PENGGUNAAN.txt`](PANDUAN_PENGGUNAAN.txt) yang siap dibuka langsung melalui aplikasi Windows Notepad.

---

## 📑 Daftar Isi
1. [Pengenalan & Cara Memulai](#1-pengenalan--cara-memulai)
2. [Pengaturan Koneksi ProPresenter](#2-pengaturan-koneksi-propresenter)
3. [Sinkronisasi Theme, Slide & Media 1:1](#3-sinkronisasi-theme-slide--media-11)
4. [Mengatur Output ke Layar Proyektor / Videotron](#4-mengatur-output-ke-layar-proyektor--videotron)
5. [Animasi Lirik After Effects (In & Out)](#5-animasi-lirik-after-effects-in--out)
6. [Efek Teks Bergoyang Kontinu (Wiggle & Distorsi)](#6-efek-teks-bergoyang-kontinu-wiggle--distorsi)
7. [Tombol Cepat Suasana (Mood) & Shortcut Keyboard](#7-tombol-cepat-suasana-mood--shortcut-keyboard)
8. [Web Remote Control dari Smartphone via QR Code](#8-web-remote-control-dari-smartphone-via-qr-code)
9. [Panduan Pemecahan Masalah (Troubleshooting)](#9-panduan-pemecahan-masalah-troubleshooting)
10. [Tips Penggunaan Saat Ibadah / Event Live](#10-tips-penggunaan-saat-ibadah--event-live)

---

## 1. Pengenalan & Cara Memulai

### 1.1 Apa itu ProPresenter Lyric Animator?
**ProPresenter Lyric Animator** adalah aplikasi desktop pendamping ProPresenter v7 / v20.x yang membuat tampilan lirik menjadi dinamis menggunakan animasi kinetik After Effects, membaca Theme & tata letak ProPresenter secara 1:1, memutar background media tanpa NDI, dan dapat dikontrol secara nirkabel dari smartphone operator/WL via QR Code.

### 1.2 Cara Menjalankan Aplikasi
Cukup klik dua kali file shortcut:
- [`Jalankan_Lyric_Animator.bat`](Jalankan_Lyric_Animator.bat)

*(Tekan **F12** pada keyboard kapan saja untuk membuka atau menutup panel konsol DevTools).*

---

## 2. Pengaturan Koneksi ProPresenter

Cukup lakukan pengaturan ini sekali saja di komputer ProPresenter:
1. Buka **ProPresenter** $\rightarrow$ menu bar atas **Preferences** (atau **Settings**) $\rightarrow$ tab **Network**.
2. Centang kotak **"Enable Network"**.
3. Pastikan kolom **Port** berisi angka bawaan: `50001`.
4. Di aplikasi Animator, periksa lampu indikator di pojok kiri atas:
   - 🟢 **Terhubung (OpenAPI)** : Aplikasi siap menerima slide lirik.
   - 🔴 **Terputus** : Klik tombol **↻ Reconnect** untuk menyambungkan ulang.

---

## 3. Sinkronisasi Theme, Slide & Media 1:1

Aplikasi membaca aset ProPresenter secara langsung tanpa delay dan tanpa NDI:
- **Sinkronisasi Look & Theme:** Font, warna teks, koordinat kotak teks, bayangan (*shadow*), dan outline terbaca otomatis mengikuti Theme Look atau layout slide.
- **Dukungan Multi-Textbox:** Slide dengan dua atau lebih kotak teks (misal: baris liturgos/pembicara di atas dan respons jemaat di bawah) dirender secara independen tanpa tumpang tindih.
- **Background Media Pool:** Video loop (MP4, MOV, WebM) dan gambar dari Media Bin diputar langsung secara lokal dengan *warm-slot pool* tanpa kedip hitam (*no black frame*).
- **Indikator Layer:** Menampilkan status aktif untuk layer *Live Input*, *Media*, *Slide*, *Props* (lengkap dengan nama prop aktif), *Announcements*, dan *Messages*.

---

## 4. Mengatur Output ke Layar Proyektor / Videotron

Aplikasi mendeteksi resolusi monitor fisik Windows secara native (DPI-aware):
1. Pada header atas, klik dropdown monitor (misal: `🖥️ Layar 2 (1920x1080) [Eksternal]`).
2. Klik tombol lingkaran monitor di sebelahnya:
   - **Lingkaran Merah:** Layar output MATI (Offline) $\rightarrow$ Klik untuk membuka jendela Fullscreen tanpa border di proyektor/videotron tujuan.
   - **Lingkaran Hijau:** Layar output AKTIF (Live) $\rightarrow$ Klik untuk mematikan/menutup output live.
3. Gunakan tombol ikon jendela pop-out di pojok kanan atas preview monitor jika operator ingin memisahkan tampilan monitor live ke jendela tersendiri.

---

## 5. Animasi Lirik After Effects (In & Out)

### 5.1 Menyalakan / Mematikan Animasi (F2)
- **Tombol ✨ Animasi ON (Hijau):** Lirik masuk dan keluar menggunakan animasi kinetik After Effects.
- **Tombol ✨ Animasi OFF (Abu-abu):** Animasi dinonaktifkan, tampilan lirik mengikuti pergantian slide ProPresenter.

### 5.2 Pilihan 28+ Preset Animasi
- **Worship:** *Cinematic Blur & Rise* (penyembahan lambat), *Smooth Slide Up* (bersih modern), *Elegant Fade*.
- **Per-Huruf:** *Typewriter* (mesin ketik), *Spring Pop Letter*, *3D Flip X Reveal*.
- **Per-Kata:** *Kinetic Pop Words*, *Word Stagger Drop*.
- **Per-Baris:** *Line Mask Slide Up*.
- **Satu Slide:** *Zoom Blur Impact*.

### 5.3 Mode Transisi Saat Animasi Off: Fade vs Cut
Saat tombol Animasi dimatikan, Anda dapat memilih gaya transisi slide:
- **🌊 Fade:** Transisi crossfade simultan yang halus tanpa jeda kosong (*smooth continuous crossfade*).
- **⚡ Cut:** Pindah slide langsung secara seketika (*cut*).

---

## 6. Efek Teks Bergoyang Kontinu (Wiggle & Distorsi)

Efek teks kontinu memberikan gerakan halus yang terus hidup selama lirik tampil di layar:
- **Tombol 〰️ Efek Teks:** Menghidupkan/mematikan efek goyang secara global.
- **Pilihan Preset:** *AE Wiggle Posisi*, *AE Wiggle Kata*, *Handheld Camera*, *Wave & Swing*, *Glitch Displace*, *Glow Pulse*.
- **Slider Intensitas (`0.2x` - `2.5x`):** Mengatur amplitudo/jarak goyangan teks.
- **Slider Kecepatan (`0.2x` - `3.0x`):** Mengatur tempo cepat/lambatnya gerakan.
- *Catatan:* Seluruh preset dan slider efek teks tetap dapat diatur secara leluasa meskipun tombol efek sedang OFF.

---

## 7. Tombol Cepat Suasana (Mood) & Shortcut Keyboard

### Daftar Shortcut Keyboard Bawaan
| Tombol | Fungsi |
| :--- | :--- |
| **F1** | **Clear Layar Lirik** (Membersihkan slide di preview, output, dan layer Slide ProPresenter) |
| **F2** | **Toggle Animasi Teks** (ON = Animasi Kinetik / OFF = Transisi Slide) |
| **F3** | **Mood Cepat: Worship** (Cinematic Blur & Rise, 2.0s) |
| **F4** | **Mood Cepat: Praise** (Typewriter Reveal, 0.7s) |
| **F5** | **Mood Cepat: Liturgi** (Animasi Off / Bersih ProPresenter) |
| **Panah Kiri ($\leftarrow$)** | Pindah ke Slide Sebelumnya |
| **Panah Kanan ($\rightarrow$)** | Pindah ke Slide Berikutnya |
| **F12** | Buka / Tutup DevTools Konsol Pengembang |

*(Shortcut dan tombol cepat dapat disesuaikan di menu **⚙️ Pengaturan**).*

---

## 8. Web Remote Control dari Smartphone via QR Code

Kontrol animasi dan efek lirik secara nirkabel dari genggaman tangan:
1. Pastikan HP dan laptop terhubung ke jaringan Wi-Fi yang sama.
2. Klik tombol **`📱 Kontrol HP`** di pojok kanan atas header aplikasi laptop.
3. Pindai **QR Code** yang muncul menggunakan kamera smartphone Anda.
4. Begitu tersambung, tombol di laptop otomatis berubah menjadi **`🟢 Terhubung HP`**.
5. Di browser HP, Anda dapat:
   - Menyalakan/mematikan Animasi secara instan.
   - Memilih transisi **Fade** atau **Cut** saat Animasi Off.
   - Memilih preset animasi favorit dan mengatur slider durasi.
   - Menyalakan/mematikan Efek Teks, memilih preset, dan mengatur intensitas/kecepatan.
   - Menekan tombol merah **🗑️ Clear Layar Lirik (F1)** untuk membersihkan layar darurat.
6. **Bebas Lag & Hemat Baterai:** Tanpa streaming video live di HP, respon instan (< 10 ms), dan dilengkapi fitur *Auto-Reconnect* saat layar HP dibuka kembali dari mode sleep.

---

## 9. Panduan Pemecahan Masalah (Troubleshooting)

### Status Aplikasi "Terputus"
- Pastikan ProPresenter sudah dibuka.
- Pastikan opsi *Enable Network* di ProPresenter sudah dicentang dan port `50001`.
- Klik tombol **↻ Reconnect** di pojok kiri atas.

### HP Tidak Bisa Membuka Halaman Remote
- Pastikan HP dan laptop tersambung ke router Wi-Fi yang sama.
- Periksa Windows Firewall (izinkan *Private Networks* jika diminta).
- Pada modal QR Code di laptop, gunakan dropdown pilihan IP untuk memilih alamat IP Wi-Fi laptop Anda.

### Layar Output Proyektor Tidak Muncul
- Pastikan kabel HDMI/DisplayPort proyektor sudah terhubung ke laptop.
- Di Windows, tekan tombol `Windows + P` dan pilih mode **Extend**.
- Di aplikasi Animator, klik tombol **↻** untuk mendeteksi ulang monitor, pilih layar proyektor, lalu klik tombol bulat output Live.

---

## 10. Tips Penggunaan Saat Ibadah / Event Live

1. **Lagu Cepat / Praise:** Gunakan preset *Typewriter* atau *Kinetic Pop Words* (durasi `0.6s` - `0.8s`) dengan *AE Wiggle Posisi* aktif untuk memberi energi visual pada lagu.
2. **Lagu Lambat / Worship:** Gunakan preset *Cinematic Blur & Rise* (durasi `1.5s` - `2.2s`) dengan efek *Wiggle Posisi* berintensitas rendah (`0.6x`) agar lirik mengalun syahdu.
3. **Khotbah & Liturgi:** Matikan tombol Animasi dan pilih mode **Fade** agar pergantian ayat Alkitab dan respons liturgi tenang dan jernih dibaca.
4. **Tombol F1 Darurat:** Gunakan tombol F1 untuk membersihkan layar lirik seketika jika pembicara beralih ke sesi doa tanpa perlu mengubah urutan slide di ProPresenter.

---

<p align="center">
  <strong>ProPresenter Lyric Animator</strong> — Dibuat untuk melayani kebutuhan multimedia ibadah dan live event.
</p>
