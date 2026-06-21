import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pngPaths = [
  resolve(root, 'public/icons/favicon-16.png'),
  resolve(root, 'public/icons/favicon-32.png'),
];

function pngSize(png) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  return { width, height };
}

function pngToIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let imageOffset = 6 + count * 16;

  for (const png of pngBuffers) {
    const { width, height } = pngSize(png);
    const entry = Buffer.alloc(16);
    entry[0] = width >= 256 ? 0 : width;
    entry[1] = height >= 256 ? 0 : height;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    entries.push(entry);
    imageOffset += png.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

const pngBuffers = pngPaths.map((path) => readFileSync(path));
const ico = pngToIco(pngBuffers);
const outPath = resolve(root, 'public/favicon.ico');
writeFileSync(outPath, ico);
console.log(`Wrote ${outPath} (${ico.length} bytes)`);
