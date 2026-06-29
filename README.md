# CardVault

CardVault adalah desktop app untuk videografer yang ingin backup footage dari MMC/SD card ke laptop sambil mengecilkan ukuran file menggunakan FFmpeg.

Tagline: Secure footage backup, lighter storage.

App ini dibuat sebagai workflow sederhana:

1. Pilih video dari MMC/SD card, external drive, atau folder project.
2. Pilih preset kompresi.
3. Pilih folder output di laptop.
4. Jalankan kompres batch.
5. Cek hasil ukuran sebelum/sesudah.

## Status Project

Versi awal ini adalah MVP desktop app berbasis Electron + React + FFmpeg.

Fitur yang sudah ada:

- Home dashboard dengan group `Video Tools`, `Audio Tools`, dan `File Converter`.
- Video tools: compress video, proxy generator, convert format, merge video, generate thumbnail, resize video, change FPS, remove audio, burn subtitle.
- Audio tools: extract audio ke MP3/AAC/WAV.
- File converter: PDF to Word, PDF to Excel, Word to PDF, Excel to PDF via LibreOffice lokal.
- Drag and drop, choose files, scan folder, dan pilih folder output.
- Progress proses, ETA, speed, pause queue, cancel, retry failed, dan sound notification.
- Before/after summary, validation check, dan preview output media.
- Auto rename output agar file lama tidak ketimpa.

## Apakah Perlu Database?

Untuk MVP ini tidak perlu database.

Alasannya:

- App hanya memproses file lokal.
- File source dan output sudah ada di filesystem.
- Riwayat kompres belum wajib disimpan permanen.
- Setting preset bisa disimpan nanti sebagai config lokal kalau dibutuhkan.

Kalau nanti app berkembang, opsi penyimpanan yang masuk akal:

- Config lokal untuk default preset dan folder terakhir.
- JSON file untuk history ringan.
- SQLite hanya kalau butuh katalog footage, tag, project, search, dan riwayat kompres jangka panjang.

## Tech Stack

- Electron untuk desktop app.
- React untuk UI.
- Vite untuk development/build renderer.
- FFmpeg dan FFprobe untuk kompresi dan baca metadata video.
- Electron Builder untuk packaging installer Windows.

## Requirement

Install dulu:

- Node.js 20 atau lebih baru.
- npm.

Untuk development/build installer, mesin developer perlu FFmpeg dan FFprobe agar bisa dibundle ke installer. Untuk user yang menginstall app dari installer final, FFmpeg sudah ikut dibundle.

Untuk fitur `File Converter`, user perlu LibreOffice terinstall. Ini tetap 0 biaya dan proses berjalan lokal. Jika LibreOffice belum tersedia, CardVault akan menampilkan pesan validasi yang jelas.

Cek FFmpeg:

```powershell
ffmpeg -version
ffprobe -version
```

Kalau command belum dikenali, baca `docs/FFMPEG_SETUP.md`.

## Setup Development

Install dependency:

```powershell
npm install
```

Siapkan FFmpeg bundled untuk packaging:

```powershell
npm run prepare:ffmpeg
```

Jalankan app mode development:

```powershell
npm run dev
```

Build renderer:

```powershell
npm run build
```

Build folder app tanpa installer:

```powershell
npm run package
```

Build installer Windows:

```powershell
npm run dist
```

Build versi Tauri yang lebih ringan:

```powershell
$env:Path = "C:\Users\HP\.cargo\bin;$env:Path"
npm run tauri:build
```

Output Tauri ada di:

```text
src-tauri/target/release/bundle/
```

Output build ada di folder `release/`.

## Cara Pakai

1. Buka app.
2. Ikuti onboarding step-by-step yang muncul pertama kali.
3. Pastikan status `FFmpeg Ready` muncul di kanan atas.
4. Klik `Tambah File` dan pilih video dari MMC/SD card.
5. Pilih preset:
   - `High Quality`: hasil paling aman secara visual, ukuran masih bisa turun.
   - `Balanced`: rekomendasi harian.
   - `Small Size`: ukuran lebih kecil, kualitas lebih agresif.
6. Klik `Pilih Folder Output`.
7. Klik `Mulai Kompres`.
8. Tunggu proses selesai dan cek hasil di panel `Hasil Terakhir`.

## Catatan Kualitas

Kompresi yang benar-benar tanpa penurunan kualitas biasanya tidak bisa mengecilkan ukuran jauh. App ini memakai pendekatan visually lossless, yaitu hasil tetap terlihat aman secara mata, tapi ukuran file bisa lebih kecil.

Preset saat ini memakai H.265/HEVC karena efisien untuk archive video. Kalau butuh kompatibilitas maksimal untuk semua device lama, preset H.264 bisa ditambahkan nanti.

## Struktur Folder

```text
.
├── src/
│   ├── main/
│   │   ├── main.js
│   │   └── preload.cjs
│   └── renderer/
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
├── docs/
│   ├── DEVELOPMENT.md
│   ├── FFMPEG_SETUP.md
│   ├── PACKAGING.md
│   └── USER_GUIDE.md
├── AGENTS.md
├── ARCHITECTURE.md
├── package.json
└── vite.config.js
```

## Roadmap

- Simpan folder output terakhir.
- Tambah preset H.264 untuk kompatibilitas.
- Tambah opsi hardware encoder NVIDIA/Intel/AMD.
- Tambah estimasi durasi kompres.
- Tambah mode pilih folder source dan scan semua video.
- Tambah validasi hasil sebelum original dihapus manual oleh user.
- Tambah app icon custom agar installer tidak memakai icon default Electron.

## Prinsip Aman Backup

Jangan hapus file original dari MMC/SD card sebelum:

- File hasil kompres selesai tanpa error.
- File output bisa diputar.
- Ukuran dan durasi masuk akal.
- Minimal satu backup tambahan sudah dibuat jika footage penting.
