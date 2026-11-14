# UI/UX & Visual Design Specification (`DESIGN.md`)
**Nama Proyek:** WhisperWeb - Private E2EE Web Messenger  
**Arah Estetika:** Airy & Modern (Telegram Santai) dengan Dark Mode Tenang Default (`#303841`) & Palet ColorHunt (`#F5F5F5` · `#76ABAE` · `#303841` · `#FF5722`)

---

## 1. Filosofi Desain (Design Principles)

1. **Santai, Lega, dan Nyaman untuk Ngobrol:** Antarmuka mengutamakan rasa santai dengan tata letak 2-panel minimal ala Telegram, kapsul/pill yang lembut (`rounded-full`, `rounded-2xl`), *avatar* bulat ramah, dan jarak baca yang lapang.
2. **Privasi yang Tenang (*Quiet Privacy*):** Keamanan end-to-end tetap aktif di balik layar dengan bahasa antarmuka yang bersahabat (tanpa jargon teknis kaku atau tampilan terminal militer).
3. **Kontras Nyaman untuk Mata:** Mode gelap default berbasis `#303841` dipadukan dengan teks `#F5F5F5` dan teal `#76ABAE` yang kalem, serta aksen hangat `#FF5722` hanya pada tombol kirim dan penanda pesan belum dibaca.

---

## 2. Palet Warna & Design Tokens

### 2.1 Token Warna (ColorHunt Palette `#F5F5F5` · `#76ABAE` · `#303841` · `#FF5722`)

| Token Semantik | Dark Mode (Default) | Light Mode | Penggunaan Utama |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#262D35` | `#EAECEE` | Kanvas obrolan utama & latar halaman auth |
| `--bg-sidebar` | `#303841` | `#F5F5F5` | Panel daftar chat, header, composer, kartu login, & drawer |
| `--bg-input` | `#242A32` | `#FFFFFF` | Kolom cari & kotak ketik pesan |
| `--bg-hover` | `#38414B` | `#E7EAED` | Efek *hover* pada daftar chat & tombol ikon |
| `--bg-active` | `#3D4C52` | `#DFE7E8` | Item obrolan aktif & tab filter terpilih |
| `--bubble-out` | `#315155` | `#D9E8E9` | *Bubble* pesan keluar |
| `--bubble-in` | `#363F49` | `#FFFFFF` | *Bubble* pesan masuk |
| `--reply-out-bg` | `#274145` | `#C7DBDD` | Kutipan balasan & lampiran di dalam *bubble* keluar |
| `--reply-in-bg` | `#2C343D` | `#E7EBEE` | Kutipan balasan & lampiran di dalam *bubble* masuk |
| `--accent-primary` | `#FF5722` | `#FF5722` | Tombol kirim bulat, badge *unread*, tombol utama, & focus ring |
| `--accent-hover` | `#FF6D3F` | `#E64A19` | State *hover* pada tombol aksen |
| `--accent-fg` | `#181D23` | `#181D23` | Teks kontras tinggi di atas `--accent-primary` (`5.36:1`) |
| `--read-receipt` | `#9AD3D6` | `#2B5B5E` | Centang 2 pesan terbaca (*Read*) |
| `--text-primary` | `#F5F5F5` | `#303841` | Teks utama (nama kontak, isi pesan, judul) |
| `--text-secondary` | `#B6C0CA` | `#535F6B` | Teks sekunder (pratinjau pesan, jam, status) |
| `--text-bubble-out-meta` | `#C5DCDE` | `#45545B` | Jam & status di dalam *bubble* keluar |
| `--border-subtle` | `#3B4450` | `#CFD5DC` | Garis pemisah halus antar-panel & input |
| `--status-e2ee` | `#76ABAE` | `#47787B` | Status online, indikator terenkripsi, & typing indicator |
| `--status-warning` | `#F59E0B` | `#B45309` | Peringatan Recovery Key & dekripsi |
| `--status-danger` | `#FF7D52` | `#C83B12` | Hapus pesan, blokir kontak, keluar grup, & error |

---

## 3. Tipografi, Ikonografi & Geometri

### 3.1 Sistem Font
- **Font Antarmuka Utama:** `"Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif` untuk kesan ramah dan mudah dibaca.
- **Font Monospace (`.font-mono-code`):** `"Cascadia Mono", "JetBrains Mono", "Fira Code", Consolas, monospace` hanya dipakai pada kode verifikasi **60-digit Safety Number** dan **24-karakter Recovery Key**.

### 3.2 Geometri Halus (Airy Pill & Soft Rounded)
- **Avatar & Tombol Ikon:** Bulat penuh (`rounded-full`) agar terasa ringan dan ramah.
- **Search Bar & Composer:** Bentuk kapsul (`rounded-full` untuk kolom pencarian dan tab filter, `rounded-3xl` untuk kotak ketik pesan, dan tombol kirim bulat `rounded-full` `#FF5722`).
- **Bubble Pesan:** `rounded-2xl` empuk dengan sudut pangkal lembut (`rounded-tr-sm` untuk pesan keluar, `rounded-tl-sm` untuk pesan masuk).

---

## 4. Arsitektur Tata Letak (Layout Blueprint)

### 4.1 Tampilan Desktop (`>= 768px`)
Menggunakan kontainer layar penuh (`100dvh`, `overflow: hidden`) dengan struktur 2-panel minimal + 1 *Info Drawer* kondisional:

- **Panel 1: `Sidebar` Daftar Obrolan (`330px` sampai `360px`):**
  1. **Header (`h-16`):** Avatar bulat pengguna aktif + indikator online, nama & `@username`, serta tombol ikon bulat *Buat Grup*, *Ganti Tema*, *Profil & Pengaturan*, dan *Keluar*.
  2. **Search & Pill Filter:** Kolom pencarian bulat (`rounded-full`, pintasan `Ctrl/Cmd + K`) untuk memfilter chat atau mencari `@username` baru, serta filter kapsul `Semua`, `Belum Dibaca`, dan `Grup`.
  3. **Conversation List (`flex-1 overflow-y-auto`):** Item obrolan mengambang lembut (`rounded-2xl`) tanpa garis pemisah kaku, disertai badge jumlah pesan belum dibaca bulat `#FF5722`.
- **Panel 2: `ChatCanvas` Utama (`flex-1`):**
  1. **Empty State:** Tampilan tenang terpusat dengan ikon gembok bulat dan sapaan singkat untuk memilih atau mencari obrolan.
  2. **Chat Header (`h-16`):** Avatar bulat lawan bicara/grup, nama, status (*"online"*, *"terakhir dilihat..."*, *"sedang mengetik..."*), tombol pil **Terenkripsi** untuk membuka *Safety Number*, tombol cari pesan, dan tombol info drawer.
  3. **Message Stream (`flex-1 overflow-y-auto`):** Latar tenang `--bg-app`, pengingat privasi berbentuk kapsul di atas, pemisah tanggal bulat lembut, dan deretan *bubble* `rounded-2xl`.
  4. **Composer Bar:** Tombol emoji & lampiran bulat, kotak ketik `rounded-3xl`, dan tombol kirim bulat `#FF5722`.
- **Panel 3: Slide-Over `InfoDrawer` (`340px`, Kondisional):**
  - Header `h-16`, kartu info enkripsi `rounded-2xl` inset `--bg-app`, daftar media/dokumen terkirim, manajemen anggota grup, serta tombol Blokir / Keluar Grup.

### 4.2 Tampilan Mobile & PWA (`< 768px`)
- Navigasi satu panel penuh: daftar chat menempati layar penuh saat belum memilih obrolan, dan `ChatCanvas` menggantikannya dengan tombol kembali (`←`) di sisi kiri header.

---

## 5. Aksesibilitas & Interaksi Mikro

- **Pintasan Keyboard:** `Enter` (kirim), `Shift + Enter` (baris baru), `Esc` (tutup dialog/drawer/batal balas), `Ctrl/Cmd + K` (fokus ke pencarian).
- **Standar WCAG AA:** Seluruh pasangan warna teks dan tombol `#FF5722` (`#181D23` di atas `#FF5722` = `5.36:1`) lolos kontras >= `4.5:1`, memakai kontrol HTML native dengan `cursor: pointer` dan cincin `:focus-visible`.
- **Manajemen Memori Media:** `URL.createObjectURL` untuk foto terenkripsi dibersihkan lewat `revokeObjectURL` saat komponen dibongkar.
