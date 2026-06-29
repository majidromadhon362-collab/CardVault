# GitHub Releases dan Auto Update

Dokumen ini menjelaskan cara share CardVault secara profesional memakai GitHub Releases dan menyiapkan jalur auto update Tauri.

## Status Saat Ini

CardVault sudah punya build Tauri:

```text
src-tauri/target/release/bundle/nsis/CardVault_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/CardVault_0.1.0_x64_en-US.msi
```

Ukuran build Tauri jauh lebih kecil dari Electron karena Tauri memakai WebView bawaan Windows.

## Release Manual Profesional

1. Repository GitHub:

```text
git@github.com:majidromadhon362-collab/CardVault.git
```

2. Build installer:

```powershell
$env:Path = "C:\Users\HP\.cargo\bin;$env:Path"
npm run tauri:build
```

3. Buka GitHub repository.

4. Masuk ke `Releases`.

5. Klik `Draft a new release`.

6. Buat tag, contoh:

```text
v0.1.0
```

7. Upload artifact:

```text
src-tauri/target/release/bundle/nsis/CardVault_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/CardVault_0.1.0_x64_en-US.msi
```

8. Isi release notes:

- New features
- Fixes
- Known issues
- System requirements

## Auto Update Tauri

Auto update Tauri butuh signing key. Ini penting agar app hanya menerima update resmi dari developer.

### Generate Key

Jalankan:

```powershell
$env:Path = "C:\Users\HP\.cargo\bin;$env:Path"
npx tauri signer generate -w .tauri\cardvault.key
```

Output akan memberi:

- Private key: simpan aman, jangan commit.
- Public key: masuk ke config Tauri updater.

### GitHub Secrets

Di GitHub repository, simpan private key sebagai secret:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

### Endpoint Update

Endpoint update diarahkan ke file metadata release:

```text
https://github.com/majidromadhon362-collab/CardVault/releases/latest/download/latest.json
```

Config updater sudah diaktifkan di `src-tauri/tauri.conf.json` memakai endpoint GitHub tersebut.

## Catatan Keamanan

- Jangan commit private key.
- Jangan upload build unsigned sebagai auto update production.
- Test update dari versi lama ke versi baru sebelum release publik.
- Untuk distribusi profesional di Windows, tetap disarankan code signing certificate agar SmartScreen lebih percaya.

## Website Vercel

Vercel hanya untuk landing page dan tombol download.

Tombol download arahkan ke:

```text
https://github.com/majidromadhon362-collab/CardVault/releases/latest
```

Jangan proses file video di Vercel. Semua proses CardVault tetap lokal di device user.
