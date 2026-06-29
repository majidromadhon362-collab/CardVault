import { app, BrowserWindow, dialog, ipcMain, Menu, Notification } from 'electron';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.avi', '.mts', '.m2ts', '.webm', '.m4v']);
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.aac', '.m4a', '.flac', '.ogg']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);

const VIDEO_FILTERS = [
  { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'mts', 'm2ts', 'webm', 'm4v'] },
  { name: 'All Files', extensions: ['*'] },
];

const AUDIO_FILTERS = [
  { name: 'Audio Files', extensions: ['wav', 'mp3', 'aac', 'm4a', 'flac', 'ogg'] },
  { name: 'All Files', extensions: ['*'] },
];

const DOCUMENT_FILTERS = [
  { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'] },
  { name: 'All Files', extensions: ['*'] },
];

const PRESETS = {
  high: {
    label: 'High Quality',
    videoArgs: ['-c:v', 'libx265', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p10le'],
    audioArgs: ['-c:a', 'aac', '-b:a', '192k'],
  },
  balanced: {
    label: 'Balanced',
    videoArgs: ['-c:v', 'libx265', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p'],
    audioArgs: ['-c:a', 'aac', '-b:a', '160k'],
  },
  small: {
    label: 'Small Size',
    videoArgs: ['-c:v', 'libx265', '-preset', 'faster', '-crf', '26', '-pix_fmt', 'yuv420p'],
    audioArgs: ['-c:a', 'aac', '-b:a', '128k'],
  },
};

let mainWindow;
let activeJob = null;

function toolFileName(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function getToolPath(name) {
  const platformArch = `${process.platform}-${process.arch}`;
  const fileName = toolFileName(name);
  const candidates = [
    path.join(process.resourcesPath, 'ffmpeg', platformArch, fileName),
    path.join(__dirname, '../../resources/ffmpeg', platformArch, fileName),
  ];

  const bundledPath = candidates.find((candidate) => fs.existsSync(candidate));
  return bundledPath || fileName;
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '../../dist/brand/icon-logo-cardvault.png'),
    path.join(__dirname, '../../public/brand/icon-logo-cardvault.png'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    title: 'CardVault',
    icon: getAppIconPath(),
    backgroundColor: '#06111f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function emit(channel, payload) {
  if (!mainWindow?.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Unknown';
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
    });
  });
}

function runProcess(command, args, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    activeJob.child = child;
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onData?.(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onData?.(text);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      activeJob.child = null;
      if (activeJob.cancelled) reject(new Error('Process cancelled'));
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
    });
  });
}

function parseFfmpegTime(line) {
  const match = /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/.exec(line);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parseFfmpegSpeed(line) {
  const match = /speed=\s*([\d.]+)x/.exec(line);
  return match ? Number.parseFloat(match[1]) : null;
}

function isAllowedFile(filePath, mode) {
  const ext = path.extname(filePath).toLowerCase();
  if (mode === 'video') return VIDEO_EXTENSIONS.has(ext);
  if (mode === 'audio') return AUDIO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext);
  if (mode === 'document') return DOCUMENT_EXTENSIONS.has(ext);
  return VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext) || DOCUMENT_EXTENSIONS.has(ext);
}

function scanFilesInDirectory(directoryPath, mode) {
  const results = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) results.push(...scanFilesInDirectory(fullPath, mode));
    else if (entry.isFile() && isAllowedFile(fullPath, mode)) results.push(fullPath);
  }

  return results;
}

function expandPaths(paths, mode = 'video') {
  const results = [];

  for (const itemPath of paths) {
    if (!fs.existsSync(itemPath)) continue;
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) results.push(...scanFilesInDirectory(itemPath, mode));
    else if (stat.isFile() && isAllowedFile(itemPath, mode)) results.push(itemPath);
  }

  return Array.from(new Set(results));
}

function getVideoDuration(filePath) {
  return runCommand(getToolPath('ffprobe'), [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]).then(({ stdout }) => Number.parseFloat(stdout.trim()) || 0);
}

function safeOutputPath(sourceFile, outputDirectory, suffix, extension) {
  const parsed = path.parse(sourceFile);
  let candidate = path.join(outputDirectory, `${parsed.name}-cardvault${extension}`);
  let index = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDirectory, `${parsed.name}-cardvault-${index}${extension}`);
    index += 1;
  }

  return candidate;
}

function safeNamedOutput(outputDirectory, baseName, extension) {
  let candidate = path.join(outputDirectory, `${baseName}-cardvault${extension}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDirectory, `${baseName}-cardvault-${index}${extension}`);
    index += 1;
  }
  return candidate;
}

function getFreeSpace(directoryPath) {
  try {
    const stats = fs.statfsSync(directoryPath);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

function findLibreOffice() {
  const directCandidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ];

  const directMatch = directCandidates.find((candidate) => fs.existsSync(candidate));
  if (directMatch) return directMatch;

  try {
    const finder = process.platform === 'win32' ? 'where.exe' : 'which';
    const output = execFileSync(finder, ['soffice'], { encoding: 'utf8' });
    return output.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

function notifyComplete(results, errors) {
  if (!activeJob?.notifyEnabled || !Notification.isSupported()) return;
  new Notification({
    title: 'CardVault selesai',
    body: `${results.length} berhasil, ${errors.length} gagal.`,
  }).show();
}

function waitUntilResumed(job) {
  if (!job.paused) return Promise.resolve();
  emit('compress:state', { jobId: job.jobId, paused: true, code: 'queuePaused' });

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!job.paused || job.cancelled) {
        clearInterval(interval);
        emit('compress:state', { jobId: job.jobId, paused: false, code: job.cancelled ? 'queueCancelled' : 'queueResumed' });
        resolve();
      }
    }, 250);
  });
}

async function validateOutput({ outputFile, sourceDuration, previewType }) {
  if (!fs.existsSync(outputFile)) return { ok: false, message: 'Output tidak ditemukan.' };
  const outputSize = fs.statSync(outputFile).size;
  if (outputSize <= 0) return { ok: false, message: 'Output kosong / 0 byte.' };

  if (previewType === 'video' || previewType === 'audio') {
    const outputDuration = await getVideoDuration(outputFile).catch(() => 0);
    if (sourceDuration > 0 && outputDuration > 0) {
      const drift = Math.abs(sourceDuration - outputDuration);
      const tolerance = Math.max(2, sourceDuration * 0.03);
      if (drift > tolerance) {
        return { ok: false, message: `Durasi beda: source ${formatDuration(sourceDuration)}, output ${formatDuration(outputDuration)}.` };
      }
    }
    return { ok: true, message: outputDuration > 0 ? `Validated, duration ${formatDuration(outputDuration)}.` : 'Validated.' };
  }

  return { ok: true, message: 'Validated, output file readable.' };
}

function subtitleFilterPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function buildFfmpegTask({ toolId, sourceFile, outputDirectory, options }) {
  const preset = PRESETS[options.presetKey || 'balanced'] || PRESETS.balanced;
  const common = ['-hide_banner', '-nostdin', '-y'];

  if (toolId === 'compress-video') {
    const outputFile = safeOutputPath(sourceFile, outputDirectory, options.presetKey || 'balanced', '.mp4');
    return {
      outputFile,
      previewType: 'video',
      args: [...common, '-i', sourceFile, '-map_metadata', '0', ...preset.videoArgs, '-threads', '0', ...preset.audioArgs, '-movflags', '+faststart', outputFile],
    };
  }

  if (toolId === 'proxy-generator') {
    const height = options.proxySize || '1080';
    const outputFile = safeOutputPath(sourceFile, outputDirectory, `proxy-${height}p`, '.mp4');
    return {
      outputFile,
      previewType: 'video',
      args: [...common, '-i', sourceFile, '-vf', `scale=-2:${height}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputFile],
    };
  }

  if (toolId === 'convert-video') {
    const format = options.videoFormat || 'mp4';
    const outputFile = safeOutputPath(sourceFile, outputDirectory, `converted-${format}`, `.${format}`);
    const codecArgs = format === 'webm'
      ? ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k']
      : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k'];
    return { outputFile, previewType: 'video', args: [...common, '-i', sourceFile, ...codecArgs, outputFile] };
  }

  if (toolId === 'extract-audio') {
    const format = options.audioFormat || 'mp3';
    const outputFile = safeOutputPath(sourceFile, outputDirectory, `audio-${format}`, `.${format}`);
    const codecArgs = format === 'wav' ? ['-c:a', 'pcm_s16le'] : format === 'aac' ? ['-c:a', 'aac', '-b:a', '192k'] : ['-c:a', 'libmp3lame', '-q:a', '2'];
    return { outputFile, previewType: 'audio', args: [...common, '-i', sourceFile, '-vn', ...codecArgs, outputFile] };
  }

  if (toolId === 'generate-thumbnail') {
    const outputFile = safeOutputPath(sourceFile, outputDirectory, 'thumbnail', '.jpg');
    return { outputFile, previewType: 'image', args: [...common, '-ss', options.timestamp || '00:00:03', '-i', sourceFile, '-frames:v', '1', '-q:v', '2', outputFile] };
  }

  if (toolId === 'resize-video') {
    const width = options.width || '1920';
    const outputFile = safeOutputPath(sourceFile, outputDirectory, `resize-${width}`, '.mp4');
    return { outputFile, previewType: 'video', args: [...common, '-i', sourceFile, '-vf', `scale=${width}:-2`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-c:a', 'aac', '-b:a', '160k', outputFile] };
  }

  if (toolId === 'change-fps') {
    const fps = options.fps || '30';
    const outputFile = safeOutputPath(sourceFile, outputDirectory, `fps-${fps}`, '.mp4');
    return { outputFile, previewType: 'video', args: [...common, '-i', sourceFile, '-filter:v', `fps=${fps}`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-c:a', 'aac', '-b:a', '160k', outputFile] };
  }

  if (toolId === 'remove-audio') {
    const outputFile = safeOutputPath(sourceFile, outputDirectory, 'no-audio', '.mp4');
    return { outputFile, previewType: 'video', args: [...common, '-i', sourceFile, '-c:v', 'copy', '-an', outputFile] };
  }

  if (toolId === 'burn-subtitle') {
    if (!options.subtitlePath) throw new Error('Pilih file subtitle .srt/.ass dulu.');
    const outputFile = safeOutputPath(sourceFile, outputDirectory, 'subtitle', '.mp4');
    return { outputFile, previewType: 'video', args: [...common, '-i', sourceFile, '-vf', `subtitles='${subtitleFilterPath(options.subtitlePath)}'`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-c:a', 'aac', '-b:a', '160k', outputFile] };
  }

  throw new Error(`Tool ${toolId} belum tersedia.`);
}

async function runSingleFfmpegTask({ toolId, sourceFile, outputDirectory, options, jobId, index, total, completedDuration, totalDuration, startedAt }) {
  const inputSize = fs.statSync(sourceFile).size;
  const duration = VIDEO_EXTENSIONS.has(path.extname(sourceFile).toLowerCase()) || AUDIO_EXTENSIONS.has(path.extname(sourceFile).toLowerCase())
    ? await getVideoDuration(sourceFile).catch(() => 0)
    : 0;
  const task = buildFfmpegTask({ toolId, sourceFile, outputDirectory, options });

  emit('compress:progress', { jobId, file: sourceFile, outputFile: task.outputFile, index, total, percent: 0, overallPercent: totalDuration ? Math.round((completedDuration / totalDuration) * 100) : 0, etaSeconds: null, speed: null, status: 'running' });

  await runProcess(getToolPath('ffmpeg'), task.args, (text) => {
    const seconds = parseFfmpegTime(text);
    const speed = parseFfmpegSpeed(text);
    if (seconds !== null && duration > 0) {
      const processedDuration = completedDuration + Math.min(seconds, duration);
      const overallPercent = totalDuration > 0 ? Math.min(99, Math.round((processedDuration / totalDuration) * 100)) : 0;
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const etaSeconds = overallPercent > 0 ? Math.max(0, (elapsedSeconds / (overallPercent / 100)) - elapsedSeconds) : null;
      emit('compress:progress', { jobId, file: sourceFile, outputFile: task.outputFile, index, total, percent: Math.min(99, Math.round((seconds / duration) * 100)), overallPercent, etaSeconds, speed, status: 'running' });
    }
  });

  const outputSize = fs.statSync(task.outputFile).size;
  const savedBytes = inputSize - outputSize;
  const validation = await validateOutput({ outputFile: task.outputFile, sourceDuration: duration, previewType: task.previewType });

  return {
    sourceFile,
    outputFile: task.outputFile,
    outputUrl: pathToFileURL(task.outputFile).toString(),
    inputSize,
    outputSize,
    inputSizeText: formatSize(inputSize),
    outputSizeText: formatSize(outputSize),
    savedBytes,
    savedText: formatSize(Math.max(savedBytes, 0)),
    savedPercent: inputSize > 0 ? Math.round((savedBytes / inputSize) * 100) : 0,
    validation,
    previewType: task.previewType,
  };
}

async function runMergeTask({ files, outputDirectory, options, jobId, startedAt }) {
  const listPath = path.join(os.tmpdir(), `cardvault-merge-${Date.now()}.txt`);
  const inputSize = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  const durations = await Promise.all(files.map((file) => getVideoDuration(file).catch(() => 0)));
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const outputFile = safeNamedOutput(outputDirectory, `merged-video-${Date.now()}`, '.mp4');
  const listContent = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent, 'utf8');

  try {
    await runProcess(getToolPath('ffmpeg'), ['-hide_banner', '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', outputFile], (text) => {
      const seconds = parseFfmpegTime(text);
      const speed = parseFfmpegSpeed(text);
      if (seconds !== null && totalDuration > 0) {
        const percent = Math.min(99, Math.round((seconds / totalDuration) * 100));
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const etaSeconds = percent > 0 ? Math.max(0, (elapsedSeconds / (percent / 100)) - elapsedSeconds) : null;
        emit('compress:progress', { jobId, file: `${files.length} videos`, outputFile, index: 1, total: 1, percent, overallPercent: percent, etaSeconds, speed, status: 'running' });
      }
    });
  } finally {
    fs.rmSync(listPath, { force: true });
  }

  const outputSize = fs.statSync(outputFile).size;
  const validation = await validateOutput({ outputFile, sourceDuration: totalDuration, previewType: 'video' });
  return {
    sourceFile: `${files.length} merged files`,
    outputFile,
    outputUrl: pathToFileURL(outputFile).toString(),
    inputSize,
    outputSize,
    inputSizeText: formatSize(inputSize),
    outputSizeText: formatSize(outputSize),
    savedBytes: inputSize - outputSize,
    savedText: formatSize(Math.max(inputSize - outputSize, 0)),
    savedPercent: inputSize > 0 ? Math.round(((inputSize - outputSize) / inputSize) * 100) : 0,
    validation,
    previewType: 'video',
  };
}

async function runDocumentTask({ toolId, sourceFile, outputDirectory }) {
  const libreOffice = findLibreOffice();
  if (!libreOffice) throw new Error('LibreOffice belum terinstall. Install LibreOffice untuk converter file 0 biaya.');

  const convertMap = {
    'pdf-to-docx': 'docx',
    'pdf-to-excel': 'xlsx',
    'word-to-pdf': 'pdf',
    'excel-to-pdf': 'pdf',
  };
  const target = convertMap[toolId];
  if (!target) throw new Error(`Converter ${toolId} belum tersedia.`);

  await runProcess(libreOffice, ['--headless', '--convert-to', target, '--outdir', outputDirectory, sourceFile]);

  const parsed = path.parse(sourceFile);
  const defaultOutput = path.join(outputDirectory, `${parsed.name}.${target}`);
  if (!fs.existsSync(defaultOutput)) throw new Error('Output converter tidak ditemukan. File mungkin tidak didukung LibreOffice.');

  const inputSize = fs.statSync(sourceFile).size;
  const outputSize = fs.statSync(defaultOutput).size;
  return {
    sourceFile,
    outputFile: defaultOutput,
    outputUrl: pathToFileURL(defaultOutput).toString(),
    inputSize,
    outputSize,
    inputSizeText: formatSize(inputSize),
    outputSizeText: formatSize(outputSize),
    savedBytes: inputSize - outputSize,
    savedText: formatSize(Math.max(inputSize - outputSize, 0)),
    savedPercent: inputSize > 0 ? Math.round(((inputSize - outputSize) / inputSize) * 100) : 0,
    validation: await validateOutput({ outputFile: defaultOutput, sourceDuration: 0, previewType: 'document' }),
    previewType: 'document',
  };
}

function filtersForMode(mode) {
  if (mode === 'audio') return AUDIO_FILTERS;
  if (mode === 'document') return DOCUMENT_FILTERS;
  return VIDEO_FILTERS;
}

ipcMain.handle('dialog:select-files', async (_event, mode = 'video') => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih file untuk CardVault',
    properties: ['openFile', 'multiSelections'],
    filters: filtersForMode(mode),
  });
  return result.canceled ? [] : expandPaths(result.filePaths, mode);
});

ipcMain.handle('dialog:select-source-folder', async (_event, mode = 'video') => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih folder untuk scan',
    properties: ['openDirectory'],
  });
  return result.canceled ? [] : expandPaths(result.filePaths, mode);
});

ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih folder output',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:select-subtitle', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih subtitle',
    properties: ['openFile'],
    filters: [{ name: 'Subtitle', extensions: ['srt', 'ass', 'ssa'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('files:expand', async (_event, payload) => expandPaths(Array.isArray(payload?.paths) ? payload.paths : [], payload?.mode || 'video'));

ipcMain.handle('files:inspect', async (_event, payload) => {
  const files = expandPaths(Array.isArray(payload?.files) ? payload.files : [], payload?.mode || 'video');
  const outputDirectory = payload?.outputDirectory;
  const totalInputBytes = files.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
  const freeBytes = outputDirectory && fs.existsSync(outputDirectory) ? getFreeSpace(outputDirectory) : null;
  const minimumRecommendedBytes = Math.max(totalInputBytes, 2 * 1024 ** 3);
  return { files, totalInputBytes, totalInputText: formatSize(totalInputBytes), freeBytes, freeText: freeBytes === null ? 'Unknown' : formatSize(freeBytes), lowDisk: freeBytes !== null && freeBytes < minimumRecommendedBytes, minimumRecommendedText: formatSize(minimumRecommendedBytes) };
});

ipcMain.handle('ffmpeg:check', async () => {
  try {
    const [{ stdout }] = await Promise.all([runCommand(getToolPath('ffmpeg'), ['-version']), runCommand(getToolPath('ffprobe'), ['-version'])]);
    return { ok: true, message: stdout.split('\n')[0] || 'FFmpeg is available' };
  } catch (error) {
    return { ok: false, message: 'FFmpeg/FFprobe belum tersedia.', detail: error.message };
  }
});

ipcMain.handle('tools:start', async (_event, payload) => {
  if (activeJob) return { ok: false, message: 'Masih ada proses berjalan.' };

  const toolId = payload?.toolId;
  const mode = payload?.mode || 'video';
  const files = expandPaths(Array.isArray(payload?.files) ? payload.files : [], mode);
  const outputDirectory = payload?.outputDirectory;
  const options = payload?.options || {};

  if (!toolId) return { ok: false, message: 'Pilih tool dulu.' };
  if (files.length === 0) return { ok: false, message: 'Pilih minimal satu file.' };
  if (!outputDirectory) return { ok: false, message: 'Pilih folder output dulu.' };
  if (!fs.existsSync(outputDirectory)) return { ok: false, message: 'Folder output tidak ditemukan.' };
  if (toolId === 'merge-video' && files.length < 2) return { ok: false, message: 'Merge video butuh minimal dua file.' };

  const totalInputBytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  const freeBytes = getFreeSpace(outputDirectory);
  const minimumRecommendedBytes = Math.max(totalInputBytes, 2 * 1024 ** 3);
  if (freeBytes !== null && freeBytes < minimumRecommendedBytes) {
    return { ok: false, message: `Storage output terlalu mepet. Free ${formatSize(freeBytes)}, rekomendasi minimal ${formatSize(minimumRecommendedBytes)}.` };
  }

  const jobId = `${Date.now()}`;
  activeJob = { jobId, cancelled: false, paused: false, child: null, notifyEnabled: Boolean(payload?.notifyEnabled) };

  queueMicrotask(async () => {
    const results = [];
    const errors = [];
    const startedAt = Date.now();

    try {
      emit('compress:state', { jobId, code: 'preparingFiles' });

      if (toolId === 'merge-video') {
        emit('compress:progress', { jobId, file: `${files.length} videos`, index: 1, total: 1, percent: 0, overallPercent: 0, etaSeconds: null, speed: null });
        const result = await runMergeTask({ files, outputDirectory, options, jobId, startedAt });
        results.push(result);
        emit('compress:file-complete', { jobId, result });
      } else if (mode === 'document') {
        for (let i = 0; i < files.length; i += 1) {
          if (activeJob.cancelled) break;
          await waitUntilResumed(activeJob);
          const sourceFile = files[i];
          try {
            emit('compress:progress', { jobId, file: sourceFile, index: i + 1, total: files.length, percent: 0, overallPercent: Math.round((i / files.length) * 100), etaSeconds: null, speed: null });
            const result = await runDocumentTask({ toolId, sourceFile, outputDirectory });
            results.push(result);
            emit('compress:file-complete', { jobId, result });
          } catch (error) {
            errors.push({ sourceFile, message: error.message });
            emit('compress:file-error', { jobId, sourceFile, message: error.message });
          }
        }
      } else {
        const durations = await Promise.all(files.map((file) => getVideoDuration(file).catch(() => 0)));
        const totalDuration = durations.reduce((total, duration) => total + duration, 0);
        let completedDuration = 0;

        for (let i = 0; i < files.length; i += 1) {
          if (activeJob.cancelled) break;
          await waitUntilResumed(activeJob);
          const sourceFile = files[i];
          try {
            const result = await runSingleFfmpegTask({ toolId, sourceFile, outputDirectory, options, jobId, index: i + 1, total: files.length, completedDuration, totalDuration, startedAt });
            completedDuration += durations[i] || 0;
            results.push(result);
            emit('compress:file-complete', { jobId, result });
          } catch (error) {
            errors.push({ sourceFile, message: error.message });
            emit('compress:file-error', { jobId, sourceFile, message: error.message });
          }
        }
      }

      notifyComplete(results, errors);
      emit('compress:complete', { jobId, cancelled: activeJob.cancelled, results, errors });
    } finally {
      activeJob = null;
    }
  });

  return { ok: true, jobId };
});

ipcMain.handle('compress:cancel', async () => {
  if (!activeJob) return { ok: true };
  activeJob.cancelled = true;
  activeJob.child?.kill('SIGTERM');
  return { ok: true };
});

ipcMain.handle('compress:pause', async () => {
  if (!activeJob) return { ok: true };
  activeJob.paused = true;
  emit('compress:state', { jobId: activeJob.jobId, paused: true, code: 'pauseRequested' });
  return { ok: true };
});

ipcMain.handle('compress:resume', async () => {
  if (!activeJob) return { ok: true };
  activeJob.paused = false;
  emit('compress:state', { jobId: activeJob.jobId, paused: false, code: 'queueResumed' });
  return { ok: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
