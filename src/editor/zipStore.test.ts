import { describe, expect, it } from 'vitest';
import { crc32, unzipStore, zipStore } from './zipStore';

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
    const unpacked = unzipStore(zipped);
    expect(unpacked.map((item) => item.name)).toEqual(original.map((item) => item.name));
    expect([...unpacked[1]!.data]).toEqual([1, 2, 3, 4, 5]);
    expect([...unpacked[2]!.data]).toEqual([9, 8, 7]);
    expect(crc32(original[1]!.data)).toBe(crc32(unpacked[1]!.data));
  });
});
