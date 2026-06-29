# Architecture

CardVault memakai arsitektur desktop app sederhana: Electron main process sebagai backend lokal, React renderer sebagai UI, dan FFmpeg sebagai worker eksternal untuk encode video.

## Diagram Alur

```text
User
  |
  v
React Renderer
  |
  | window.kompres API
  v
Electron Preload
  |
  | IPC invoke/on
  v
Electron Main Process
  |
  | spawn ffmpeg/ffprobe
  v
FFmpeg + FFprobe
  |
  v
Output video di folder pilihan user
```

## Komponen

### Renderer

Lokasi: `src/renderer/`

Tanggung jawab:

- Menampilkan workflow pilih file, preset, folder output, dan progress.
- Menyimpan state sementara selama app dibuka.
- Memanggil API dari preload lewat `window.kompres`.
- Tidak mengakses Node.js langsung.

### Preload

Lokasi: `src/main/preload.cjs`

Tanggung jawab:

- Menjadi bridge aman antara renderer dan main process.
- Mengekspos API terbatas:
  - `selectVideos()`
  - `selectFolder()`
  - `checkFfmpeg()`
  - `startCompression(payload)`
  - `cancelCompression()`
  - `on(channel, callback)`

### Main Process

Lokasi: `src/main/main.js`

Tanggung jawab:

- Membuat window desktop.
- Menampilkan native file/folder dialog.
- Mengecek ketersediaan FFmpeg dan FFprobe.
- Menjalankan queue kompresi.
- Membaca progress FFmpeg dari stderr.
- Mengirim event progress dan hasil ke renderer.

### FFmpeg

FFmpeg dibundle ke installer sebagai extra resource.

Lokasi saat development:

```text
resources/ffmpeg/win32-x64/ffmpeg.exe
resources/ffmpeg/win32-x64/ffprobe.exe
```

Lokasi setelah install/build:

```text
resources/ffmpeg/win32-x64/ffmpeg.exe
resources/ffmpeg/win32-x64/ffprobe.exe
```

Main process memakai bundled binary jika tersedia, lalu fallback ke `PATH` untuk development.

## Data Flow Kompresi

1. User memilih file video.
2. Renderer mengirim list file, preset, dan folder output ke main process.
3. Main process membuat job ID dan memulai queue.
4. Untuk setiap file:
   - FFprobe membaca durasi.
   - Path output dibuat aman dengan suffix preset.
   - FFmpeg dijalankan memakai argumen preset.
   - Progress dibaca dari log `time=HH:MM:SS.xx`.
   - Renderer menerima event progress.
   - Setelah selesai, ukuran input/output dihitung.
5. Renderer menampilkan ringkasan hasil.

## Preset Encoding

Preset berada di `PRESETS` pada `src/main/main.js`.

Preset saat ini:

- `high`: H.265 CRF 18, 10-bit, preset slow.
- `balanced`: H.265 CRF 22, preset medium.
- `small`: H.265 CRF 26, preset medium.

Output default adalah `.mp4` dengan `-movflags +faststart`.

## Kenapa Tidak Ada Database?

App versi awal tidak membutuhkan database karena semua data penting adalah file video dan folder output. State proses cukup berada di memory selama app berjalan.

Database baru masuk akal jika fitur berikut ditambahkan:

- Project library.
- History permanen.
- Tag footage.
- Search metadata.
- Resume queue lintas restart app.

Untuk setting sederhana, config lokal lebih cocok daripada database.

## Risiko Teknis

- FFmpeg belum tersedia di `PATH` user.
- H.265 lebih lambat dari H.264.
- Beberapa device lama tidak support playback H.265.
- Progress FFmpeg bergantung pada parsing log, jadi bisa tidak presisi di beberapa file.
- Kompresi lossy tidak menjamin ukuran selalu lebih kecil untuk semua source.

## Arah Pengembangan

- Simpan setting user di config lokal.
- Tambah hardware encoder.
- Tambah folder scan mode.
- Tambah integrity check sederhana.
- Tambah app icon custom.
