# UI/UX & Visual Design Specification (`DESIGN.md`)
**Nama Proyek:** WhisperWeb - Private E2EE Web Messenger  
**Arah Estetika:** Cozy Coastal Lounge (Santai, Lega, Personal) dengan Palet ColorHunt (`#81A6C6` · `#AACDDC` · `#F3E3D0` · `#D2C4B4`) serta Dark Mode Twilight Coastal yang selaras

---

## 1. Filosofi Desain (Design Principles)

1. **Cozy Lounge & Santai:** Di desktop (`>= 768px`), antarmuka memisahkan daftar obrolan (*Chat Deck*) dan ruang obrolan (*Chat Room*) menjadi panel mengambang lembut (`rounded-[26px]`) dengan *Floating Header* dan *Floating Composer Dock* di dalam kanvas, sehingga terasa jauh lebih santai dan personal.
2. **Privasi yang Tenang (*Quiet Privacy*):** Keamanan end-to-end tetap aktif di balik layar dengan bahasa antarmuka yang bersahabat tanpa kesan kaku.
3. **Harmoni Terang & Gelap:** Light mode menonjolkan kanvas linen hangat `#F3E3D0`, tepi pasir `#D2C4B4`, dan bubble mist sky `#AACDDC`. Dark mode menyesuaikan ke slate pesisir malam (`#1B242E` / `#222D38`) berpadu teks linen `#F3E3D0` dan aksen `#81A6C6`.

---

## 2. Palet Warna & Design Tokens

### 2.1 Token Warna (ColorHunt Palette `#81A6C6` · `#AACDDC` · `#F3E3D0` · `#D2C4B4`)

| Token Semantik | Dark Mode (Default) | Light Mode | Penggunaan Utama |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#151D24` | `#E6D8C7` | Bingkai luar antar-panel & latar halaman auth |
| `--bg-canvas` | `#1B242E` | `#F3E3D0` | Kanvas utama ruang obrolan & kartu intro |
| `--bg-sidebar` | `#222D38` | `#FAF4EC` | Panel daftar chat, floating header, bubble masuk, modal, & drawer |
| `--bg-input` | `#18212A` | `#FFFDF9` | Kolom cari & floating composer dock |
| `--bg-hover` | `#2A3745` | `#E8DAC9` | Efek *hover* pada daftar chat & tombol ikon |
| `--bg-active` | `#2C3E4F` | `#D3E4EC` | Item obrolan aktif |
| `--bubble-out` | `#2E4A62` | `#AACDDC` | *Bubble* pesan keluar |
| `--bubble-in` | `#273340` | `#FAF4EC` | *Bubble* pesan masuk |
| `--reply-out-bg` | `#243B4E` | `#95BED0` | Kutipan balasan & lampiran di dalam *bubble* keluar |
| `--reply-in-bg` | `#1E2833` | `#EDE1D1` | Kutipan balasan & lampiran di dalam *bubble* masuk |
| `--accent-primary` | `#81A6C6` | `#81A6C6` | Tombol kirim bulat, tab aktif, badge *unread*, tombol utama, & focus ring |
| `--accent-hover` | `#96B7D4` | `#96B7D4` | State *hover* pada tombol aksen |
| `--accent-fg` | `#121B23` | `#121B23` | Teks kontras tinggi di atas `--accent-primary` (`6.80:1`) |
| `--read-receipt` | `#AACDDC` | `#2B5375` | Centang 2 pesan terbaca (*Read*) |
| `--text-primary` | `#F3E3D0` | `#1E2B37` | Teks utama (nama kontak, isi pesan, judul) |
| `--text-secondary` | `#C6B9A9` | `#475666` | Teks sekunder (pratinjau pesan, jam, status) |
| `--text-bubble-out-meta` | `#AACDDC` | `#2B4255` | Jam & status di dalam *bubble* keluar |
| `--border-subtle` | `#324150` | `#D2C4B4` | Garis pemisah halus antar-panel & input |
| `--status-e2ee` | `#AACDDC` | `#356085` | Status online, indikator terenkripsi, & typing indicator |
| `--status-warning` | `#F0B96B` | `#9A5B13` | Peringatan Recovery Key & dekripsi |
| `--status-danger` | `#F28B82` | `#B83A2E` | Hapus pesan, blokir kontak, keluar grup, & error |

---

## 3. Tipografi, Ikonografi & Geometri

- **Font Antarmuka Utama:** `"Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif`
- **Font Monospace (`.font-mono-code`):** `"Cascadia Mono", "JetBrains Mono", "Fira Code", Consolas, monospace` untuk **60-digit Safety Number** dan **24-karakter Recovery Key**.
- **Geometri Lounge:** Panel luar `rounded-[26px]` pada desktop, header mengambang `rounded-2xl`, composer mengambang `rounded-[26px]`, dan gelembung obrolan organik `rounded-[22px]` dengan sudut ekor `rounded-br-[6px]` / `rounded-bl-[6px]`.

---

## 4. Aksesibilitas & Interaksi Mikro

- **Pintasan Keyboard:** `Enter` (kirim), `Shift + Enter` (baris baru), `Esc` (tutup dialog/drawer/batal balas), `Ctrl/Cmd + K` (fokus ke pencarian).
- **Standar WCAG AA:** Seluruh pasangan warna teks, metadata bubble, avatar inisial, dan tombol `#81A6C6` (`#121B23` di atas `#81A6C6` = `6.80:1`) telah diuji lulus kontras >= `4.5:1`.
