import { describe, expect, it } from 'vitest';
import { crc32, unzipStore, zipStore } from './zipStore';

function u16(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8);
}

function u32(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

function centralDirectory(zip: Uint8Array): Array<{ name: string; size: number }> {
  let cursor = 0;
  while (cursor + 4 <= zip.length && u32(zip, cursor) === 0x04034b50) {
    const nameLen = u16(zip, cursor + 26);
    const extraLen = u16(zip, cursor + 28);
    const size = u32(zip, cursor + 18);
    cursor += 30 + nameLen + extraLen + size;
  }
  const entries: Array<{ name: string; size: number }> = [];
  while (cursor + 46 <= zip.length && u32(zip, cursor) === 0x02014b50) {
    const compressed = u32(zip, cursor + 20);
    const size = u32(zip, cursor + 24);
    const nameLen = u16(zip, cursor + 28);
    const extraLen = u16(zip, cursor + 30);
    const commentLen = u16(zip, cursor + 32);
    const localOffset = u32(zip, cursor + 42);
    const name = new TextDecoder().decode(zip.subarray(cursor + 46, cursor + 46 + nameLen));
    expect(compressed).toBe(size);
    expect(u32(zip, localOffset)).toBe(0x04034b50);
    expect(u32(zip, localOffset + 22)).toBe(size);
    entries.push({ name, size });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  expect(u32(zip, cursor)).toBe(0x06054b50);
  expect(u16(zip, cursor + 10)).toBe(entries.length);
  return entries;
}

describe('zipStore', () => {
  it('roundtrips files including names with spaces and an en-dash', () => {
    const original = [
      { name: 'holobox-package.json', data: new TextEncoder().encode('{"module":"logopedie"}') },
      {
        name: 'media/verpleegkunde/Staat is pijn.mp4',
        data: new Uint8Array([1, 2, 3, 4, 5]),
      },
      {
        name: 'media/verpleegkunde/Staat is Mogelijk bedreigde luchtweg – A (Airway).mp4',
        data: new Uint8Array([9, 8, 7]),
      },
    ];
    const zipped = zipStore(original);
    expect(zipped[0]).toBe(0x50);
    expect(centralDirectory(zipped).map((item) => item.name)).toEqual(
      original.map((item) => item.name),
    );
    expect(centralDirectory(zipped).map((item) => item.size)).toEqual(
      original.map((item) => item.data.length),
    );
    const unpacked = unzipStore(zipped);
    expect(unpacked.map((item) => item.name)).toEqual(original.map((item) => item.name));
    expect([...unpacked[1]!.data]).toEqual([1, 2, 3, 4, 5]);
    expect([...unpacked[2]!.data]).toEqual([9, 8, 7]);
    expect(crc32(original[1]!.data)).toBe(crc32(unpacked[1]!.data));
  });
});
