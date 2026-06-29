# AGENTS.md

Panduan ini untuk AI agent atau developer yang mengerjakan CardVault.

## Tujuan Produk

CardVault membantu videografer dan kreator memproses file lokal setelah dokumentasi/event: kompres video, buat proxy, convert media, extract audio, dan convert dokumen tanpa upload ke server.

Prioritas produk:

- Aman untuk workflow backup.
- Mudah dipakai setelah dokumentasi/event selesai.
- Tidak menghapus file original otomatis.
- Tidak overwrite output yang sudah ada.
- Kualitas visual tetap aman.
- Batch processing harus jelas statusnya.
- User cukup sekali install untuk memakai fitur utama.

## Aturan Kerja

- Jangan menambahkan database kecuali ada kebutuhan jelas.
- Jangan menghapus file source/original secara otomatis.
- Jangan overwrite output yang sudah ada.
- Jangan menjalankan command destruktif ke folder user.
- Jaga UI tetap sederhana dan jelas untuk workflow harian.
- Prefer perubahan kecil yang langsung menyelesaikan masalah.
- Jangan mengembalikan ketergantungan LibreOffice tanpa alasan kuat; document converter sekarang native Rust.
- Update app harus manual dari keputusan user, bukan auto-download diam-diam.

## Tech Stack

- Tauri sebagai target distribusi utama.
- Rust backend untuk filesystem, dialog native, FFmpeg spawn, queue, dan converter dokumen.
- React renderer untuk UI.
- FFmpeg/FFprobe sebagai engine video/audio dan metadata.
- GitHub Releases untuk pengecekan update manual dan distribusi installer.
- Electron masih ada sebagai fallback lama, bukan target utama release.

## Area Penting

- `src-tauri/src/lib.rs`: command Tauri, dialog, queue, FFmpeg spawn, progress events.
- `src-tauri/src/document.rs`: converter dokumen native Rust.
- `src-tauri/tauri.conf.json`: bundle dan resource FFmpeg.
- `src/renderer/App.jsx`: state UI, i18n, workflow user, manual update banner.
- `src/renderer/native.js`: adapter `window.kompres` untuk API Tauri.
- `src/renderer/styles.css`: visual desktop app.
- `.github/workflows/release.yml`: build installer dan publish GitHub Release.

## Testing Manual Minimal

Sebelum menganggap perubahan selesai:

- Jalankan `npm ci`.
- Jalankan `npm run build`.
- Jalankan `cargo check` dari folder `src-tauri`.
- Jika perubahan menyentuh bundling, jalankan `npm run tauri:build`.
- Pastikan dialog file dan folder bisa dibuka.
- Pastikan status FFmpeg benar.
- Coba kompres satu file kecil.
- Coba satu konversi dokumen sederhana.
- Cek output tidak menimpa file lama.

## Catatan FFmpeg

Preset utama memakai `libx265` karena targetnya archive hemat storage.

Jangan mengganti preset ke opsi yang jauh lebih agresif tanpa memberi label jelas ke user. Untuk videografer, kehilangan detail visual bisa berbahaya untuk footage penting.
