import { useState, useEffect } from "react";

const CHAPTERS = [
  {
    id: "intro",
    icon: "🚀",
    title: "1. Pengenalan & Cara Memulai",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Apa itu ProPresenter Lyric Animator?</h3>
        <p className="guide-paragraph">
          <strong>ProPresenter Lyric Animator</strong> adalah aplikasi desktop pendamping resmi untuk{" "}
          <strong>ProPresenter v7 / v20.x</strong> yang bertugas mengambil alih presentasi lirik
          menjadi sangat dinamis dan modern menggunakan animasi kinetik ala Adobe After Effects,
          namun tetap setia 1:1 mengikuti font, warna teks, kotak, margin, bayangan (shadow),
          serta video background langsung dari ProPresenter tanpa membutuhkan NDI.
        </p>

        <div className="guide-callout info">
          <div className="guide-callout-icon">💡</div>
          <div className="guide-callout-text">
            <strong>Keunggulan Utama:</strong> Tidak membebani kartu grafis PC untuk transmisi video
            jaringan NDI yang berat. Semua aset video dan slide dirender secara lokal dengan latensi
            di bawah 10 milidetik.
          </div>
        </div>

        <h4 className="guide-subsection-title">Cara Menjalankan Aplikasi</h4>
        <ol className="guide-steps-list">
          <li>
            Buka folder aplikasi di laptop/PC Anda, lalu klik dua kali file shortcut:
            <code className="guide-code-pill">Jalankan_Lyric_Animator.bat</code>
          </li>
          <li>Aplikasi akan otomatis mengompilasi dan membuka jendela utama.</li>
          <li>
            Tekan tombol <kbd className="guide-kbd">F12</kbd> di keyboard kapan saja untuk membuka
            atau menutup panel konsol DevTools jika ingin memeriksa log sistem.
          </li>
        </ol>

        <h4 className="guide-subsection-title">Persyaratan Sistem</h4>
        <ul className="guide-bullet-list">
          <li>Komputer / Laptop Windows 10 atau Windows 11 (64-bit).</li>
          <li>Aplikasi ProPresenter 7.x atau ProPresenter 20.x yang aktif.</li>
          <li>Koneksi Wi-Fi / Router yang sama jika ingin mengontrol dari smartphone.</li>
        </ul>
      </div>
    )
  },
  {
    id: "connection",
    icon: "📡",
    title: "2. Koneksi ProPresenter & Auto-Discovery",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Koneksi Otomatis &amp; Deteksi Jaringan</h3>
        <p className="guide-paragraph">
          Aplikasi dilengkapi pemindai mDNS/Bonjour bawaan serta subnet scanning pintar. Anda tidak
          perlu menginstal software Apple Bonjour terpisah di Windows.
        </p>

        <div className="guide-callout success">
          <div className="guide-callout-icon">🔍</div>
          <div className="guide-callout-text">
            <strong>Deteksi Otomatis:</strong> Buka menu <strong>⚙️ Pengaturan &rarr; Koneksi &amp; Port</strong>.
            Aplikasi otomatis memindai jaringan lokal dan menampilkan daftar laptop ProPresenter yang aktif
            beserta alamat IP dan versinya. Cukup klik tombol <strong>"Gunakan"</strong>!
          </div>
        </div>

        <h4 className="guide-subsection-title">Pengaturan di ProPresenter (Cukup Sekali Saja)</h4>
        <ol className="guide-steps-list">
          <li>Buka <strong>ProPresenter</strong> di laptop Anda.</li>
          <li>
            Buka menu bar atas: <strong>ProPresenter</strong> &rarr;{" "}
            <strong>Preferences / Settings</strong> &rarr; tab <strong>Network</strong>.
          </li>
          <li>
            Centang opsi <strong>"Enable Network"</strong>.
          </li>
          <li>
            Pastikan Port berisi angka standar: <code className="guide-code-pill">50001</code> (atau <code>1025</code>).
          </li>
          <li>Kolom controller password dapat dikosongkan (tanpa password).</li>
        </ol>

        <h4 className="guide-subsection-title">Opsi Input Manual &amp; Cek Koneksi</h4>
        <p className="guide-paragraph">
          Jika jaringan Wi-Fi/LAN kantor atau gereja memblokir paket UDP multicast, Anda tetap dapat memasukkan Host IP
          (misal: <code>192.168.1.15</code>) dan Port secara manual pada menu Pengaturan, lalu klik tombol{" "}
          <strong>🔍 Cek Koneksi</strong> untuk memverifikasi respon OpenAPI.
        </p>
      </div>
    )
  },
  {
    id: "theme-media",
    icon: "🎨",
    title: "3. Theme, Slide & Media 1:1",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Sinkronisasi Tampilan Otomatis (Tanpa NDI)</h3>
        <p className="guide-paragraph">
          Aplikasi membaca susunan slide lirik langsung dari data internal ProPresenter:
        </p>

        <div className="guide-grid-cards">
          <div className="guide-card-item">
            <h4>📐 Sinkronisasi Look &amp; Theme</h4>
            <p>
              Font, ukuran huruf, warna, perataan (align), outline teks, bayangan (shadow), serta
              posisi kotak teks dibaca otomatis mengikuti Theme Look aktif maupun layout slide asli.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>📑 Dukungan Multi-Textbox</h4>
            <p>
              Slide dengan lebih dari 1 kotak teks (misal: kotak judul / pembicara di atas dan lirik
              respons di bawah) dirender secara terpisah sesuai posisi aslinya tanpa bertumpuk.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🎬 Background Media Playback</h4>
            <p>
              Video loop (MP4, MOV, WebM) dan gambar dari Media Bin ProPresenter diputar secara lokal
              dengan sistem <em>Warm-Slot Pool</em> tanpa jeda hitam (black frame glitch).
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🏷️ Status Layer ProPresenter</h4>
            <p>
              Indikator pill warna-warni menampilkan status layer: <strong>Live Input</strong>,{" "}
              <strong>Media</strong>, <strong>Slide</strong>, <strong>Props</strong> (lengkap dengan
              nama prop aktif), <strong>Announcements</strong>, dan <strong>Messages</strong>.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "output",
    icon: "📺",
    title: "4. Output Layar Proyektor",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Mengatur Output Fisik ke Layar Proyektor / Videotron</h3>
        <p className="guide-paragraph">
          Aplikasi mendeteksi hardware display monitor fisik Windows secara native (DPI-Aware):
        </p>

        <ol className="guide-steps-list">
          <li>
            Hubungkan kabel HDMI / DisplayPort proyektor atau videotron LED ke laptop.
          </li>
          <li>
            Di Windows, tekan <kbd className="guide-kbd">Win</kbd> + <kbd className="guide-kbd">P</kbd>{" "}
            lalu pastikan memilih mode <strong>Extend</strong> (Perluas).
          </li>
          <li>
            Pada header aplikasi bagian tengah, pilih layar tujuan pada dropdown (contoh:{" "}
            <code>🖥️ Layar 2 (1920x1080) [Eksternal]</code>). Jika baru dicolokkan, klik tombol{" "}
            <strong>↻</strong> di sampingnya untuk memindai ulang.
          </li>
          <li>
            Nyalakan output dengan mengklik <strong>tombol bulat monitor</strong> di sebelahnya:
            <ul className="guide-sub-bullets">
              <li>
                <span className="dot-red" /> <strong>Merah (Offline):</strong> Layar output belum aktif.
                Klik untuk membuka jendela Fullscreen tanpa border di monitor tujuan.
              </li>
              <li>
                <span className="dot-green" /> <strong>Hijau (Live):</strong> Layar output sedang AKTIF.
                Klik tombol ini kapan saja untuk mematikan/menutup output live.
              </li>
            </ul>
          </li>
        </ol>

        <div className="guide-callout info">
          <div className="guide-callout-icon">🪟</div>
          <div className="guide-callout-text">
            <strong>Jendela Live Pop-Out:</strong> Operator dapat mengklik tombol ikon pop-out di
            pojok kanan atas monitor preview untuk memisahkan jendela preview ke layar kontrol lain.
          </div>
        </div>
      </div>
    )
  },
  {
    id: "animation",
    icon: "✨",
    title: "5. Animasi Teks After Effects",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Animasi Kinetik In &amp; Out (After Effects)</h3>
        <p className="guide-paragraph">
          Lirik dapat dimunculkan dan dihilangkan menggunakan kurva animasi After Effects yang halus
          dan mewah:
        </p>

        <div className="guide-callout success">
          <div className="guide-callout-icon">✨</div>
          <div className="guide-callout-text">
            <strong>Tombol Toggle Animasi (F2):</strong>
            <br />
            &bull; <strong>ON (Hijau):</strong> Animasi teks After Effects aktif penuh.
            <br />
            &bull; <strong>OFF (Abu-abu):</strong> Animasi dimatikan, teks lirik langsung mengikuti
            transisi pergantian slide ProPresenter.
          </div>
        </div>

        <h4 className="guide-subsection-title">Pilihan Kategori Preset (28+ Preset)</h4>
        <ul className="guide-bullet-list">
          <li>
            <strong>Favorit Ibadah (Worship):</strong> <em>Cinematic Blur &amp; Rise</em> (teduh perlahan),{" "}
            <em>Smooth Slide Up</em> (modern rapi), <em>Elegant Fade &amp; Expand</em>.
          </li>
          <li>
            <strong>Per-Huruf (Letter Reveals):</strong> <em>Typewriter</em> (ketik huruf berurutan),{" "}
            <em>Spring Pop Letter</em>, <em>3D Flip X Reveal</em>.
          </li>
          <li>
            <strong>Per-Kata (Word Kinetic):</strong> <em>Kinetic Pop Words</em>,{" "}
            <em>Word Stagger Drop</em>.
          </li>
          <li>
            <strong>Per-Baris (Line Reveals):</strong> <em>Line Mask Slide Up</em>.
          </li>
        </ul>

        <h4 className="guide-subsection-title">Mode Transisi Saat Animasi Off: Fade vs Cut</h4>
        <p className="guide-paragraph">
          Ketika tombol Animasi dimatikan (OFF), Anda dapat memilih gaya transisi:
        </p>
        <div className="guide-grid-cards">
          <div className="guide-card-item">
            <h4>🌊 Fade (Crossfade Halus)</h4>
            <p>
              Slide lama memudar bersamaan dengan slide baru muncul secara mulus tanpa ada jeda kosong
              (tidak hilang dulu baru muncul).
            </p>
          </div>
          <div className="guide-card-item">
            <h4>⚡ Cut (Instan)</h4>
            <p>
              Pergantian teks slide langsung terjadi seketika tanpa efek transisi, cocok untuk sesi
              yang membutuhkan perubahan cepat.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "effects",
    icon: "〰️",
    title: "6. Efek Teks Bergoyang (Wiggle)",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Efek Teks Bergoyang Kontinu (Wiggle &amp; Distorsi)</h3>
        <p className="guide-paragraph">
          Berbeda dari animasi In/Out yang hanya berjalan di awal pergantian slide,{" "}
          <strong>Efek Teks</strong> adalah gerakan mengalun kontinu yang terus hidup selama lirik
          tampil di layar proyektor.
        </p>

        <div className="guide-grid-cards">
          <div className="guide-card-item">
            <h4>〰️ Preset Wiggle</h4>
            <p>
              Pilihan: <em>AE Wiggle Posisi</em>, <em>AE Wiggle Per-Kata</em>,{" "}
              <em>AE Wiggle Handheld</em> (kamera panggung), <em>Wave Swing</em>, dan{" "}
              <em>Glitch Displace</em>.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🎚️ Slider Intensitas &amp; Kecepatan</h4>
            <p>
              <strong>Intensitas (0.2x - 2.5x):</strong> Mengatur jauhnya goyangan teks.
              <br />
              <strong>Kecepatan (0.2x - 3.0x):</strong> Mengatur tempo lambat/cepatnya goyangan.
            </p>
          </div>
        </div>

        <div className="guide-callout info">
          <div className="guide-callout-icon">💡</div>
          <div className="guide-callout-text">
            <strong>Bebas Diatur Kapan Saja:</strong> Pilihan preset efek, slider intensitas, dan
            slider kecepatan tetap dapat Anda atur secara leluasa meskipun tombol Efek Teks di toolbar
            sedang berstatus OFF.
          </div>
        </div>
      </div>
    )
  },
  {
    id: "countdown-ticker",
    icon: "⏱",
    title: "7. Hitung Mundur & Teks Berjalan",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Hitung Mundur (Countdown) &amp; Teks Berjalan (Running Text)</h3>
        <p className="guide-paragraph">
          Kedua fitur ini dirancang untuk kebutuhan pra-ibadah, warta jemaat, maupun pengumuman darurat.
          Keduanya dapat diaktifkan secara mandiri atau berbarengan langsung dari tombol toolbar header (<strong>⏱ Countdown</strong> &amp; <strong>💬 Ticker</strong>) maupun menu Pengaturan.
        </p>

        <div className="guide-grid-cards">
          <div className="guide-card-item">
            <h4>⏱ Angka Hitung Mundur (No Background)</h4>
            <p>
              Tampil murni sebagai angka modern dengan bayangan tebal (kontras tinggi di atas video terang).
              Mendukung mode <strong>Durasi Manual (Jam, Menit, Detik)</strong> dan <strong>Target Jam (HH:mm:ss format 24 jam)</strong>.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>💬 Teks Berjalan Penuh (Full-Width Ticker)</h4>
            <p>
              Teks pengumuman membentang penuh selebar layar dari kanan ke kiri, berulang secara kontinu tanpa jeda kosong (*seamless infinite loop*). Teks tetap berjalan mulus tanpa mengulang saat membuka menu pengaturan.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🎚️ Atur Ukuran Langsung di Layar (On-Screen Resize)</h4>
            <p>
              Ukuran font countdown dapat diubah langsung di layar tampilan dengan <strong>scroll wheel mouse</strong>, tombol mini <strong>[-] [+]</strong> saat kursor didekatkan, atau menarik handle sudut <strong>⌟</strong>.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🛡️ Batas Ukuran Otomatis (Anti-Overflow)</h4>
            <p>
              Sistem otomatis membatasi ukuran font maksimal <strong>260px</strong> untuk mode jam (HH:MM:SS) dan <strong>380px</strong> untuk mode menit (MM:SS) serta mengunci koordinat geser agar teks tidak pernah terpotong atau melebihi layar.
            </p>
          </div>
        </div>

        <h4 className="guide-subsection-title">Layar Preview 16:9 di Menu Pengaturan</h4>
        <p className="guide-paragraph">
          Di tab <strong>Hitung Mundur &amp; Teks</strong>, terdapat monitor preview 16:9 yang langsung menampilkan countdown dan running text secara otomatis tanpa perlu mengaktifkannya ke layar live terlebih dahulu.
          Anda dapat bebas menggeser posisi (*drag &amp; drop*), mengatur warna, font, kecepatan jalan, transparansi latar kotak, dan ukuran angka secara instan. Ukuran monitor preview terkunci stabil (480x270px) dan tidak mengecil saat ukuran teks diubah.
        </p>

        <div className="guide-callout info">
          <div className="guide-callout-icon">💡</div>
          <div className="guide-callout-text">
            <strong>Tombol Jeda (*Pause*) Aman &amp; Pesan Selesai:</strong> Saat countdown dijeda lalu ditekan Mulai kembali, hitungan waktu akan melanjutkan dari detik terakhir yang tersisa, bukan mengulang dari awal. Jika memilih aksi pesan selesai (misal: <em>"Selamat Beribadah!"</em>), pesan akan tampil elegan selama 3 detik lalu otomatis memudar halus (*smooth fade out*).
          </div>
        </div>
      </div>
    )
  },
  {
    id: "shortcuts",
    icon: "⌨️",
    title: "8. Shortcut Keyboard & Mood Suasana",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Tombol Cepat Suasana Lagu &amp; Shortcut Keyboard Kustom</h3>
        <p className="guide-paragraph">
          Semua tombol pintas keyboard dan tombol cepat suasana (Worship, Praise, Liturgi) dapat diubah secara bebas melalui menu <strong>⚙️ Pengaturan &rarr; Shortcut Keyboard</strong> dan tab <strong>⚡ Tombol Cepat Suasana</strong>.
        </p>

        <div className="guide-table-wrapper">
          <table className="guide-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Tombol Bawaan</th>
                <th>Fungsi Utama</th>
                <th style={{ width: "160px" }}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd className="guide-kbd">F1</kbd></td>
                <td><strong>Clear Layar Lirik</strong></td>
                <td>Membersihkan lirik di layar &amp; ProPresenter</td>
              </tr>
              <tr>
                <td><kbd className="guide-kbd">F2</kbd></td>
                <td><strong>Toggle Animasi (ON / OFF)</strong></td>
                <td>Beralih animasi kinetik &harr; transisi slide</td>
              </tr>
              <tr>
                <td><kbd className="guide-kbd">F3</kbd></td>
                <td><strong>Mood: Worship</strong></td>
                <td>Cinematic Blur &amp; Rise, durasi 2.0s</td>
              </tr>
              <tr>
                <td><kbd className="guide-kbd">F4</kbd></td>
                <td><strong>Mood: Praise</strong></td>
                <td>Typewriter Reveal, durasi 0.7s</td>
              </tr>
              <tr>
                <td><kbd className="guide-kbd">F5</kbd></td>
                <td><strong>Mood: Liturgi</strong></td>
                <td>Animasi Off (Bersih ProPresenter)</td>
              </tr>
              <tr>
                <td><kbd className="guide-kbd">&larr;</kbd> (Kiri)</td>
                <td><strong>Slide Sebelumnya</strong></td>
                <td>Pindah ke slide sebelum saat ini</td>
              </tr>
              <tr>
                <td><kbd className="guide-kbd">&rarr;</kbd> (Kanan)</td>
                <td><strong>Slide Berikutnya</strong></td>
                <td>Pindah ke slide setelah saat ini</td>
              </tr>
              <tr>
                <td><kbd className="guide-kbd">F12</kbd></td>
                <td><strong>Buka / Tutup DevTools</strong></td>
                <td>Konsol pengembang &amp; debug log</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="guide-subsection-title">Kotak Slide Before &amp; Slide After</h4>
        <p className="guide-paragraph">
          Di bawah monitor preview terdapat dua kotak slide tetangga yang dapat diklik langsung untuk
          berpindah slide secara instan tanpa menyentuh komputer ProPresenter.
        </p>
      </div>
    )
  },
  {
    id: "custom-presets",
    icon: "✨",
    title: "9. Preset Animasi & Efek Kustom",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Membuat &amp; Mengelola Preset Animasi Kustom</h3>
        <p className="guide-paragraph">
          Anda dapat menambahkan variasi animasi teks atau efek distorsi baru secara mandiri melalui menu{" "}
          <strong>⚙️ Pengaturan &rarr; Preset Kustom</strong>:
        </p>

        <div className="guide-grid-cards">
          <div className="guide-card-item">
            <h4>✍️ Buat Variasi Preset Baru</h4>
            <p>
              Pilih template dasar (Kinetic, 3D Flip, Blur, Wiggle), beri nama unik, dan atur kurva kecepatan (easing) serta durasi sesuai kebutuhan estetika panggung Anda.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>📦 Ekspor &amp; Impor File JSON</h4>
            <p>
              Preset yang Anda buat dapat diekspor menjadi file <code>.json</code> untuk dicadangkan (backup) atau dibagikan ke laptop multimedia gereja cabang lain.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>📂 Drag &amp; Drop Preset</h4>
            <p>
              Cukup seret (drag &amp; drop) file preset JSON langsung ke jendela aplikasi untuk memasang animasi baru secara instan tanpa restart.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "remote",
    icon: "📱",
    title: "10. Web Remote Smartphone",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Kontrol Nirkabel dari Smartphone via Scan QR</h3>
        <p className="guide-paragraph">
          Operator, Worship Leader (WL), atau Multimedia Crew dapat mengatur animasi lirik langsung
          dari browser HP tanpa menginstal aplikasi apapun:
        </p>

        <ol className="guide-steps-list">
          <li>Pastikan HP dan laptop terhubung ke jaringan <strong>Wi-Fi yang sama</strong>.</li>
          <li>
            Di header kanan atas aplikasi laptop, klik tombol <strong>📱 Kontrol HP</strong>.
          </li>
          <li>
            Sebuah modal QR Code akan muncul. Buka kamera smartphone / Google Lens dan pindai QR Code
            tersebut.
          </li>
          <li>
            Buka link web yang muncul (misal: <code>http://192.168.1.15:4989/#/remote</code>).
          </li>
          <li>
            Tombol di laptop otomatis berubah menjadi <strong>🟢 Terhubung HP</strong>.
          </li>
        </ol>

        <div className="guide-grid-cards">
          <div className="guide-card-item">
            <h4>📺 Layar Preview 16:9 di HP</h4>
            <p>
              Menampilkan simulasi live tampilan countdown dan teks berjalan secara realtime di layar smartphone Anda lengkap dengan badge status Live dan timer.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🔘 Tombol ON/OFF Countdown &amp; Ticker</h4>
            <p>
              Nyalakan atau matikan tampilan hitung mundur dan pengumuman berjalan langsung dari HP dengan satu sentuhan jari.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>⏱ Edit Countdown &amp; Running Text</h4>
            <p>
              Ubah durasi jam/menit/detik, target jam, mulai/jeda/reset timer, ketik teks warta pengumuman, warna, transparansi, serta kecepatan berjalan langsung dari HP.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>⚡ Latensi Sangat Rendah (&lt;10ms)</h4>
            <p>
              Komunikasi menggunakan protokol WebSocket lokal langsung antara HP dan laptop tanpa
              melalui server internet. Respon tombol nyaris instan seperti menekan remote fisik.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "troubleshooting",
    icon: "🛠️",
    title: "11. Pemecahan Masalah",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Panduan Mengatasi Masalah Umum</h3>

        <div className="guide-faq-item">
          <h4>🔴 Status di Laptop "Terputus"</h4>
          <p>
            Pastikan aplikasi ProPresenter sudah berjalan dan opsi <strong>Enable Network</strong> di
            menu <em>Preferences &rarr; Network</em> sudah dicentang dengan port <code>50001</code>.
            Setelah itu, klik tombol <strong>↻ Reconnect</strong>.
          </p>
        </div>

        <div className="guide-faq-item">
          <h4>📱 HP Tidak Bisa Membuka Halaman Remote</h4>
          <p>
            Pastikan HP dan laptop terhubung ke access point Wi-Fi yang sama. Jika Windows Firewall
            memunculkan jendela izin, pilih <strong>Allow</strong> pada <em>Private Networks</em>. Pada
            modal QR laptop, pastikan IP yang dipilih adalah IP Wi-Fi laptop Anda.
          </p>
        </div>

        <div className="guide-faq-item">
          <h4>📺 Output Layar Blank atau Tidak Muncul di Proyektor</h4>
          <p>
            Pastikan kabel HDMI proyektor terhubung dengan baik dan mode tampilan Windows diatur ke{" "}
            <strong>Extend</strong> (<kbd className="guide-kbd">Win</kbd> + <kbd className="guide-kbd">P</kbd>).
            Klik tombol <strong>↻</strong> pada dropdown layar di aplikasi untuk memindai ulang, pilih
            layar proyektor, lalu klik tombol bulat merah agar berubah hijau (Live).
          </p>
        </div>
      </div>
    )
  },
  {
    id: "tips",
    icon: "💡",
    title: "12. Tips Ibadah & Event Live",
    content: (
      <div className="guide-chapter-body">
        <h3 className="guide-section-title">Rekomendasi Pengaturan Live Service</h3>

        <div className="guide-grid-cards">
          <div className="guide-card-item">
            <h4>⚡ Lagu Cepat / Praise</h4>
            <p>
              Gunakan preset <strong>Typewriter</strong> atau <strong>Kinetic Pop Words</strong> dengan
              durasi <strong>0.6s - 0.8s</strong>. Efek Wiggle dapat diaktifkan pada intensitas 1.0x
              untuk memberi energi visual yang pas dengan irama lagu.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🕊️ Lagu Lambat / Worship</h4>
            <p>
              Gunakan preset <strong>Cinematic Blur &amp; Rise</strong> dengan durasi{" "}
              <strong>1.5s - 2.2s</strong>. Aktifkan efek <strong>AE Wiggle Posisi</strong> dengan
              intensitas rendah (0.6x) dan kecepatan santai (0.5x) agar lirik mengalun syahdu.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>📖 Khotbah &amp; Liturgi</h4>
            <p>
              Tekan shortcut <kbd className="guide-kbd">F5</kbd> (Liturgi) atau matikan Animasi, lalu
              pilih mode <strong>Fade</strong> agar perpindahan ayat kitab suci berlangsung tenang,
              jernih, dan tidak membuat mata jemaat lelah.
            </p>
          </div>
          <div className="guide-card-item">
            <h4>🚨 Tombol Darurat F1</h4>
            <p>
              Jika pembicara tiba-tiba mengajak berdoa dan meminta layar dibersihkan sementara, cukup
              tekan <kbd className="guide-kbd">F1</kbd> atau tombol merah Clear di HP. Lirik akan
              otomatis muncul kembali saat slide lirik berikutnya ditekan di ProPresenter.
            </p>
          </div>
        </div>
      </div>
    )
  }
];

export function UserGuideModal({ isOpen, onClose }) {
  const [activeChapterId, setActiveChapterId] = useState("intro");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentChapter = CHAPTERS.find((ch) => ch.id === activeChapterId) || CHAPTERS[0];

  const filteredChapters = searchQuery.trim()
    ? CHAPTERS.filter((ch) =>
        ch.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CHAPTERS;

  return (
    <div className="guide-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="guide-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="guide-modal-header">
          <div className="guide-modal-title-group">
            <span className="guide-header-icon">📖</span>
            <div>
              <div className="guide-title-row">
                <h2 className="guide-modal-title">Panduan Pengguna ProPresenter Lyric Animator</h2>
                <span className="guide-credit-badge">
                  ✨ Devan Andika Wiratama
                </span>
              </div>
              <p className="guide-modal-subtitle">
                Buku panduan lengkap pengoperasian animasi lirik kinetik, Theme 1:1, dan Web Remote HP
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Tutup Panduan"
            title="Tutup (Esc)"
          >
            ✕
          </button>
        </header>

        {/* Main Content: Sidebar + Reader */}
        <div className="guide-modal-body">
          {/* Left Sidebar: Chapters Navigation */}
          <aside className="guide-sidebar">
            <div className="guide-search-box">
              <input
                type="text"
                placeholder="Cari topik / shortcut..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="guide-search-input"
              />
            </div>

            <nav className="guide-nav-list">
              {filteredChapters.map((ch) => {
                const isActive = ch.id === currentChapter.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    className={`guide-nav-item ${isActive ? "active" : ""}`}
                    onClick={() => setActiveChapterId(ch.id)}
                  >
                    <span className="guide-nav-icon">{ch.icon}</span>
                    <span className="guide-nav-label">{ch.title}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Reader Area */}
          <main className="guide-reader-pane">
            <div className="guide-reader-header">
              <span className="guide-reader-chapter-badge">BAB {CHAPTERS.findIndex(c => c.id === currentChapter.id) + 1}</span>
              <h3 className="guide-reader-chapter-title">
                {currentChapter.icon} {currentChapter.title}
              </h3>
            </div>

            <div className="guide-reader-scrollable">
              {currentChapter.content}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="guide-modal-footer">
          <div className="guide-footer-credit">
            <span>Dibuat dengan ❤️ oleh <strong>Devan Andika Wiratama</strong> &bull; Lisensi MIT untuk Pelayanan Multimedia</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
