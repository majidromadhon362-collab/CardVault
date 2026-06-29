import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const platformArch = `${process.platform}-${process.arch}`;
const binaryExtension = process.platform === 'win32' ? '.exe' : '';
const targetDirectory = path.resolve('resources', 'ffmpeg', platformArch);

function findBinary(name) {
  const fileName = `${name}${binaryExtension}`;

  if (process.env.FFMPEG_BIN_DIR) {
    const candidate = path.join(process.env.FFMPEG_BIN_DIR, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }

  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  const output = execFileSync(finder, [fileName], { encoding: 'utf8' });
  const firstMatch = output.split(/\r?\n/).find(Boolean);

  if (!firstMatch) {
    throw new Error(`${fileName} tidak ditemukan di PATH.`);
  }

  return firstMatch;
}

function copyBinary(name) {
  const fileName = `${name}${binaryExtension}`;
  const source = findBinary(name);
  const target = path.join(targetDirectory, fileName);

  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.copyFileSync(source, target);
  fs.chmodSync(target, 0o755);

  console.log(`Bundled ${fileName} from ${source}`);
}

copyBinary('ffmpeg');
copyBinary('ffprobe');
