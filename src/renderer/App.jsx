import { useEffect, useMemo, useRef, useState } from 'react';

const LANGUAGES = {
  id: { label: 'Indonesia', flag: '🇮🇩' },
  en: { label: 'English', flag: '🇬🇧' },
};

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.6';

const TEXT = {
  id: {
    tagline: 'Backup footage aman, storage lebih ringan.',
    subtitle: 'Toolkit desktop lokal untuk kompres, konversi, preview, dan validasi file kreator tanpa upload footage ke server.',
    home: 'Beranda',
    about: 'Tentang',
    terms: 'Syarat',
    privacy: 'Privasi',
    back: 'Kembali',
    guide: 'Panduan',
    chooseFiles: 'Pilih File',
    scanFolder: 'Scan Folder',
    outputFolder: 'Folder Output',
    chooseOutput: 'Pilih Output',
    queue: 'Antrean',
    clear: 'Bersihkan',
    options: 'Opsi',
    selectedTool: 'Fitur Aktif',
    startProcess: 'Mulai Proses',
    pauseQueue: 'Pause Antrean',
    resumeQueue: 'Lanjutkan Antrean',
    cancelProcess: 'Batalkan Proses',
    retryFailed: 'Ulangi Gagal',
    noFiles: 'Belum ada file. Drop file, pilih file, atau scan folder.',
    dropTitle: 'Drag & drop file ke sini',
    dropSubtitle: 'Klik area ini untuk pilih file manual.',
    fileName: 'Nama File',
    format: 'Format',
    source: 'Sumber',
    remove: 'Hapus',
    results: 'Hasil',
    successFailed: '{success} berhasil, {failed} gagal',
    before: 'Sebelum',
    after: 'Sesudah',
    saved: 'Hemat Storage',
    validation: 'Validasi',
    preview: 'Preview',
    play: 'Play',
    savedFile: 'Tersimpan',
    valid: 'Valid',
    check: 'Cek',
    current: 'File',
    total: 'Total',
    eta: 'Sisa Waktu',
    working: 'Memproses...',
    outputNotSelected: 'Belum dipilih',
    storageTight: 'Storage mepet. Minimal {minimum}.',
    input: 'Input',
    freeOutput: 'Free output',
    preset: 'Preset',
    proxySize: 'Ukuran Proxy',
    videoFormat: 'Format Video',
    audioFormat: 'Format Audio',
    width: 'Lebar',
    fps: 'FPS',
    timestamp: 'Timestamp',
    chooseSubtitle: 'Pilih Subtitle',
    subtitleNotSelected: 'Belum dipilih',
    converterNote: 'Converter dokumen berjalan lokal di dalam app. Tidak perlu install LibreOffice atau upload file ke server.',
    consentTitle: 'Persetujuan Privasi',
    consentBody: 'CardVault memproses file secara lokal di laptop kamu. File tidak diupload ke server. Izinkan notifikasi jika ingin menerima info saat proses selesai.',
    acceptPrivacy: 'Saya Setuju',
    allowNotifications: 'Izinkan Notifikasi',
    skipNotifications: 'Nanti Saja',
    guideTitle: 'Panduan Fitur',
    close: 'Tutup',
    nextStepFiles: 'File sudah dipilih. Langkah berikutnya: pilih folder output.',
    nextStepOutput: 'Folder output sudah dipilih. Langkah berikutnya: mulai proses.',
    nextStepReady: 'Semua siap. Klik Mulai Proses.',
    notifyFinished: 'Proses selesai.',
    queuePaused: 'Antrean dipause. File aktif akan diselesaikan dulu.',
    queueCancelled: 'Antrean dibatalkan.',
    queueResumed: 'Antrean dilanjutkan.',
    preparingFiles: 'Menyiapkan file...',
    pauseRequested: 'Pause diminta. File aktif akan diselesaikan dulu.',
    aboutTitle: 'Tentang CardVault',
    aboutBody: 'CardVault adalah desktop app untuk kreator yang membantu kompres video, membuat proxy, konversi media, ekstrak audio, dan konversi dokumen secara lokal. Engine media memakai FFmpeg yang dibundle di installer. Converter dokumen berjalan native di dalam app tanpa LibreOffice.',
    termsTitle: 'Syarat & Ketentuan',
    termsBody: 'Gunakan CardVault untuk file yang kamu punya haknya. Selalu cek hasil output sebelum menghapus file original. Fitur dokumen bersifat best-effort karena hasil PDF ke Word/Excel bergantung pada struktur file sumber.',
    footer: 'Proses lokal. Original tidak dihapus otomatis.',
    versionLabel: 'Versi {version}',
    updateAvailableTitle: 'Update tersedia',
    updateAvailableBody: 'Versi {version} sudah tersedia. Update tidak otomatis; klik tombol ini untuk membuka download installer terbaru.',
    updateNow: 'Download Update',
    remindLater: 'Nanti Saja',
    updateInstalling: 'Membuka halaman download update...',
    updateFailed: 'Gagal membuka halaman update. Download installer terbaru dari halaman Releases.',
    groups: {
      video: { title: 'Video', description: 'Kompres, convert, proxy, thumbnail, subtitle, dan cleanup video.' },
      audio: { title: 'Audio', description: 'Ambil audio dari video dan ubah format audio.' },
      files: { title: 'Files', description: 'Konversi dokumen umum secara lokal.' },
    },
    tools: {
      'compress-video': ['Kompres Video', 'Kecilkan ukuran video dengan preset aman.', 'Pilih video, pilih preset, tentukan output, lalu mulai kompres.'],
      'proxy-generator': ['Proxy Generator', 'Buat proxy ringan untuk editing.', 'Pilih video resolusi tinggi, pilih ukuran proxy, lalu simpan output proxy.'],
      'convert-video': ['Convert Format', 'Ubah format video ke MP4, MKV, atau WebM.', 'Pilih video, pilih format target, lalu mulai konversi.'],
      'merge-video': ['Merge Video', 'Gabungkan beberapa video jadi satu file.', 'Pilih minimal dua video dengan urutan yang diinginkan, lalu merge.'],
      'generate-thumbnail': ['Generate Thumbnail', 'Ambil frame video menjadi gambar JPG.', 'Pilih video, isi timestamp, lalu generate thumbnail.'],
      'resize-video': ['Resize Video', 'Ubah resolusi video.', 'Pilih video, pilih lebar target, lalu mulai resize.'],
      'change-fps': ['Change FPS', 'Ubah frame rate video.', 'Pilih video, pilih FPS target, lalu mulai proses.'],
      'remove-audio': ['Remove Audio', 'Buat video tanpa audio.', 'Pilih video, pilih output, lalu hapus audio.'],
      'burn-subtitle': ['Burn Subtitle', 'Tempel subtitle ke video.', 'Pilih video, pilih file subtitle, lalu mulai proses.'],
      'extract-audio': ['Extract Audio', 'Ambil audio dari video ke MP3, AAC, atau WAV.', 'Pilih video/audio, pilih format audio, lalu ekstrak.'],
      'pdf-to-docx': ['PDF ke Word', 'Konversi PDF ke DOCX secara best-effort.', 'Pilih PDF digital yang bersih untuk hasil terbaik.'],
      'pdf-to-excel': ['PDF ke Excel', 'Konversi PDF ke XLSX secara best-effort.', 'Tabel sederhana akan lebih rapi daripada layout kompleks.'],
      'word-to-pdf': ['Word ke PDF', 'Konversi DOC/DOCX ke PDF.', 'Pilih dokumen Word, pilih output, lalu konversi.'],
      'excel-to-pdf': ['Excel ke PDF', 'Konversi XLS/XLSX ke PDF.', 'Pastikan sheet sudah rapi sebelum konversi.'],
    },
  },
  en: {
    tagline: 'Secure footage backup, lighter storage.',
    subtitle: 'A local desktop toolkit for creator file compression, conversion, preview, and validation without uploading footage to a server.',
    home: 'Home',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    back: 'Back',
    guide: 'Guide',
    chooseFiles: 'Choose Files',
    scanFolder: 'Scan Folder',
    outputFolder: 'Output Folder',
    chooseOutput: 'Choose Output',
    queue: 'Queue',
    clear: 'Clear',
    options: 'Options',
    selectedTool: 'Selected Tool',
    startProcess: 'Start Process',
    pauseQueue: 'Pause Queue',
    resumeQueue: 'Resume Queue',
    cancelProcess: 'Cancel Process',
    retryFailed: 'Retry Failed',
    noFiles: 'No files yet. Drop files, choose files, or scan a folder.',
    dropTitle: 'Drag & drop files here',
    dropSubtitle: 'Click this area to choose files manually.',
    fileName: 'File Name',
    format: 'Format',
    source: 'Source',
    remove: 'Remove',
    results: 'Results',
    successFailed: '{success} succeeded, {failed} failed',
    before: 'Before',
    after: 'After',
    saved: 'Storage Saved',
    validation: 'Validation',
    preview: 'Preview',
    play: 'Play',
    savedFile: 'Saved',
    valid: 'Valid',
    check: 'Check',
    current: 'Current',
    total: 'Total',
    eta: 'ETA',
    working: 'Working...',
    outputNotSelected: 'Not selected',
    storageTight: 'Low storage. Minimum {minimum}.',
    input: 'Input',
    freeOutput: 'Free output',
    preset: 'Preset',
    proxySize: 'Proxy Size',
    videoFormat: 'Video Format',
    audioFormat: 'Audio Format',
    width: 'Width',
    fps: 'FPS',
    timestamp: 'Timestamp',
    chooseSubtitle: 'Choose Subtitle',
    subtitleNotSelected: 'Not selected',
    converterNote: 'Document conversion runs locally inside the app. No LibreOffice install or server upload is required.',
    consentTitle: 'Privacy Consent',
    consentBody: 'CardVault processes files locally on your laptop. Files are not uploaded to a server. Allow notifications if you want completion alerts.',
    acceptPrivacy: 'I Agree',
    allowNotifications: 'Allow Notifications',
    skipNotifications: 'Skip For Now',
    guideTitle: 'Feature Guide',
    close: 'Close',
    nextStepFiles: 'Files selected. Next step: choose output folder.',
    nextStepOutput: 'Output folder selected. Next step: start process.',
    nextStepReady: 'Everything is ready. Click Start Process.',
    notifyFinished: 'Process finished.',
    queuePaused: 'Queue paused. Active file will finish first.',
    queueCancelled: 'Queue cancelled.',
    queueResumed: 'Queue resumed.',
    preparingFiles: 'Preparing files...',
    pauseRequested: 'Pause requested. Active file will finish first.',
    aboutTitle: 'About CardVault',
    aboutBody: 'CardVault is a desktop app for creators to compress videos, generate proxies, convert media, extract audio, and convert documents locally. Media processing uses FFmpeg bundled in the installer. Document conversion runs natively inside the app without LibreOffice.',
    termsTitle: 'Terms & Conditions',
    termsBody: 'Use CardVault only for files you have rights to process. Always verify output before deleting originals. Document conversion is best-effort because PDF to Word/Excel quality depends on the source file structure.',
    footer: 'Local processing. Originals are never deleted automatically.',
    versionLabel: 'Version {version}',
    updateAvailableTitle: 'Update available',
    updateAvailableBody: 'Version {version} is available. Updates are not automatic; click the button to open the latest installer download.',
    updateNow: 'Download Update',
    remindLater: 'Later',
    updateInstalling: 'Opening the update download page...',
    updateFailed: 'Could not open the update page. Download the latest installer from Releases.',
    groups: {
      video: { title: 'Video', description: 'Compress, convert, proxy, thumbnail, subtitle, and cleanup tools.' },
      audio: { title: 'Audio', description: 'Extract audio from videos and convert audio formats.' },
      files: { title: 'Files', description: 'Convert common documents locally.' },
    },
    tools: {
      'compress-video': ['Compress Video', 'Reduce video size with safe presets.', 'Choose videos, select a preset, choose output, then start compression.'],
      'proxy-generator': ['Proxy Generator', 'Create lightweight proxies for editing.', 'Choose high-resolution videos, select proxy size, then save proxy outputs.'],
      'convert-video': ['Convert Format', 'Convert video to MP4, MKV, or WebM.', 'Choose videos, select the target format, then start conversion.'],
      'merge-video': ['Merge Video', 'Combine multiple videos into one file.', 'Choose at least two videos in the desired order, then merge.'],
      'generate-thumbnail': ['Generate Thumbnail', 'Export a video frame as JPG.', 'Choose a video, set timestamp, then generate thumbnail.'],
      'resize-video': ['Resize Video', 'Change video resolution.', 'Choose videos, select target width, then resize.'],
      'change-fps': ['Change FPS', 'Change video frame rate.', 'Choose videos, select target FPS, then process.'],
      'remove-audio': ['Remove Audio', 'Create video without audio.', 'Choose videos, select output, then remove audio.'],
      'burn-subtitle': ['Burn Subtitle', 'Burn subtitle into video.', 'Choose video, choose subtitle file, then process.'],
      'extract-audio': ['Extract Audio', 'Extract audio to MP3, AAC, or WAV.', 'Choose media, select audio format, then extract.'],
      'pdf-to-docx': ['PDF to Word', 'Best-effort PDF to DOCX conversion.', 'Choose clean digital PDFs for best results.'],
      'pdf-to-excel': ['PDF to Excel', 'Best-effort PDF to XLSX conversion.', 'Simple tables work better than complex layouts.'],
      'word-to-pdf': ['Word to PDF', 'Convert DOC/DOCX to PDF.', 'Choose Word files, choose output, then convert.'],
      'excel-to-pdf': ['Excel to PDF', 'Convert XLS/XLSX to PDF.', 'Make sure sheets are clean before conversion.'],
    },
  },
};

const GROUPS = [
  { id: 'video', tools: ['compress-video', 'proxy-generator', 'convert-video', 'merge-video', 'generate-thumbnail', 'resize-video', 'change-fps', 'remove-audio', 'burn-subtitle'] },
  { id: 'audio', tools: ['extract-audio'] },
  { id: 'files', tools: ['pdf-to-docx', 'pdf-to-excel', 'word-to-pdf', 'excel-to-pdf'] },
];

const TOOL_META = {
  'compress-video': { mode: 'video', options: ['preset'] },
  'proxy-generator': { mode: 'video', options: ['proxySize'] },
  'convert-video': { mode: 'video', options: ['videoFormat'] },
  'merge-video': { mode: 'video', options: [] },
  'generate-thumbnail': { mode: 'video', options: ['timestamp'] },
  'resize-video': { mode: 'video', options: ['width'] },
  'change-fps': { mode: 'video', options: ['fps'] },
  'remove-audio': { mode: 'video', options: [] },
  'burn-subtitle': { mode: 'video', options: ['subtitle'] },
  'extract-audio': { mode: 'audio', options: ['audioFormat'] },
  'pdf-to-docx': { mode: 'document', options: [] },
  'pdf-to-excel': { mode: 'document', options: [] },
  'word-to-pdf': { mode: 'document', options: [] },
  'excel-to-pdf': { mode: 'document', options: [] },
};

function fileName(filePath) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function fileExtension(filePath) {
  const name = fileName(filePath);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > -1 ? name.slice(dotIndex + 1).toUpperCase() : 'FILE';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds === null || seconds < 0) return '...';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

function replaceTokens(text, tokens) {
  return Object.entries(tokens).reduce((value, [key, token]) => value.replace(`{${key}}`, token), text);
}

function playCompleteSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContext();
    const gain = audio.createGain();
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.5);
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime + index * 0.09);
      oscillator.connect(gain);
      oscillator.start(audio.currentTime + index * 0.09);
      oscillator.stop(audio.currentTime + 0.46 + index * 0.05);
    });
  } catch {
    // Best-effort sound notification.
  }
}

function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('cardvault-language') || 'id');
  const [theme, setTheme] = useState(() => localStorage.getItem('cardvault-theme') || 'light');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [page, setPage] = useState('home');
  const [selectedToolId, setSelectedToolId] = useState(null);
  const [files, setFiles] = useState([]);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [options, setOptions] = useState({ presetKey: 'balanced', proxySize: '1080', videoFormat: 'mp4', audioFormat: 'mp3', width: '1920', fps: '30', timestamp: '00:00:03', subtitlePath: '' });
  const [ffmpeg, setFfmpeg] = useState({ ok: false, message: 'Checking...' });
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState('');
  const [diskInfo, setDiskInfo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(() => localStorage.getItem('cardvault-privacy') === 'yes');
  const [notifyEnabled, setNotifyEnabled] = useState(() => localStorage.getItem('cardvault-notify') === 'yes');
  const dragDepth = useRef(0);
  const progressRef = useRef(null);
  const t = TEXT[language];

  const selectedTool = selectedToolId ? { id: selectedToolId, ...TOOL_META[selectedToolId] } : null;
  const selectedToolText = selectedToolId ? t.tools[selectedToolId] : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cardvault-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('cardvault-language', language);
  }, [language]);

  useEffect(() => {
    window.kompres.checkFfmpeg().then(setFfmpeg);
    window.kompres.checkForUpdates?.().then((update) => {
      if (update?.available) {
        setUpdateInfo(update);
      }
    }).catch(() => {});
    const offProgress = window.kompres.on('compress:progress', setProgress);
    const offFileComplete = window.kompres.on('compress:file-complete', ({ result }) => setResults((current) => [result, ...current]));
    const offFileError = window.kompres.on('compress:file-error', (payload) => setErrors((current) => [payload, ...current]));
    const offState = window.kompres.on('compress:state', (payload) => {
      setNotice(t[payload.code] || payload.message || '');
      setIsPaused(Boolean(payload.paused));
    });
    const offComplete = window.kompres.on('compress:complete', ({ cancelled, results: finalResults, errors: finalErrors }) => {
      setIsRunning(false);
      setIsPaused(false);
      setProgress(null);
      setNotice(cancelled ? t.queueCancelled : replaceTokens(t.successFailed, { success: finalResults.length, failed: finalErrors.length }));
      if (!cancelled) playCompleteSound();
    });
    return () => {
      offProgress();
      offFileComplete();
      offFileError();
      offState();
      offComplete();
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    async function inspect() {
      if (!selectedTool || files.length === 0) {
        setDiskInfo(null);
        return;
      }
      const info = await window.kompres.inspectFiles({ files, outputDirectory, mode: selectedTool.mode });
      if (!cancelled) setDiskInfo(info);
    }
    inspect();
    return () => {
      cancelled = true;
    };
  }, [files, outputDirectory, selectedToolId]);

  const summary = useMemo(() => {
    const inputBytes = results.reduce((total, result) => total + result.inputSize, 0);
    const outputBytes = results.reduce((total, result) => total + result.outputSize, 0);
    const savedBytes = inputBytes - outputBytes;
    return {
      inputText: formatBytes(inputBytes),
      outputText: formatBytes(outputBytes),
      savedText: formatBytes(Math.max(savedBytes, 0)),
      savedPercent: inputBytes > 0 ? Math.round((savedBytes / inputBytes) * 100) : 0,
      validated: results.filter((result) => result.validation?.ok).length,
    };
  }, [results]);

  const stepHint = useMemo(() => {
    if (files.length > 0 && !outputDirectory) return t.nextStepFiles;
    if (files.length > 0 && outputDirectory && !isRunning && results.length === 0) return t.nextStepReady;
    if (outputDirectory && files.length === 0) return t.nextStepOutput;
    return '';
  }, [files.length, outputDirectory, isRunning, results.length, t]);

  function selectTool(toolId) {
    setSelectedToolId(toolId);
    setPage('tool');
    setFiles([]);
    setResults([]);
    setErrors([]);
    setNotice('');
    setProgress(null);
  }

  function addFiles(nextFiles) {
    if (nextFiles.length === 0) return;
    setFiles((current) => Array.from(new Set([...current, ...nextFiles])));
    setNotice(`${nextFiles.length} ${language === 'id' ? 'file ditambahkan' : 'files added'}.`);
  }

  async function handleSelectFiles() {
    if (!selectedTool || isRunning) return;
    addFiles(await window.kompres.selectFiles(selectedTool.mode));
  }

  async function handleScanFolder() {
    if (!selectedTool || isRunning) return;
    const selected = await window.kompres.selectSourceFolder(selectedTool.mode);
    addFiles(selected);
  }

  async function handleSelectFolder() {
    if (isRunning) return;
    const selected = await window.kompres.selectFolder();
    if (selected) setOutputDirectory(selected);
  }

  async function handleSelectSubtitle() {
    const subtitlePath = await window.kompres.selectSubtitle();
    if (subtitlePath) setOptions((current) => ({ ...current, subtitlePath }));
  }

  async function handleDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (!selectedTool || isRunning) return;
    const droppedPaths = Array.from(event.dataTransfer.files).map((file) => window.kompres.getPathForFile(file)).filter(Boolean);
    addFiles(await window.kompres.expandFiles({ paths: droppedPaths, mode: selectedTool.mode }));
  }

  async function startFiles(targetFiles) {
    if (!selectedTool) return;
    setNotice('');
    setResults([]);
    setErrors([]);
    setIsPaused(false);
    const response = await window.kompres.startTool({ toolId: selectedTool.id, mode: selectedTool.mode, files: targetFiles, outputDirectory, options, notifyEnabled });
    if (response.ok) {
      setIsRunning(true);
      setProgress({ percent: 0, overallPercent: 0, status: 'queued', index: 1, total: targetFiles.length, etaSeconds: null });
      setTimeout(() => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } else {
      setNotice(response.message);
    }
  }

  async function allowNotifications() {
    let granted = true;
    if ('Notification' in window && Notification.permission !== 'granted') {
      granted = (await Notification.requestPermission()) === 'granted';
    }
    localStorage.setItem('cardvault-notify', granted ? 'yes' : 'no');
    setNotifyEnabled(granted);
    localStorage.setItem('cardvault-privacy', 'yes');
    setPrivacyAccepted(true);
  }

  function acceptPrivacy(skipNotify = false) {
    localStorage.setItem('cardvault-privacy', 'yes');
    if (skipNotify) localStorage.setItem('cardvault-notify', 'no');
    setPrivacyAccepted(true);
    if (skipNotify) setNotifyEnabled(false);
  }

  async function handleInstallUpdate() {
    setUpdateInstalling(true);
    setNotice(t.updateInstalling);
    try {
      const response = await window.kompres.installUpdate?.(updateInfo?.url);
      if (!response?.ok) setNotice(response?.message || t.updateFailed);
    } catch {
      setNotice(t.updateFailed);
    } finally {
      setUpdateInstalling(false);
    }
  }

  function renderHeader() {
    return (
      <header className="app-header">
        <button className="logo-button" onClick={() => { setPage('home'); setSelectedToolId(null); }}>
          <img src="/brand/logo-cardvault-teks.png" alt="CardVault" />
        </button>
        <nav>
          <button onClick={() => { setPage('home'); setSelectedToolId(null); }}>{t.home}</button>
          <button onClick={() => setPage('about')}>{t.about}</button>
          <button onClick={() => setPage('terms')}>{t.terms}</button>
        </nav>
        <div className="header-actions">
          <button className="icon-button" title={theme === 'light' ? 'Dark' : 'Light'} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '🌙' : '☀️'}</button>
          <div className="language-picker">
            <button onClick={() => setLanguageOpen((current) => !current)}>{LANGUAGES[language].flag} {LANGUAGES[language].label}</button>
            {languageOpen && <div className="language-menu">{Object.entries(LANGUAGES).map(([key, item]) => <button key={key} onClick={() => { setLanguage(key); setLanguageOpen(false); }}>{item.flag} {item.label}</button>)}</div>}
          </div>
        </div>
      </header>
    );
  }

  function renderHome() {
    return (
      <>
        <section className="hero-stage">
          <div className="hero-copy-block">
            <p className="eyebrow">CardVault</p>
            <h1>{t.tagline}</h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <span className="file-chip chip-video">
              <svg viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h7A2.5 2.5 0 0 1 16 7.5v.9l3.6-2.1A.9.9 0 0 1 21 7.1v9.8a.9.9 0 0 1-1.4.8L16 15.6v.9a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 16.5v-9Z" /></svg>
            </span>
            <span className="file-chip chip-audio">
              <svg viewBox="0 0 24 24"><path d="M10 4.8A1.8 1.8 0 0 1 11.8 3h.4A1.8 1.8 0 0 1 14 4.8v7.9a4 4 0 1 1-2-3.46V5h-2v-.2ZM6 16.8a6 6 0 0 0 12 0h2a8 8 0 0 1-7 7.94V27h-2v-2.26a8 8 0 0 1-7-7.94h2Z" /></svg>
            </span>
            <span className="file-chip chip-doc">
              <svg viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5V3Zm8 1.8V9h4.2L13 4.8ZM8 13h8v-1.8H8V13Zm0 3.4h8v-1.8H8v1.8Zm0 3.4h5v-1.8H8v1.8Z" /></svg>
            </span>
            <span className="file-chip chip-img">
              <svg viewBox="0 0 24 24"><path d="M5 5h14v14H5V5Zm2 2v8.6l3.2-3.2 2.5 2.5 3.1-4.1L17 13v4H7V7Zm9.2 3.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" /></svg>
            </span>
          </div>
        </section>
        <section className="group-grid">
          {GROUPS.map((group) => (
            <article className="group-card" key={group.id}>
              <div>
                <p className="eyebrow">{t.groups[group.id].title}</p>
                <h2>{t.groups[group.id].description}</h2>
              </div>
              <div className="tool-grid">
                {group.tools.map((toolId) => <button className="tool-card" key={toolId} onClick={() => selectTool(toolId)}><strong>{t.tools[toolId][0]}</strong><span>{t.tools[toolId][1]}</span></button>)}
              </div>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderStaticPage() {
    return <section className="static-page"><h1>{page === 'about' ? t.aboutTitle : t.termsTitle}</h1><p>{page === 'about' ? t.aboutBody : t.termsBody}</p></section>;
  }

  function renderOptions() {
    if (!selectedTool) return null;
    return <div className="option-list">
      {selectedTool.options.includes('preset') && <label>{t.preset}<select value={options.presetKey} onChange={(e) => setOptions((c) => ({ ...c, presetKey: e.target.value }))}><option value="high">High Quality</option><option value="balanced">Balanced</option><option value="small">Small Size</option></select></label>}
      {selectedTool.options.includes('proxySize') && <label>{t.proxySize}<select value={options.proxySize} onChange={(e) => setOptions((c) => ({ ...c, proxySize: e.target.value }))}><option value="1080">1080p</option><option value="720">720p</option><option value="540">540p</option></select></label>}
      {selectedTool.options.includes('videoFormat') && <label>{t.videoFormat}<select value={options.videoFormat} onChange={(e) => setOptions((c) => ({ ...c, videoFormat: e.target.value }))}><option value="mp4">MP4</option><option value="mkv">MKV</option><option value="webm">WebM</option></select></label>}
      {selectedTool.options.includes('audioFormat') && <label>{t.audioFormat}<select value={options.audioFormat} onChange={(e) => setOptions((c) => ({ ...c, audioFormat: e.target.value }))}><option value="mp3">MP3</option><option value="aac">AAC</option><option value="wav">WAV</option></select></label>}
      {selectedTool.options.includes('width') && <label>{t.width}<select value={options.width} onChange={(e) => setOptions((c) => ({ ...c, width: e.target.value }))}><option value="3840">3840</option><option value="1920">1920</option><option value="1280">1280</option><option value="854">854</option></select></label>}
      {selectedTool.options.includes('fps') && <label>{t.fps}<select value={options.fps} onChange={(e) => setOptions((c) => ({ ...c, fps: e.target.value }))}><option value="24">24</option><option value="25">25</option><option value="30">30</option><option value="60">60</option></select></label>}
      {selectedTool.options.includes('timestamp') && <label>{t.timestamp}<input value={options.timestamp} onChange={(e) => setOptions((c) => ({ ...c, timestamp: e.target.value }))} /></label>}
      {selectedTool.options.includes('subtitle') && <div className="subtitle-option"><button className="secondary-button" onClick={handleSelectSubtitle}>{t.chooseSubtitle}</button><span>{options.subtitlePath || t.subtitleNotSelected}</span></div>}
      {selectedTool.mode === 'document' && <div className="info-card">{t.converterNote}</div>}
    </div>;
  }

  function renderTool() {
    const canStart = selectedTool && files.length > 0 && outputDirectory && !isRunning && !diskInfo?.lowDisk;
    return (
      <section className="tool-panel">
        <div className="tool-topline"><button className="ghost-button" disabled={isRunning} onClick={() => { setPage('home'); setSelectedToolId(null); }}>{t.back}</button><button className="ghost-button" onClick={() => setGuideOpen(true)}>{t.guide}</button></div>
        <div className="tool-title-block"><p className="eyebrow">{selectedTool.mode}</p><h1>{selectedToolText[0]}</h1><p>{selectedToolText[1]}</p></div>
        <button className={`drop-zone ${isDragging ? 'dragging' : ''}`} disabled={isRunning} onClick={handleSelectFiles} onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setIsDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setIsDragging(false); }} onDrop={handleDrop}>
          <div className="drop-animation" aria-hidden="true"><span className="drop-card card-a">IN</span><span className="drop-card card-b">OUT</span><span className="drop-ring" /></div><strong>{t.dropTitle}</strong><span>{t.dropSubtitle}</span>
        </button>
        <div className="quick-actions"><button className="secondary-button" disabled={isRunning} onClick={handleSelectFiles}>{t.chooseFiles}</button><button className="secondary-button" disabled={isRunning} onClick={handleScanFolder}>{t.scanFolder}</button></div>
        <div className="output-row"><div><p className="label">{t.outputFolder}</p><strong>{outputDirectory || t.outputNotSelected}</strong></div><button className="secondary-button" disabled={isRunning} onClick={handleSelectFolder}>{t.chooseOutput}</button></div>
        {stepHint && <div className="step-hint"><span />{stepHint}</div>}
        {diskInfo && <div className={`disk-card ${diskInfo.lowDisk ? 'warning' : ''}`}><span>{t.input}: {diskInfo.totalInputText}</span><span>{t.freeOutput}: {diskInfo.freeText}</span>{diskInfo.lowDisk && <strong>{replaceTokens(t.storageTight, { minimum: diskInfo.minimumRecommendedText })}</strong>}</div>}
        {renderOptions()}
        <div className="queue-header"><div><p className="label">{t.queue}</p><strong>{files.length} file</strong></div><button className="ghost-button" disabled={files.length === 0 || isRunning} onClick={() => { setFiles([]); setResults([]); setErrors([]); }}>{t.clear}</button></div>
        <div className="sheet-list"><div className="sheet-row sheet-head"><span>No</span><span>{t.fileName}</span><span>{t.format}</span><span>{t.source}</span><span /></div>{files.length === 0 ? <div className="sheet-empty">{t.noFiles}</div> : files.map((file, index) => <div className="sheet-row" key={file}><span>{index + 1}</span><strong title={fileName(file)}>{fileName(file)}</strong><span>{fileExtension(file)}</span><span title={file}>{file}</span><button disabled={isRunning} onClick={() => setFiles((current) => current.filter((item) => item !== file))}>{t.remove}</button></div>)}</div>
        <div className="run-card inline-run"><small>{t.selectedTool}</small><strong>{selectedToolText[0]}</strong>{isRunning ? <div className="run-actions"><button className="secondary-button" onClick={async () => isPaused ? window.kompres.resumeCompression() : window.kompres.pauseCompression()}>{isPaused ? t.resumeQueue : t.pauseQueue}</button><button className="danger-button" onClick={() => window.kompres.cancelCompression()}>{t.cancelProcess}</button></div> : <button className="primary-button" disabled={!canStart} onClick={() => startFiles(files)}>{t.startProcess}</button>}{errors.length > 0 && !isRunning && <button className="secondary-button retry-button" onClick={() => startFiles(errors.map((e) => e.sourceFile))}>{t.retryFailed}</button>}</div>
      </section>
    );
  }

  return (
    <main className="app-shell compact-shell">
      {renderHeader()}
      {!privacyAccepted && <section className="consent-overlay"><div className="consent-card"><h2>{t.consentTitle}</h2><p>{t.consentBody}</p><div className="consent-actions"><button className="primary-button" onClick={() => acceptPrivacy(true)}>{t.acceptPrivacy}</button><button className="secondary-button" onClick={allowNotifications}>{t.allowNotifications}</button><button className="ghost-button" onClick={() => acceptPrivacy(true)}>{t.skipNotifications}</button></div></div></section>}
      {updateInfo && <section className="update-card"><div><p className="eyebrow">CardVault</p><h2>{t.updateAvailableTitle}</h2><p>{replaceTokens(t.updateAvailableBody, { version: updateInfo.version })}</p>{updateInfo.body && <small>{updateInfo.body}</small>}</div><div className="update-actions"><button className="primary-button" disabled={updateInstalling} onClick={handleInstallUpdate}>{updateInstalling ? t.working : t.updateNow}</button><button className="ghost-button" disabled={updateInstalling} onClick={() => setUpdateInfo(null)}>{t.remindLater}</button></div></section>}
      {guideOpen && selectedToolText && <section className="preview-overlay"><div className="guide-modal"><div className="preview-header"><div><p className="eyebrow">{t.guideTitle}</p><h2>{selectedToolText[0]}</h2></div><button className="ghost-button" onClick={() => setGuideOpen(false)}>{t.close}</button></div><p>{selectedToolText[2]}</p></div></section>}
      {preview && <section className="preview-overlay"><div className="preview-modal"><div className="preview-header"><div><p className="eyebrow">{t.preview}</p><h2>{fileName(preview.outputFile)}</h2></div><button className="ghost-button" onClick={() => setPreview(null)}>{t.close}</button></div>{preview.previewType === 'image' && <img className="preview-image" src={preview.outputUrl} alt={fileName(preview.outputFile)} />}{preview.previewType === 'audio' && <audio className="preview-audio" src={preview.outputUrl} controls autoPlay />}{preview.previewType === 'video' && <video src={preview.outputUrl} controls autoPlay />}<div className="preview-meta"><span>{preview.outputSizeText}</span><span>{preview.validation?.message}</span></div></div></section>}
      {page === 'home' && renderHome()}
      {(page === 'about' || page === 'terms') && renderStaticPage()}
      {page === 'tool' && selectedTool && renderTool()}
      {(progress || notice || isRunning) && <section className="panel progress-panel" ref={progressRef}>{isRunning && <div className="process-orb" aria-hidden="true"><span /><span /><span /></div>}{progress && <div className="progress-content"><div className="progress-header"><strong>{progress.file ? fileName(progress.file) : t.working}</strong><span>{progress.index}/{progress.total}</span></div><div className="progress-stats"><span>{t.current} {progress.percent || 0}%</span><span>{t.total} {progress.overallPercent || 0}%</span><span>{t.eta} {formatDuration(progress.etaSeconds)}</span><span>{progress.speed ? `${progress.speed}x` : t.working}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress.percent || 0}%` }} /></div><div className="progress-track total-track"><div className="progress-fill total-fill" style={{ width: `${progress.overallPercent || 0}%` }} /></div></div>}{notice && <p className="notice">{notice}</p>}</section>}
      {results.length > 0 && <section className="summary-grid"><article className="summary-card"><small>{t.before}</small><strong>{summary.inputText}</strong></article><article className="summary-card"><small>{t.after}</small><strong>{summary.outputText}</strong></article><article className="summary-card highlight"><small>{t.saved}</small><strong>{summary.savedText}</strong><span>{summary.savedPercent}%</span></article><article className="summary-card"><small>{t.validation}</small><strong>{summary.validated}/{results.length}</strong></article></section>}
      {(results.length > 0 || errors.length > 0) && <section className="panel result-panel"><div className="queue-header"><div><p className="label">{t.results}</p><strong>{replaceTokens(t.successFailed, { success: results.length, failed: errors.length })}</strong></div></div><div className="sheet-list"><div className="sheet-row sheet-head result-head"><span>{t.fileName}</span><span>{t.before}</span><span>{t.after}</span><span>{t.saved}</span><span>{t.validation}</span><span>{t.preview}</span></div>{results.map((result) => <div className="sheet-row result-row" key={result.outputFile}><strong title={fileName(result.outputFile)}>{fileName(result.outputFile)}</strong><span>{result.inputSizeText}</span><span>{result.outputSizeText}</span><span>{result.savedPercent}%</span><span className={result.validation?.ok ? 'valid-badge' : 'invalid-badge'}>{result.validation?.ok ? t.valid : t.check}</span>{['video', 'audio', 'image'].includes(result.previewType) ? <button onClick={() => setPreview(result)}>{t.play}</button> : <span>{t.savedFile}</span>}</div>)}{errors.map((error) => <div className="sheet-row result-row error" key={`${error.sourceFile}-${error.message}`}><strong>{fileName(error.sourceFile)}</strong><span>Failed</span><span>{error.message}</span><span /><span /><span /></div>)}</div></section>}
      <footer className="app-footer"><span>{t.footer}</span><span>{replaceTokens(t.versionLabel, { version: APP_VERSION })}</span><button onClick={() => setPage('about')}>{t.about}</button><button onClick={() => setPage('terms')}>{t.terms}</button></footer>
    </main>
  );
}

export default App;
