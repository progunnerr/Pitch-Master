import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, crc]);
}

function icon(size, transparent) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const heights = [0.19, 0.34, 0.26, 0.14];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;
      const radius = Math.hypot(px - 0.5, py - 0.5);
      let color = [16, 18, 15, transparent ? 0 : 255];
      if (Math.abs(radius - 0.292) < 0.003) color = [67, 83, 49, 255];
      for (let bar = 0; bar < 4; bar++) {
        const dx = Math.abs(px - (0.3875 + bar * 0.075));
        const dy = Math.max(0, Math.abs(py - 0.5) - heights[bar] / 2 + 0.016);
        if (Math.hypot(dx, dy) < 0.016) color = [209, 245, 122, 255];
      }
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      for (let channel = 0; channel < 4; channel++) raw[offset + channel] = color[channel];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(new URL('../assets/icon.png', import.meta.url), icon(1024, false));
writeFileSync(new URL('../assets/android-icon-foreground.png', import.meta.url), icon(1024, true));
writeFileSync(new URL('../assets/favicon.png', import.meta.url), icon(64, false));
console.log('Generated Pitch Master app icons.');
