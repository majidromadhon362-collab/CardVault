import fs from 'node:fs';
import path from 'node:path';
import pngToIco from 'png-to-ico';

const brandDirectory = path.resolve('Brand Assets');
const publicBrandDirectory = path.resolve('public', 'brand');
const buildDirectory = path.resolve('build');
const textLogoSource = path.join(brandDirectory, 'Logo CardVault Teks.png');
const iconLogoSource = path.join(brandDirectory, 'Icon Logo CardVault.png');

if (!fs.existsSync(textLogoSource)) {
  throw new Error(`Logo teks tidak ditemukan: ${textLogoSource}`);
}

if (!fs.existsSync(iconLogoSource)) {
  throw new Error(`Icon logo tidak ditemukan: ${iconLogoSource}`);
}

fs.mkdirSync(publicBrandDirectory, { recursive: true });
fs.mkdirSync(buildDirectory, { recursive: true });
fs.copyFileSync(textLogoSource, path.join(publicBrandDirectory, 'logo-cardvault-teks.png'));
fs.copyFileSync(iconLogoSource, path.join(publicBrandDirectory, 'icon-logo-cardvault.png'));

const ico = await pngToIco(iconLogoSource);
fs.writeFileSync(path.join(buildDirectory, 'icon.ico'), ico);

console.log('Prepared CardVault brand assets.');
