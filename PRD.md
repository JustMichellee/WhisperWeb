# Product Requirements Document (PRD)
**Nama Proyek:** WhisperWeb (Working Title) — Private E2EE Web Messenger  
**Versi Dokumen:** 1.0.0  
**Status:** Disetujui (Approved for MVP Development)  
**Karakter Produk:** WhatsApp Web Modern + Zero-Knowledge Privacy & Anonimitas

---

## 1. Visi & Ringkasan Eksekutif

**WhisperWeb** adalah aplikasi pesan instan berbasis web (*Web Messenger*) yang menggabungkan **kesederhanaan, keintiman, dan kecepatan antarmuka WhatsApp Web** dengan **privasi tingkat tinggi tanpa identitas pribadi**.

Berbeda dengan WhatsApp yang mewajibkan nomor telepon aktif (SIM Card) dan mengaitkan identitas dunia nyata pengguna, platform ini memungkinkan siapa saja membuat akun hanya dengan **`@username` + Password / Passkey (WebAuthn)** tanpa email maupun nomor HP. Seluruh pesan teks, percakapan grup kecil, hingga lampiran gambar dan dokumen dilindungi dengan **End-to-End Encryption (E2EE)** di sisi browser menggunakan Web Crypto API serta dilengkapi mekanisme **Zero-Knowledge Encrypted Key Backup** agar pengguna tetap nyaman berpindah perangkat/browser tanpa mengorbankan privasi.

### 1.1 Masalah yang Diselesaikan
1. **Ketergantungan Nomor HP pada Aplikasi Chat Populer:** Pengguna sering kali enggan membagikan nomor telepon pribadi hanya untuk berkomunikasi secara personal atau dalam grup kecil.
2. **Keterbatasan Web Messenger Berbasis E2EE:** Aplikasi yang berfokus pada privasi umumnya mewajibkan instalasi aplikasi HP terlebih dahulu, atau kehilangan riwayat chat saat berganti browser karena kunci kriptografi tidak memiliki sistem cadangan *zero-knowledge*.
3. **Kompleksitas UI pada Aplikasi Chat Alternatif:** Banyak aplikasi chat alternatif terlalu rumit (seperti Discord/Slack/Matrix) untuk pengguna yang hanya menginginkan pengalaman kirim pesan yang bersih, cepat, dan familiar seperti WhatsApp Web.

### 1.2 Value Proposition Utama
- **Familiar & Instan:** Antarmuka 2-panel identik dengan kenyamanan WhatsApp Web modern (centang 1/2/emerald, *reply*, *reaction*, *typing indicator*, berbagi gambar & file).
- **100% Tanpa Nomor HP & Email:** Registrasi instan hanya dengan `@username`, Password, dan opsi Passkey (sidik jari/PIN perangkat).
- **Zero-Knowledge End-to-End Encryption:** Server hanya menyimpan *ciphertext* dan *encrypted blob*. Server secara matematis tidak dapat membaca isi pesan maupun melihat gambar/dokumen pengguna.
- **Multi-Browser Seamless:** Kunci privat dienkripsi secara lokal menggunakan kunci turunan password/Recovery Key pengguna (*Zero-Knowledge Key Vault*), sehingga pengguna dapat login di browser baru dan langsung memulihkan riwayat percakapannya.

---

## 2. Target Pengguna & Persona

| Persona | Deskripsi | Kebutuhan Utama |
| :--- | :--- | :--- |
| **1. Privacy-Conscious Communicator** | Individu yang ingin berkomunikasi dengan teman, keluarga, atau rekan kerja tanpa mengekspos nomor HP/email pribadi. | Login cepat dengan `@username`, jaminan E2EE yang transparan, dan indikator keamanan kunci (*Safety Number*). |
| **2. Small Intimate Team / Circle** | Kelompok kecil (3–50 orang) yang membutuhkan ruang diskusi privat untuk berbagi pesan dan dokumen sensitif. | Grup kecil yang responsif, kirim file/gambar terenkripsi dengan cepat, serta status baca (*read receipts*) yang akurat. |
| **3. Desktop & Mobile Web User** | Pengguna yang bekerja di depan laptop/PC dan sesekali membuka chat dari browser HP (PWA) tanpa ingin menginstal aplikasi berat. | Tampilan responsif (Desktop 2-panel & Mobile single-view), ringan, dan sinkronisasi sesi antar-browser yang mulus. |

---

## 3. Kebutuhan Fungsional (Functional Requirements)

### 3.1 Autentikasi, Identitas & Pemulihan Kunci (`FR-AUTH`)
- **FR-AUTH-01 (Registrasi Anonim):** Pengguna dapat mendaftar menggunakan `username` unik (huruf kecil, angka, garis bawah; 3–24 karakter), `display_name`, dan `password` minimal 8 karakter tanpa perlu mengisi email atau nomor telepon.
- **FR-AUTH-02 (Pembangkitan Kunci E2EE Otomatis):** Saat registrasi, browser secara otomatis membangkitkan pasangan kunci asimetris (`ECDH P-256 / X25519` untuk enkripsi dan `ECDSA / Ed25519` untuk tanda tangan identitas) menggunakan Web Crypto API.
- **FR-AUTH-03 (Zero-Knowledge Key Vault):** Kunci privat pengguna dienkripsi di browser menggunakan kunci simetris (`AES-256-GCM`) yang diturunkan dari password pengguna melalui `PBKDF2` (600.000 iterasi) sebelum diunggah ke server.
- **FR-AUTH-04 (Recovery Key / Phrase):** Saat pendaftaran selesai, pengguna diberikan **Recovery Key** unik untuk diunduh/dicatat. Kunci ini memungkinkan pemulihan akun dan dekripsi riwayat chat apabila pengguna lupa password.
- **FR-AUTH-05 (Dukungan Passkey / WebAuthn):** Pengguna dapat menautkan Passkey (Windows Hello, TouchID, FaceID, atau Security Key) untuk autentikasi cepat tanpa mengetik ulang password setiap kali masuk.

### 3.2 Manajemen Kontak & Keamanan Identitas (`FR-CONTACT`)
- **FR-CONTACT-01 (Pencarian Username):** Pengguna dapat mencari pengguna lain berdasarkan `@username` secara tepat atau awalan untuk memulai percakapan baru.
- **FR-CONTACT-02 (Daftar Kontak & Profil):** Pengguna dapat mengatur nama tampilan (*Display Name*), bio singkat ("Tentang / About" ala WhatsApp), dan foto profil.
- **FR-CONTACT-03 (Verifikasi Safety Number):** Setiap ruang obrolan 1-on-1 memiliki panel **Verifikasi Enkripsi** yang menampilkan 60-digit *Safety Number* (gabungan *fingerprint* kunci publik kedua pengguna) untuk memastikan tidak ada serangan *Man-in-the-Middle (MitM)*.
- **FR-CONTACT-04 (Blokir Pengguna):** Pengguna dapat memblokir `@username` tertentu agar tidak dapat mengirim pesan atau menambahkan ke dalam grup.

### 3.3 Percakapan 1-on-1 Real-Time (`FR-CHAT`)
- **FR-CHAT-01 (Kirim & Terima Pesan Teks E2EE):** Pesan teks (termasuk emoji dan *markdown* dasar seperti **tebal**, *miring*, ~coret~, dan `kode`) dienkripsi di browser pengirim dan didekripsi di browser penerima secara *real-time* melalui WebSocket.
- **FR-CHAT-02 (Reply / Kutip Pesan):** Pengguna dapat membalas pesan spesifik; kutipan pesan ditampilkan di atas teks balasan dan dapat diklik untuk menggulir (*scroll*) ke pesan asli.
- **FR-CHAT-03 (Emoji Reactions):** Pengguna dapat memberikan reaksi cepat pada pesan (👍, ❤️, 😂, 😮, 😢, 🙏).
- **FR-CHAT-04 (Hapus Pesan):** Pengguna dapat menghapus pesan yang dikirim ("Hapus untuk Semua Orang" / *Delete for Everyone*) maupun menyembunyikan pesan di tampilan sendiri.
- **FR-CHAT-05 (Pencarian Dalam Chat):** Pengguna dapat mencari kata kunci di dalam riwayat pesan yang telah didekripsi di memori/cache lokal browser.

### 3.4 Indikator Kehadiran & Status Pesan (`FR-STATUS`)
- **FR-STATUS-01 (Read Receipts ala WhatsApp):**
  - **Jam (⏳):** Pesan sedang dienkripsi dan dikirim dari browser.
  - **Centang 1 Abu-abu (✓):** Pesan telah diterima dan disimpan oleh server.
  - **Centang 2 Abu-abu (✓✓):** Pesan telah terkirim ke perangkat/browser penerima yang sedang aktif.
  - **Centang 2 Emerald/Biru (✓✓):** Pesan telah dibuka dan dibaca oleh penerima.
- **FR-STATUS-02 (Typing Indicator):** Menampilkan status *" sedang mengetik..."* secara *real-time* di header ruang chat dan di daftar chat sidebar.
- **FR-STATUS-03 (Online & Last Seen):** Menampilkan status *Online* atau waktu terakhir aktif (*Last Seen*), dengan opsi privasi untuk menyembunyikannya.

### 3.5 Grup Kecil Terenkripsi (`FR-GROUP`)
- **FR-GROUP-01 (Pembuatan Grup):** Pengguna dapat membuat grup baru (maksimal 50 anggota pada tahap MVP), menetapkan nama grup, deskripsi, dan ikon grup.
- **FR-GROUP-02 (Enkripsi Kunci Grup):** Pembuat grup menghasilkan *Group Master Symmetric Key* (`AES-256-GCM`) dan mendistribusikannya dalam bentuk terenkripsi ke masing-masing anggota menggunakan kunci publik tiap anggota.
- **FR-GROUP-03 (Manajemen Anggota & Rotasi Kunci):** Admin grup dapat menambah atau mengeluarkan anggota. Saat anggota dikeluarkan, kunci grup dirotasi secara otomatis agar anggota lama tidak dapat mendekripsi pesan grup berikutnya.

### 3.6 Berbagi Gambar & Dokumen E2EE (`FR-MEDIA`)
- **FR-MEDIA-01 (Enkripsi File di Sisi Klien):** Sebelum gambar atau dokumen diunggah ke server, browser mengenkripsi biner file menggunakan kunci acak sekali pakai (`AES-256-GCM`).
- **FR-MEDIA-02 (Pengiriman Kunci File via Chat E2EE):** URL blob terenkripsi beserta kunci dekripsi file, *Initialization Vector (IV)*, nama file asli, ukuran, dan tipe MIME dikirimkan di dalam *payload* pesan terenkripsi E2EE.
- **FR-MEDIA-03 (Pratinjau Gambar & Lightbox):** File gambar (`JPG`, `PNG`, `WEBP`, `GIF`) otomatis didekripsi di browser penerima dan ditampilkan sebagai pratinjau di dalam *bubble* chat, lengkap dengan tampilan *Lightbox* layar penuh saat diklik.
- **FR-MEDIA-04 (Kartu Dokumen & Unduh Aman):** File dokumen (`PDF`, `DOCX`, `ZIP`, `TXT`, dll. hingga 25 MB pada MVP) ditampilkan dalam bentuk kartu dokumen bergaya WhatsApp (ikon ekstensi, nama file, ukuran byte) yang mendekripsi file di memori saat tombol unduh ditekan.

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)

1. **Keamanan & Privasi (Zero-Knowledge Guarantee):**
   - Server **dilarang keras** menerima atau menyimpan *plaintext* password, *private key* mentah, *recovery phrase*, isi teks pesan, nama file asli, maupun isi file media yang tidak terenkripsi.
   - Seluruh operasi kriptografi dijalankan menggunakan standar **Web Crypto API** bawaan browser modern (`window.crypto.subtle`).
2. **Performa & Responsivitas:**
   - Waktu pengantaran pesan WebSocket lokal/normal `< 100ms`.
   - Enkripsi/dekripsi pesan teks `< 5ms` per pesan; enkripsi file 10 MB `< 300ms` dengan Web Crypto API.
   - Menggunakan cache lokal terenkripsi/terisolasi di **IndexedDB** agar pembukaan ulang percakapan terasa instan tanpa mengunduh ulang seluruh riwayat dari server.
3. **Kemudahan Deployment Lokal (Zero-Docker):**
   - Seluruh sistem dapat dijalankan langsung di Windows/macOS/Linux hanya dengan `Node.js` menggunakan database **SQLite (WAL Mode)** dan penyimpanan file lokal (`./data/uploads`) tanpa memerlukan instalasi Docker atau layanan database eksternal.
4. **Kompatibilitas & PWA:**
   - Mendukung penuh browser modern (Chrome, Edge, Firefox, Safari) baik di layar Desktop maupun Mobile, serta dilengkapi `manifest.json` agar dapat diinstal sebagai **Progressive Web App (PWA)**.

---

## 5. Metrik Keberhasilan Produk (Success Metrics)

- **Kecepatan Onboarding:** Pengguna baru dapat menyelesaikan pembuatan akun `@username`, pembangkitan kunci E2EE, dan menyimpan Recovery Key dalam waktu **< 45 detik**.
- **Integritas Zero-Knowledge:** Inspeksi langsung ke file database SQLite (`chat.db`) dan folder `./data/uploads` membuktikan bahwa **100% pesan dan file tersimpan dalam bentuk ciphertext/terenkripsi**.
- **Keandalan Sinkronisasi Multi-Sesi:** Pengguna yang login di Browser A dan Browser B menerima pesan masuk, perubahan status centang, dan gambar terenkripsi secara sinkron tanpa galat dekripsi.

---

## 6. Peta Jalan Pasca-MVP (Post-MVP Roadmap)

Fitur-fitur berikut sengaja dipisahkan dari MVP (v1.0) untuk menjaga fokus kualitas rilis pertama dan direncanakan pada fase berikutnya:

| Fase | Fitur | Deskripsi Singkat |
| :--- | :--- | :--- |
| **Fase 2 (v1.1)** | **Pesan Suara (Voice Note) E2EE** | Perekaman audio langsung dari mikrofon browser (`MediaRecorder API`), visualisasi *waveform*, dan enkripsi E2EE sebelum unggah. |
| **Fase 2 (v1.1)** | **Disappearing Messages** | Pengaturan pesan otomatis terhapus setelah 24 jam, 7 hari, atau 30 hari baik di klien maupun di penyimpanan server. |
| **Fase 3 (v1.2)** | **Voice & Video Call 1-on-1 (WebRTC)** | Panggilan suara dan video *Peer-to-Peer* terenkripsi (`DTLS-SRTP`) dengan pensinyalan (*signaling*) melalui WebSocket yang sudah ada. |
| **Fase 3 (v1.2)** | **Forwarding & Pin Message** | Meneruskan pesan ke ruang obrolan lain dan menyematkan pesan penting di bagian atas percakapan. |
| **Fase 4 (v2.0)** | **Status / Stories 24 Jam** | Berbagi pembaruan teks dan foto terenkripsi ke daftar kontak yang hilang otomatis dalam 24 jam ala WhatsApp Status. |

