export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeName(name: string): Uint8Array {
  return new TextEncoder().encode(name.replaceAll('\\', '/'));
}

function dosDateTime(at = new Date()): { time: number; date: number } {
  const year = Math.max(1980, at.getFullYear());
  const date = ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate();
  const time = (at.getHours() << 11) | (at.getMinutes() << 5) | Math.floor(at.getSeconds() / 2);
  return { time, date };
}

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

export function zipStore(entries: ZipEntry[]): Uint8Array {
  const stamp = dosDateTime();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encodeName(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer, local.byteOffset, local.byteLength);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 6, 0x0800);
    u16(localView, 8, 0);
    u16(localView, 10, stamp.time);
    u16(localView, 12, stamp.date);
    u32(localView, 14, crc);
    u32(localView, 18, data.length);
    u32(localView, 22, data.length);
    u16(localView, 26, name.length);
    u16(localView, 28, 0);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer, central.byteOffset, central.byteLength);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u16(centralView, 8, 0x0800);
    u16(centralView, 10, 0);
    u16(centralView, 12, stamp.time);
    u16(centralView, 14, stamp.date);
    u32(centralView, 16, crc);
    u32(centralView, 20, data.length);
    u32(centralView, 24, data.length);
    u16(centralView, 26, name.length);
    u16(centralView, 28, 0);
    u16(centralView, 30, 0);
    u16(centralView, 32, 0);
    u16(centralView, 34, 0);
    u16(centralView, 36, 0);
    u32(centralView, 38, 0);
    u32(centralView, 42, offset);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength);
  u32(eocdView, 0, 0x06054b50);
  u16(eocdView, 8, entries.length);
  u16(eocdView, 10, entries.length);
  u32(eocdView, 12, centralSize);
  u32(eocdView, 16, offset);
  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of locals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centrals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(eocd, cursor);
  return out;
}

export function unzipStore(buffer: Uint8Array): ZipEntry[] {
  if (buffer.length < 30) {
    throw new Error('Dit is geen geldig zip-pakket.');
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  let cursor = 0;
  while (cursor + 4 <= buffer.length) {
    const signature = view.getUint32(cursor, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }
    if (signature !== 0x04034b50) {
      throw new Error('Zip-directory is ongeldig.');
    }
    const method = view.getUint16(cursor + 8, true);
    const csize = view.getUint32(cursor + 18, true);
    const nameLen = view.getUint16(cursor + 26, true);
    const extraLen = view.getUint16(cursor + 28, true);
    const name = decoder.decode(buffer.subarray(cursor + 30, cursor + 30 + nameLen));
    if (method !== 0) {
      throw new Error(`Zip-compressie wordt niet ondersteund (${name}).`);
    }
    const dataStart = cursor + 30 + nameLen + extraLen;
    entries.push({ name, data: buffer.subarray(dataStart, dataStart + csize) });
    cursor = dataStart + csize;
  }
  if (entries.length === 0) {
    throw new Error('Het zip-pakket is leeg.');
  }
  return entries;
}
