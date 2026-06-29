# CardVault

CardVault adalah desktop app Windows untuk kreator dan videografer yang ingin memproses file secara lokal: kompres video, buat proxy, convert media, extract audio, dan convert dokumen tanpa upload file ke server.

Tagline: **Secure footage backup, lighter storage.**

## Untuk User

Download installer dari halaman **Releases**, lalu jalankan file `.exe` installer. Setelah install, CardVault langsung bisa dipakai.

User tidak perlu install tambahan:

- FFmpeg dan FFprobe sudah dibundle di installer.
- Converter dokumen berjalan native di dalam app, tanpa LibreOffice.
- File diproses lokal di komputer user.

Jangan download `Source code (zip)` untuk penggunaan normal. File itu adalah snapshot source project, bukan installer aplikasi.

## Fitur Utama

- Video: compress, proxy generator, convert format, merge video, thumbnail, resize, change FPS, remove audio, burn subtitle.
- Audio: extract audio ke MP3, AAC, atau WAV.
- Dokumen: PDF ke DOCX, PDF ke XLSX, DOCX ke PDF, XLSX ke PDF secara best-effort.
- Drag and drop, pilih file, scan folder, dan pilih folder output.
- Progress batch, ETA, speed, pause, cancel, retry failed, dan notifikasi selesai.
- Preview output video/audio/image.
- Output aman dengan suffix `-cardvault`, tidak overwrite file lama.
- Original/source file tidak pernah dihapus otomatis.
- Update app manual: app memberi banner jika versi baru tersedia, user memilih sendiri kapan update.

## Catatan Converter Dokumen

Converter dokumen tidak memakai LibreOffice. Implementasi native menjaga installer tetap kecil dan semua fitur bisa dipakai setelah sekali install.

Batasan yang sengaja diberi label jelas:

- Format modern `.docx` dan `.xlsx` didukung.
- Format lama `.doc` dan `.xls` tidak didukung; simpan ulang sebagai `.docx` atau `.xlsx`.
- PDF ke Word/Excel bersifat best-effort karena struktur PDF tidak selalu menyimpan tabel dan paragraf secara rapi.

## Tech Stack

- Tauri untuk desktop app ringan.
- React + Vite untuk renderer UI.
- Rust backend untuk dialog native, filesystem, queue processing, dan document converter.
- FFmpeg/FFprobe bundled untuk video dan audio.
- Tauri updater untuk pengecekan update manual berbasis GitHub Releases.

Electron masih ada sebagai fallback development lama, tetapi build distribusi utama adalah Tauri.

## Development

Install dependency:

```powershell
npm ci
```

Siapkan FFmpeg untuk build lokal:

```powershell
npm run prepare:ffmpeg
```

Jalankan renderer build:

```powershell
npm run build
```

Jalankan Tauri dev:

```powershell
$env:Path = "C:\Users\HP\.cargo\bin;$env:Path"
npm run tauri:dev
```

Build installer Windows:

```powershell
$env:Path = "C:\Users\HP\.cargo\bin;$env:Path"
npm run tauri:build
```

Output installer:

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

## Release

Release dibuat otomatis oleh GitHub Actions saat tag versi dipush:

```powershell
git tag v0.1.3
git push origin v0.1.3
```

GitHub Actions membutuhkan repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Installer yang dibagikan ke user adalah file `.exe` dari release assets, bukan `Source code (zip)`.

## Prinsip Aman Backup

- Jangan hapus file original sebelum output dicek.
- Pastikan output bisa diputar atau dibuka.
- Pastikan durasi/ukuran output masuk akal.
- Untuk footage penting, tetap simpan minimal satu backup tambahan.
