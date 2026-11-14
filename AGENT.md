# AI Agent Operational & Engineering Guide (`AGENT.md`)
**Proyek:** WhisperWeb — Private E2EE Web Messenger  
**Lingkungan Sistem:** Windows (PowerShell), Node.js, Monorepo TypeScript, Zero-Docker Local Persistence (SQLite WAL + Local Disk Storage)

> **INSTRUKSI WAJIB BAGI AI AGENT:**  
> Bacalah dokumen ini beserta [PRD.md](file:///c:/Coding/chat/PRD.md), [MVP.md](file:///c:/Coding/chat/MVP.md), [ARCHITECTURE.md](file:///c:/Coding/chat/ARCHITECTURE.md), dan [DESIGN.md](file:///c:/Coding/chat/DESIGN.md) sebelum membuat atau memodifikasi kode apa pun di repositori ini.

---

## 1. Hukum Inti Proyek (The 5 Golden Rules)

1. **HUKUM ZERO-KNOWLEDGE (KRITIS):**
   - Server (`apps/server`) **DILARANG KERAS** pernah menerima, memproses, menyimpan, atau mencatat (*log*) teks pesan asli (*plaintext*), kunci privat mentah (*raw private key*), password mentah pengguna, Recovery Key mentah, maupun file media yang belum dienkripsi.
   - Seluruh operasi enkripsi dan dekripsi (`ECDH`, `HKDF`, `PBKDF2`, `AES-256-GCM`) **WAJIB** dilakukan di sisi klien (`apps/web/src/crypto/`) menggunakan `window.crypto.subtle` (Web Crypto API).
2. **HUKUM ZERO-DOCKER LOKAL:**
   - Jangan menambahkan ketergantungan wajib pada Docker, PostgreSQL eksternal, Redis eksternal, atau S3 cloud untuk menjalankan proyek secara lokal.
   - Gunakan **SQLite dalam mode WAL (`better-sqlite3` + Drizzle ORM)** yang disimpan di `./data/chat.db` dan penyimpanan blob terenkripsi di `./data/uploads/`.
3. **HUKUM KONSISTENSI TIPE & KONTRAK (`packages/shared`):**
   - Setiap payload REST API dan setiap event WebSocket harus didefinisikan menggunakan skema **Zod** di `packages/shared` dan diimpor oleh `apps/server` maupun `apps/web`. Jangan menduplikasi tipe secara manual di kedua aplikasi.
4. **HUKUM DESAIN WHATSAPP MODERN (`DESIGN.md`):**
   - Ikuti palet warna, struktur 2-panel, bentuk *bubble* pesan, indikator Centang 1/2/Emerald, serta responsivitas mobile yang telah ditetapkan di `DESIGN.md`. Jangan membuat tata letak generik yang menyimpang dari karakter WhatsApp Web Modern.
5. **HUKUM KEBERSIHAN MEMORI & KEAMANAN:**
   - Jangan pernah menaruh kunci privat di `localStorage` dalam bentuk string biasa bila dapat disimpan sebagai `CryptoKey` atau objek terisolasi di `IndexedDB`.
   - Selalu panggil `URL.revokeObjectURL()` saat komponen gambar/media yang telah didekripsi di-unmount.

---

## 2. Peta Navigasi Dokumentasi

| Dokumen | Kapan Harus Dibaca oleh Agent |
| :--- | :--- |
| [PRD.md](file:///c:/Coding/chat/PRD.md) | Saat memeriksa aturan bisnis, kebutuhan fitur (`FR-*`), dan target pengguna. |
| [MVP.md](file:///c:/Coding/chat/MVP.md) | Saat menentukan urutan pengerjaan *Milestone 1–5*, alur *sequence diagram*, dan batasan fitur *In-Scope*. |
| [ARCHITECTURE.md](file:///c:/Coding/chat/ARCHITECTURE.md) | Saat mengimplementasikan struktur folder, protokol kriptografi E2EE, skema tabel Drizzle SQLite, endpoint REST, atau event WebSocket. |
| [DESIGN.md](file:///c:/Coding/chat/DESIGN.md) | Saat membangun komponen React, mengatur variabel tema Tailwind CSS (Dark/Light), dan menata tata letak 2-panel. |

---

## 3. Standar Teknis & Konvensi Kode

### 3.1 TypeScript & Monorepo
- Gunakan **TypeScript `strict: true`** di seluruh paket (`apps/web`, `apps/server`, `packages/shared`).
- Hindari penggunaan `any`; gunakan tipe eksplisit atau inferensi `z.infer<typeof Schema>` dari Zod.
- Gunakan `async/await` dengan penanganan galat (`try/catch`) yang rapi dan pesan error yang aman (jangan membocorkan *stack trace* internal ke klien).

### 3.2 Backend (`apps/server`)
- **Framework:** `Hono` di atas Node.js dengan `@hono/node-ws` untuk WebSocket.
- **Database:** Saat inisialisasi koneksi `better-sqlite3`, selalu jalankan:
  ```ts
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  ```
- **Otomatisasi Folder Data:** Pastikan server secara otomatis membuat direktori `./data` dan `./data/uploads` saat *startup* (`fs.mkdirSync(..., { recursive: true })`) agar pengembang tidak pernah mengalami error `ENOENT`.
- **Validasi Input:** Semua route `POST`/`PATCH` wajib memvalidasi body menggunakan skema Zod dari `packages/shared`.

### 3.3 Frontend (`apps/web`)
- **Modul Kriptografi (`src/crypto/`):**
  - Gunakan fungsi murni (*pure async functions*) dengan input dan output yang jelas (`ArrayBuffer` / `Uint8Array` / Base64 URL-safe).
  - Gunakan `crypto.getRandomValues(new Uint8Array(12))` untuk setiap `IV` `AES-256-GCM`. **Dilarang keras menggunakan ulang IV yang sama untuk kunci yang sama.**
- **Manajemen State (`src/stores/`):**
  - Pisahkan state menjadi store yang terfokus: `useAuthStore`, `useChatStore`, `usePresenceStore`, dan `useThemeStore`.
  - Simpan cache kunci percakapan hasil derivasi ECDH (`Shared Conversation Key`) di memori sesi (`Map<conversationId, CryptoKey>`) agar tidak perlu menghitung ulang ECDH pada setiap pesan.

---

## 4. Perintah Kerja Standar (Windows PowerShell)

Gunakan perintah berikut saat mengembangkan dan memverifikasi proyek di Windows PowerShell:

```powershell
# 1. Instalasi seluruh dependensi monorepo
npm install

# 2. Build paket shared (kontrak Zod & tipe WebSocket)
npm run build --workspace=@chat/shared

# 3. Generate & jalankan migrasi database SQLite (Drizzle)
npm run db:push --workspace=@chat/server

# 4. Menjalankan server backend & frontend Vite secara bersamaan (Development)
npm run dev

# 5. Menjalankan pengecekan tipe TypeScript di seluruh monorepo
npm run typecheck

# 6. Menjalankan pengujian otomatis (Unit & Crypto/API Integration Tests)
npm run test
```

---

## 5. Urutan Eksekusi Pembangunan (Step-by-Step Build Playbook)

Ketika diminta untuk mulai membangun aplikasi dari cetak biru ini, kerjakan secara bertahap sesuai urutan **5 Milestone di `MVP.md`**:

1. **Langkah 1 — Scaffolding & Shared Contracts:**
   - Buat `package.json` root, `tsconfig.base.json`, dan struktur `packages/shared`, `apps/server`, serta `apps/web`.
   - Implementasikan seluruh skema Zod dan tipe event WebSocket di `packages/shared`.
2. **Langkah 2 — Database & Backend Core (`apps/server`):**
   - Implementasikan skema Drizzle SQLite (`users`, `passkey_credentials`, `conversations`, `conversation_members`, `messages`, `message_reactions`, `message_receipts`, `attachments`).
   - Buat endpoint Auth, Users, Conversations, Groups, Media Upload/Download, serta WebSocket Hub.
3. **Langkah 3 — Web Crypto Engine (`apps/web/src/crypto`):**
   - Implementasikan `keys.ts`, `cipher.ts`, dan `vault.ts` beserta unit test untuk memastikan siklus *Encrypt $\rightarrow$ Decrypt* teks, grup, dan file biner bekerja 100% akurat.
4. **Langkah 4 — Frontend Auth & WhatsApp Modern Layout (`apps/web`):**
   - Bangun halaman Login/Register/Recovery Key Modal + Passkey.
   - Bangun layout 2-panel WhatsApp Web Modern (Sidebar, Chat Header, Message Stream, Composer, Info Drawer, Safety Number Modal).
5. **Langkah 5 — Integrasi Real-Time, Grup, Media E2EE & Verifikasi:**
   - Hubungkan WebSocket *real-time* (pesan, *typing*, *online status*, centang 1/2/emerald, *reply*, *reaction*, *delete*).
   - Hubungkan unggah/unduh gambar & dokumen terenkripsi E2EE.
   - Jalankan verifikasi menyeluruh sesuai daftar *Definition of Done* di `MVP.md`.

