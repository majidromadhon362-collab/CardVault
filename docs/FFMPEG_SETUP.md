# FFmpeg Setup

CardVault memakai FFmpeg untuk encode video dan FFprobe untuk membaca metadata video.

Installer final sudah membundle `ffmpeg.exe` dan `ffprobe.exe`, jadi user biasa tidak perlu install FFmpeg manual. Setup ini tetap berguna untuk developer yang mau build installer dari source.

## Cek Apakah Sudah Terinstall

Buka PowerShell:

```powershell
ffmpeg -version
ffprobe -version
```

Kalau dua command itu menampilkan versi, FFmpeg sudah siap.

## Install FFmpeg di Windows

Cara paling gampang memakai winget:

```powershell
winget install Gyan.FFmpeg
```

Tutup PowerShell, buka lagi, lalu cek:

```powershell
ffmpeg -version
ffprobe -version
```

## Kalau Command Belum Dikenali

Biasanya folder `bin` FFmpeg belum masuk `PATH`.

Contoh folder yang perlu masuk PATH:

```text
C:\ffmpeg\bin
```

Setelah mengubah PATH:

- Tutup terminal.
- Buka terminal baru.
- Restart CardVault.

## Bundling ke Installer

Sebelum membuat installer, jalankan:

```powershell
npm run prepare:ffmpeg
```

Script ini menyalin hanya dua file ke resource app:

- `ffmpeg.exe`
- `ffprobe.exe`

File dokumentasi, script development, dan folder lain tidak ikut masuk app package.

## Kenapa FFprobe Dibutuhkan?

FFprobe dipakai untuk membaca durasi video. Durasi ini membantu app menghitung progress kompresi per file.

Tanpa FFprobe, FFmpeg masih bisa encode, tapi progress akurat lebih sulit.
