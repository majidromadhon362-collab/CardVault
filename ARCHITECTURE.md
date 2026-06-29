# Architecture

CardVault memakai arsitektur desktop lokal: React renderer untuk UI, Tauri/Rust backend untuk akses sistem, FFmpeg untuk media processing, dan Rust native converter untuk dokumen.

## Diagram Alur

```text
User
  |
  v
React Renderer
  |
  | window.kompres API
  v
src/renderer/native.js
  |
  | Tauri invoke/events
  v
Rust Backend (src-tauri/src/lib.rs)
  |                 |
  | spawn           | native crates
  v                 v
FFmpeg/FFprobe      document.rs
  |                 |
  v                 v
Output di folder pilihan user
```

## Komponen

### Renderer

Lokasi: `src/renderer/`

Tanggung jawab:

- Menampilkan workflow pilih file, opsi, folder output, queue, progress, hasil, dan preview.
- Menyimpan state sementara selama app dibuka.
- Memanggil API `window.kompres` dari `native.js`.
- Menampilkan banner update jika versi baru tersedia.
- Tidak mengakses Node.js langsung.

### Tauri Adapter

Lokasi: `src/renderer/native.js`

Tanggung jawab:

- Mengekspos API kompatibel `window.kompres` untuk renderer.
- Memanggil command Rust via `invoke`.
- Subscribe event progress via `listen`.
- Mengecek update via `@tauri-apps/plugin-updater`.
- Menginstall update hanya setelah user klik tombol update.

### Rust Backend

Lokasi: `src-tauri/src/lib.rs`

Tanggung jawab:

- Native file/folder dialog.
- Validasi input dan output folder.
- Queue processing, pause, resume, cancel.
- Spawn FFmpeg/FFprobe bundled.
- Emit progress dan hasil ke renderer.
- Menjaga output agar tidak overwrite file lama.

### Document Converter

Lokasi: `src-tauri/src/document.rs`

Tanggung jawab:

- DOCX ke PDF.
- XLSX ke PDF.
- PDF ke DOCX.
- PDF ke XLSX.
- Semua berjalan lokal tanpa LibreOffice.

Catatan: konversi PDF ke Word/Excel bersifat best-effort karena PDF tidak selalu menyimpan struktur dokumen secara semantik.

### FFmpeg

FFmpeg dan FFprobe dibundle sebagai resource Tauri.

Lokasi development:

```text
resources/ffmpeg/win32-x64/ffmpeg.exe
resources/ffmpeg/win32-x64/ffprobe.exe
```

Backend mencari binary dari resource app terlebih dahulu, lalu fallback ke folder development.

## Release Dan Update

GitHub Actions berjalan saat tag `v*.*.*` dipush.

Workflow:

1. Checkout repo.
2. Setup Node dan Rust.
3. `npm ci`.
4. Install/copy FFmpeg.
5. `npm run tauri:build`.
6. Upload installer dan updater artifacts ke GitHub Release.

Update di app tidak otomatis. App hanya mengecek update dan menampilkan card. User harus klik tombol update untuk download/install.

## Data Flow Media Processing

1. User memilih file.
2. Renderer mengirim payload tool ke Rust backend.
3. Backend membuat path output aman dengan suffix `-cardvault`.
4. FFprobe membaca durasi jika media.
5. FFmpeg berjalan dengan argumen sesuai tool.
6. Backend membaca progress dari stderr FFmpeg.
7. Renderer menerima event progress dan hasil.
8. Output divalidasi dan ditampilkan ke user.

## Kenapa Tidak Ada Database?

App belum membutuhkan database karena semua data utama adalah file lokal dan output di filesystem.

Database baru masuk akal jika nanti ada:

- Project library.
- History permanen.
- Tag footage.
- Search metadata.
- Resume queue lintas restart app.

Untuk setting sederhana, config lokal lebih cocok daripada database.

## Risiko Teknis

- H.265 lebih lambat dari H.264.
- Beberapa device lama tidak support playback H.265.
- Progress FFmpeg bergantung parsing log.
- Kompresi lossy tidak menjamin ukuran selalu lebih kecil untuk semua source.
- PDF ke Word/Excel tidak bisa selalu mempertahankan layout kompleks.
- Installer belum Windows code-signed, jadi SmartScreen bisa memberi warning.
