# AGENTS.md

Panduan ini untuk AI agent atau developer yang mengerjakan CardVault.

## Tujuan Produk

CardVault membantu videografer melakukan backup footage dari MMC/SD card ke laptop sambil mengurangi ukuran file memakai FFmpeg.

Prioritas produk:

- Aman untuk workflow backup.
- Mudah dipakai setelah dokumentasi/event selesai.
- Tidak menghapus file original otomatis.
- Kualitas visual tetap aman.
- Batch processing harus jelas statusnya.

## Aturan Kerja

- Jangan menambahkan database kecuali ada kebutuhan jelas.
- Jangan menghapus file source/original secara otomatis.
- Jangan overwrite output yang sudah ada.
- Jangan menjalankan command destruktif ke folder user.
- Jaga UI tetap sederhana dan jelas untuk workflow harian.
- Prefer perubahan kecil yang langsung menyelesaikan masalah.

## Tech Stack

- Electron main process untuk akses dialog native, filesystem, dan FFmpeg.
- Preload script untuk expose API aman ke renderer.
- React renderer untuk UI.
- FFmpeg sebagai engine encode.
- FFprobe untuk metadata seperti durasi.

## Area Penting

- `src/main/main.js`: IPC, dialog file/folder, queue kompres, FFmpeg spawn.
- `src/main/preload.cjs`: bridge API dari main ke renderer.
- `src/renderer/App.jsx`: state UI dan workflow user.
- `src/renderer/styles.css`: visual desktop app.
- `docs/`: dokumentasi setup dan penggunaan.

## Testing Manual Minimal

Sebelum menganggap perubahan selesai:

- Jalankan `npm run build`.
- Jalankan `npm run dev` jika dependency sudah terinstall.
- Pastikan app bisa membuka dialog file dan folder.
- Pastikan status FFmpeg benar.
- Coba kompres satu file kecil.
- Cek output tidak menimpa file lama.

## Catatan FFmpeg

Preset utama saat ini memakai `libx265` karena targetnya archive hemat storage.

Jangan mengganti preset ke opsi yang jauh lebih agresif tanpa memberi label jelas ke user. Untuk videografer, kehilangan detail visual bisa berbahaya untuk footage penting.
