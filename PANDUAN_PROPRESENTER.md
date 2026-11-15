# 📖 Panduan Lengkap Penggunaan ProPresenter Lyric Animator

Buku panduan resmi pengoperasian aplikasi **ProPresenter Lyric Animator** untuk operator multimedia gereja, konser, dan siaran langsung (*live broadcast*).

> 💡 **Versi Notepad:** Panduan ini juga tersedia dalam format teks biasa di file [`PANDUAN_PENGGUNAAN.txt`](PANDUAN_PENGGUNAAN.txt) yang siap dibuka langsung melalui aplikasi Windows Notepad.

---

## 📑 Daftar Isi
1. [Pengenalan & Cara Memulai](#1-pengenalan--cara-memulai)
2. [Koneksi ProPresenter & Auto-Discovery](#2-koneksi-propresenter--auto-discovery)
3. [Sinkronisasi Theme, Slide & Media 1:1 (Tanpa NDI)](#3-sinkronisasi-theme-slide--media-11-tanpa-ndi)
4. [Mengatur Output ke Layar Proyektor / Videotron](#4-mengatur-output-ke-layar-proyektor--videotron)
5. [Animasi Lirik After Effects (In & Out)](#5-animasi-lirik-after-effects-in--out)
6. [Efek Teks Bergoyang Kontinu (Wiggle & Distorsi)](#6-efek-teks-bergoyang-kontinu-wiggle--distorsi)
7. [Hitung Mundur (Countdown) & Teks Berjalan (Running Text)](#7-hitung-mundur-countdown--teks-berjalan-running-text)
8. [Tombol Cepat Suasana (Mood) & Shortcut Keyboard](#8-tombol-cepat-suasana-mood--shortcut-keyboard)
9. [Preset Animasi & Efek Kustom (Ekspor / Impor JSON)](#9-preset-animasi--efek-kustom-ekspor--impor-json)
10. [Web Remote Control dari Smartphone via QR Code](#10-web-remote-control-dari-smartphone-via-qr-code)
11. [Panduan Pemecahan Masalah (Troubleshooting)](#11-panduan-pemecahan-masalah-troubleshooting)
12. [Tips Penggunaan Saat Ibadah / Event Live](#12-tips-penggunaan-saat-ibadah--event-live)

---

## 1. Pengenalan & Cara Memulai

### 1.1 Apa itu ProPresenter Lyric Animator?
**ProPresenter Lyric Animator** adalah aplikasi desktop pendamping resmi untuk **ProPresenter v7 / v20.x** yang bertugas mengambil alih presentasi lirik menjadi sangat dinamis dan modern menggunakan animasi kinetik ala Adobe After Effects, namun tetap setia 1:1 mengikuti font, warna teks, kotak, margin, bayangan (*shadow*), serta video background langsung dari ProPresenter tanpa membutuhkan NDI.

> 💡 **Keunggulan Utama:** Tidak membebani kartu grafis PC untuk transmisi video jaringan NDI yang berat. Semua aset video dan slide dirender secara lokal dengan latensi di bawah 10 milidetik.

### 1.2 Cara Menjalankan Aplikasi
Cukup klik dua kali file shortcut di folder aplikasi:
- [`Jalankan_Lyric_Animator.bat`](Jalankan_Lyric_Animator.bat)

Aplikasi akan otomatis mengompilasi pembaruan kode terbaru dan membuka jendela utama.  
*(Tekan **F12** pada keyboard kapan saja untuk membuka atau menutup panel konsol DevTools).*

### 1.3 Persyaratan Sistem
- Komputer / Laptop Windows 10 atau Windows 11 (64-bit).
- Aplikasi ProPresenter 7.x atau ProPresenter 20.x yang aktif.
- Kartu grafis (GPU) yang mendukung akselerasi hardware.
- Jaringan Wi-Fi / Router yang sama jika ingin mengontrol dari smartphone.

---

## 2. Koneksi ProPresenter & Auto-Discovery

### 2.1 Deteksi Jaringan Otomatis (mDNS / Bonjour Bawaan)
Aplikasi dilengkapi pemindai mDNS/Bonjour bawaan serta *subnet scanning* pintar tanpa perlu menginstal software Apple Bonjour tambahan di Windows:
1. Buka menu **⚙️ Pengaturan** $\rightarrow$ tab **Koneksi & Port**.
2. Aplikasi otomatis memindai jaringan lokal dan menampilkan daftar komputer ProPresenter yang aktif beserta alamat IP dan versinya.
3. Cukup klik tombol **"Gunakan"** pada nama komputer yang terdeteksi.

### 2.2 Pengaturan di ProPresenter (Cukup Sekali Saja)
Lakukan pengaturan ini sekali saja di komputer ProPresenter:
1. Buka **ProPresenter** $\rightarrow$ menu bar atas **Preferences** (atau **Settings**) $\rightarrow$ tab **Network**.
2. Centang kotak **"Enable Network"**.
3. Pastikan kolom **Port** berisi angka standar: `50001` (atau `1025`).
4. Kolom controller password dapat dikosongkan (tanpa password).

### 2.3 Status Indikator di Header
- 🟢 **Terhubung (OpenAPI)** : Aplikasi siap menerima slide lirik secara realtime.
- 🔴 **Terputus** : Klik tombol **↻ Reconnect** di header untuk menyambungkan ulang.

### 2.4 Opsi Input Manual & Cek Koneksi
Jika jaringan Wi-Fi/LAN kantor atau gereja memblokir paket UDP multicast, Anda tetap dapat memasukkan Host IP (misal: `192.168.1.15`) dan Port secara manual pada menu Pengaturan, lalu klik tombol **🔍 Cek Koneksi** untuk memverifikasi respon OpenAPI.

---

## 3. Sinkronisasi Theme, Slide & Media 1:1 (Tanpa NDI)

Aplikasi membaca aset ProPresenter secara langsung tanpa delay dan tanpa NDI:
- **Sinkronisasi Look & Theme:** Font, warna teks, perataan (*alignment*), koordinat kotak teks, bayangan (*shadow*), dan outline terbaca otomatis mengikuti Theme Look atau layout slide asli.
- **Dukungan Multi-Textbox:** Slide dengan dua atau lebih kotak teks (misal: baris liturgos/pembicara di atas dan respons jemaat di bawah) dirender secara independen sesuai posisi aslinya tanpa tumpang tindih.
- **Background Media Pool:** Video loop (MP4, MOV, WebM) dan gambar dari Media Bin diputar langsung secara lokal dengan sistem *warm-slot pool* tanpa kedip hitam (*no black frame glitch*).
- **Indikator Layer ProPresenter:** Pill warna-warni di panel kiri menampilkan status layer aktif: *Live Input*, *Media*, *Slide*, *Props* (lengkap dengan nama prop aktif), *Announcements*, dan *Messages*.

---

## 4. Mengatur Output ke Layar Proyektor / Videotron

Aplikasi mendeteksi resolusi monitor fisik Windows secara native (DPI-aware):
1. Hubungkan kabel HDMI / DisplayPort proyektor atau videotron LED ke laptop.
2. Di Windows, tekan `Win + P` dan pilih mode **Extend** (Perluas).
3. Pada header aplikasi, klik dropdown monitor (misal: `🖥️ Layar 2 (1920x1080) [Eksternal]`). Jika baru dicolokkan, klik tombol **↻** di sampingnya untuk memindai ulang layar.
4. Nyalakan output dengan mengklik **tombol bulat monitor** di sebelahnya:
   - **Lingkaran Merah (Offline):** Layar output belum aktif $\rightarrow$ Klik untuk membuka jendela Fullscreen tanpa border di proyektor/videotron tujuan.
   - **Lingkaran Hijau (Live):** Layar output sedang AKTIF $\rightarrow$ Klik untuk mematikan/menutup output live.
5. **Jendela Live Pop-Out:** Operator dapat mengklik tombol ikon pop-out di pojok kanan atas preview monitor jika ingin memisahkan tampilan monitor live ke jendela tersendiri.

---

## 5. Animasi Lirik After Effects (In & Out)

### 5.1 Menyalakan / Mematikan Animasi (F2)
- **Tombol ✨ Animasi ON (Hijau):** Lirik masuk dan keluar menggunakan kurva animasi kinetik After Effects yang halus.
- **Tombol ✨ Animasi OFF (Abu-abu):** Animasi dinonaktifkan, tampilan lirik mengikuti pergantian slide ProPresenter secara instan atau fade.

### 5.2 Pilihan 28+ Preset Animasi
- **Worship:** *Cinematic Blur & Rise* (penyembahan lambat syahdu), *Smooth Slide Up* (modern bersih), *Elegant Fade & Expand*.
- **Per-Huruf (Letter Reveals):** *Typewriter* (ketik huruf berurutan), *Spring Pop Letter*, *3D Flip X Reveal*.
- **Per-Kata (Word Kinetic):** *Kinetic Pop Words*, *Word Stagger Drop*.
- **Per-Baris (Line Reveals):** *Line Mask Slide Up*.
- **Satu Slide:** *Zoom Blur Impact*.

### 5.3 Mode Transisi Saat Animasi Off: Fade vs Cut
Saat tombol Animasi dimatikan, Anda dapat memilih gaya transisi slide:
- **🌊 Fade:** Transisi crossfade simultan yang halus tanpa jeda kosong (*smooth continuous crossfade*).
- **⚡ Cut:** Pindah slide seketika (*cut*).

---

## 6. Efek Teks Bergoyang Kontinu (Wiggle & Distorsi)

Efek teks kontinu memberikan gerakan halus yang terus hidup selama lirik tampil di layar:
- **Tombol 〰️ Efek Teks:** Menghidupkan/mematikan efek goyang secara global.
- **Pilihan Preset:** *AE Wiggle Posisi*, *AE Wiggle Kata*, *AE Wiggle Handheld* (kamera panggung bergerak), *Wave Swing*, *Glitch Displace*, *Glow Pulse*.
- **Slider Intensitas (`0.2x` - `2.5x`):** Mengatur amplitudo/jarak goyangan teks.
- **Slider Kecepatan (`0.2x` - `3.0x`):** Mengatur tempo cepat/lambatnya gerakan.
- *Catatan:* Seluruh preset dan slider efek teks tetap dapat diatur secara leluasa meskipun tombol efek sedang OFF.

---

## 7. Hitung Mundur (Countdown) & Teks Berjalan (Running Text)

Kedua fitur ini dirancang untuk kebutuhan pra-ibadah, warta jemaat, maupun pengumuman darurat. Keduanya dapat diaktifkan secara mandiri atau berbarengan langsung dari tombol toolbar header (**⏱ Countdown** & **💬 Ticker**) maupun menu Pengaturan.

### 7.1 Fitur Hitung Mundur (Countdown Overlay)
- **Tampilan Angka Murni (No Background):** Tampil sebagai angka modern tanpa latar kotak penutup, dilengkapi bayangan (*drop shadow*) tebal sehingga sangat kontras dan mudah dibaca di atas background video terang maupun gelap.
- **Dua Pilihan Mode:**
  - **Durasi Manual (Jam, Menit, Detik):** Input waktu fleksibel terdiri dari Jam (`0 - 99`), Menit (`0 - 59`), dan Detik (`0 - 59`). Format otomatis menampilkan `HH:MM:SS` bila ada jam, atau `MM:SS` bila hanya menit.
  - **Target Jam (HH:mm:ss):** Cukup tentukan target jam ibadah dimulai (format 24 jam), sistem akan otomatis menghitung mundur sisa waktu secara presisi.
- **Tombol Jeda (*Pause*) Aman:** Saat countdown dijeda lalu ditekan Mulai lagi, hitungan waktu melanjutkan dari detik terakhir yang tersisa, bukan mengulang dari awal.
- **Aksi Saat Waktu Habis (00:00):** Pilihan *Sembunyikan Otomatis (Fade Out smooth)*, *Tetap Tampil (Hold 00:00)*, atau *Tampilkan Pesan Selesai* (misal: "Selamat Beribadah!" tampil selama 3 detik lalu otomatis memudar halus/fade out).
- **Atur Ukuran Langsung di Layar (*On-Screen Resize*):**
  - Gunakan **Scroll Wheel Mouse** di atas angka untuk membesarkan/mengecilkan ukuran secara presisi.
  - Klik tombol mini floating **`[-]`** atau **`[+]`** saat kursor didekatkan ke angka.
  - Tarik handle sudut kanan bawah **`⌟`** untuk memperbesar/memperkecil.
- **Batas Ukuran Otomatis & Anti-Overflow:** Sistem membatasi ukuran maksimal font secara cerdas (maksimal **260px** untuk mode jam `HH:MM:SS` dan **380px** untuk mode menit `MM:SS`) serta mengunci batas geser (*boundary clamping*) sehingga angka countdown **tidak akan pernah melebihi atau terpotong layar monitor**.
- **Animasi Smooth Fade:** Angka countdown muncul dan menghilang dengan efek fade yang halus.

### 7.2 Fitur Teks Berjalan (Full-Width Running Text)
- **Tampilan Penuh Selebar Layar (*Full-Width*):** Berjalan dari kanan ke kiri membentang penuh 100% selebar layar monitor (bisa diletakkan di bawah atau di atas layar).
- **Perputaran Kontinu Tanpa Jeda (*Seamless Infinite Loop*):** Teks berputar tanpa putus dan tanpa jeda kosong yang panjang.
- **Jalan Terus Tanpa Mengulang:** Saat operator membuka menu Pengaturan lalu kembali ke layar Live, teks berjalan tetap melanjutkan posisinya secara mulus tanpa mengulang dari awal teks.
- **Kotak Input Teks Luas:** Kotak isian pengumuman dibuat lebar dan leluasa untuk mengetik pesan panjang warta jemaat.
- **Kustomisasi Lengkap:** Kecepatan berjalan (detik per putaran), warna teks, warna kotak latar, transparansi latar (0% - 100%), dan pilihan font device Windows (Segoe UI, Arial, Montserrat, Poppins, dll).
- **Animasi Smooth Fade:** Muncul dan menghilang dengan transisi fade yang halus.

### 7.3 Layar Preview 16:9 di Menu Pengaturan
- Di tab **Hitung Mundur & Teks**, terdapat layar preview interaktif berasio 16:9.
- **Langsung Menampilkan Countdown & Ticker:** Preview langsung menampilkan simulasi angka hitung mundur dan running text tanpa perlu menyalakan status Live terlebih dahulu.
- **Ukuran Layar Stabil:** Ukuran layar preview terkunci rapi (480x270px) dan **tidak akan mengecil atau berubah** saat ukuran teks countdown maupun running text diperbesar/diperkecil.

---

## 8. Tombol Cepat Suasana (Mood) & Shortcut Keyboard

### 8.1 Daftar Shortcut Keyboard Bawaan
| Tombol | Fungsi Utama | Keterangan |
| :--- | :--- | :--- |
| **F1** | **Clear Layar Lirik** | Membersihkan slide di preview, output, dan layer Slide ProPresenter |
| **F2** | **Toggle Animasi Teks** | ON = Animasi Kinetik / OFF = Transisi Slide |
| **F3** | **Mood Cepat: Worship** | Cinematic Blur & Rise, durasi 2.0s |
| **F4** | **Mood Cepat: Praise** | Typewriter Reveal, durasi 0.7s |
| **F5** | **Mood Cepat: Liturgi** | Animasi Off / Bersih ProPresenter |
| **Panah Kiri ($\leftarrow$)** | **Slide Sebelumnya** | Berpindah ke slide sebelum saat ini |
| **Panah Kanan ($\rightarrow$)** | **Slide Berikutnya** | Berpindah ke slide setelah saat ini |
| **F12** | **Buka / Tutup DevTools** | Konsol pengembang & debug log |

*(Semua shortcut keyboard dan tombol cepat suasana dapat disesuaikan di menu **⚙️ Pengaturan**).*

### 8.2 Navigasi Slide Before & Slide After
Di bawah monitor preview terdapat dua kotak slide tetangga yang dapat diklik langsung untuk berpindah slide secara instan tanpa perlu menyentuh komputer ProPresenter.

---

## 9. Preset Animasi & Efek Kustom (Ekspor / Impor JSON)

Anda dapat membuat variasi preset animasi teks atau efek distorsi baru secara mandiri melalui menu **⚙️ Pengaturan $\rightarrow$ Preset Kustom**:
- **Buat Preset Baru:** Pilih template dasar (Kinetic, 3D Flip, Blur, Wiggle), beri nama unik, dan atur kurva kecepatan (*easing*) serta durasinya.
- **Ekspor File JSON:** Cadangkan preset favorit ke dalam file `.json` untuk dibagikan ke laptop multimedia gereja cabang lain.
- **Impor & Drag & Drop:** Cukup seret (*drag & drop*) file preset JSON langsung ke jendela aplikasi untuk memasang animasi baru secara instan tanpa perlu restart.

---

## 10. Web Remote Control dari Smartphone via QR Code

Kontrol animasi, efek lirik, hitung mundur (countdown), dan running text secara nirkabel dari genggaman tangan operator atau Worship Leader:
1. Pastikan HP dan laptop terhubung ke jaringan Wi-Fi yang sama.
2. Klik tombol **`📱 Kontrol HP`** di pojok kanan atas header aplikasi laptop.
3. Pindai **QR Code** yang muncul menggunakan kamera smartphone atau Google Lens.
4. Buka tautan web yang tampil (misal: `http://192.168.1.15:4989/#/remote`).
5. Tombol di laptop otomatis berubah menjadi **`🟢 Terhubung HP`**.
6. **Fitur Lengkap di Browser HP:**
   - **📺 Layar Preview 16:9 di HP:** Menampilkan simulasi tampilan layar proyektor secara realtime (angka hitung mundur berjalan dan teks warta berputar) lengkap dengan badge status Live.
   - **🔘 Tombol ON/OFF Countdown & Running Text:** Sakelar tombol besar dengan lampu indikator hijau untuk menyalakan/mematikan tampilan countdown atau ticker di layar Live.
   - **⏱ Edit Countdown Lengkap:** Pilihan mode Durasi Manual (Jam, Menit, Detik) atau Target Jam (HH:mm:ss), tombol Play/Pause/Reset timer, ukuran font, pilihan warna cepat, preset posisi layar (Bawah, Tengah, Atas), dan aksi waktu habis.
   - **💬 Edit Running Text Lengkap:** Kotak isian pengumuman yang leluasa diketik di HP (lengkap dengan tombol "Terapkan Teks"), posisi layar (Atas/Bawah), kecepatan jalan, warna & transparansi latar kotak, ukuran teks, dan jenis font device.
   - **🎨 Kontrol Animasi & Efek Lirik:** Menyalakan/mematikan animasi kinetik (In/Out), memilih preset, mengatur durasi, memilih transisi Fade/Cut, serta mengatur efek Wiggle kontinu.
   - **🚨 Tombol Merah Darurat (F1):** Membersihkan layar lirik seketika (*Clear Slide*) dari genggaman tangan.
7. **Bebas Lag & Hemat Baterai:** Latensi ultra-rendah (< 10 ms) via WebSocket lokal, dan dilengkapi fitur *Auto-Reconnect* saat layar HP dibuka kembali dari mode sleep.

---

## 11. Panduan Pemecahan Masalah (Troubleshooting)

### Status Aplikasi "Terputus"
- Pastikan ProPresenter sudah berjalan.
- Pastikan opsi *Enable Network* di ProPresenter sudah dicentang dan port `50001`.
- Klik tombol **↻ Reconnect** di header kiri atas.

### HP Tidak Bisa Membuka Halaman Remote
- Pastikan HP dan laptop tersambung ke router Wi-Fi yang sama.
- Periksa Windows Firewall (izinkan *Private Networks* jika diminta).
- Pada modal QR Code di laptop, gunakan dropdown pilihan IP untuk memilih alamat IP Wi-Fi laptop Anda.

### Layar Output Proyektor Tidak Muncul
- Pastikan kabel HDMI/DisplayPort proyektor sudah terhubung ke laptop.
- Di Windows, tekan tombol `Win + P` dan pilih mode **Extend**.
- Di aplikasi Animator, klik tombol **↻** untuk mendeteksi ulang monitor, pilih layar proyektor, lalu klik tombol bulat output Live.

---

## 12. Tips Penggunaan Saat Ibadah / Event Live

1. **Lagu Cepat / Praise:** Gunakan preset *Typewriter* atau *Kinetic Pop Words* (durasi `0.6s` - `0.8s`) dengan *AE Wiggle Posisi* aktif untuk memberi energi visual pada lagu.
2. **Lagu Lambat / Worship:** Gunakan preset *Cinematic Blur & Rise* (durasi `1.5s` - `2.2s`) dengan efek *Wiggle Posisi* berintensitas rendah (`0.6x`) agar lirik mengalun syahdu.
3. **Khotbah & Liturgi:** Tekan shortcut **F5** (Liturgi) atau matikan Animasi dan pilih mode **Fade** agar pergantian ayat Alkitab dan respons liturgi tenang dan jernih dibaca.
4. **Tombol F1 Darurat:** Gunakan tombol F1 untuk membersihkan layar lirik seketika jika pembicara beralih ke sesi doa tanpa perlu mengubah urutan slide di ProPresenter.

---

<p align="center">
  <strong>ProPresenter Lyric Animator</strong> — Dibuat untuk melayani kebutuhan multimedia ibadah dan live event.
</p>
