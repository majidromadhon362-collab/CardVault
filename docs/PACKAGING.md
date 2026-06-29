# Packaging Guide

CardVault memakai Electron Builder untuk membuat build Windows.

## Build Folder App

```powershell
npm run package
```

Output ada di `release/`.

Mode ini berguna untuk cek app sebelum membuat installer.

## Build Installer Windows

```powershell
npm run dist
```

Electron Builder akan membuat installer NSIS di folder `release/`.

Installer memakai mode step-by-step, bukan one-click. User bisa memilih mode install dan folder instalasi.

## Apakah Susah Menjadikan App?

Tidak terlalu susah untuk versi awal.

Yang perlu diperhatikan:

- Dependency harus sudah terinstall dengan `npm install`.
- FFmpeg harus tersedia di mesin developer saat build.
- Script `npm run dist` otomatis menjalankan `npm run prepare:ffmpeg`.
- `npm run dist` akan membuat installer.

## Catatan FFmpeg Saat Packaging

FFmpeg dan FFprobe dibundle sebagai extra resource, bukan dimasukkan ke `app.asar`.

Resource yang masuk:

```text
resources/ffmpeg/win32-x64/ffmpeg.exe
resources/ffmpeg/win32-x64/ffprobe.exe
```

App package sengaja tidak memasukkan `docs/`, `scripts/`, `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, atau folder development lain.

## Signing

Installer Windows yang belum di-code-sign bisa memunculkan warning SmartScreen. Untuk distribusi luas, gunakan code signing certificate.
