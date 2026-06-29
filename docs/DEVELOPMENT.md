# Development Guide

## Install Dependency

```powershell
npm install
```

## Run Development App

```powershell
npm run dev
```

Script ini menjalankan dua proses:

- Vite dev server untuk React renderer.
- Electron window yang membuka Vite URL.

## Build Renderer

```powershell
npm run build
```

Build output ada di `dist/`.

## Struktur Kode

```text
src/main/main.js       Electron main process dan FFmpeg runner
src/main/preload.cjs   Secure bridge ke renderer
src/renderer/App.jsx   UI dan workflow app
src/renderer/styles.css Styling app
```

## Menambah Preset

Preset ada di `src/main/main.js` pada object `PRESETS`.

Kalau menambah preset baru, update juga list `PRESETS` di `src/renderer/App.jsx` supaya tampil di UI.

Contoh preset H.264 kompatibel:

```js
compatible: {
  label: 'Compatible',
  videoArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p'],
  audioArgs: ['-c:a', 'aac', '-b:a', '160k'],
  extension: '.mp4',
}
```

## Debug FFmpeg

Jika kompres gagal:

- Pastikan file source bisa dibaca.
- Pastikan folder output bisa ditulis.
- Pastikan FFmpeg support codec yang dipakai.
- Coba command `ffmpeg -version` untuk melihat encoder tersedia.

## Prinsip Perubahan

- Main process mengurus filesystem dan FFmpeg.
- Renderer hanya mengurus UI.
- Preload hanya mengekspos API kecil dan aman.
- Jangan aktifkan `nodeIntegration` di renderer.
