/**
 * Palette importers — the exact mirror of the exporters in paletteExport.js.
 * The round-trip against our own builders IS the contract: whatever FrameSet
 * exports, FrameSet re-imports identically. Malformed input must fail with a
 * clear error, never crash or hang.
 */
import { describe, it, expect } from 'vitest';
import {
  buildGplPalette,
  buildAsePalette,
  buildProcreateSwatches,
} from '../../src/utils/paletteExport';
import {
  parseGplPalette,
  parseAsePalette,
  parseProcreateSwatches,
  parsePaletteFile,
  MAX_IMPORT_FILE_BYTES,
} from '../../src/utils/paletteImport';

const PALETTE = [
  { name: 'Signal Red', hex: '#FF0000' },
  { name: 'Mid Gray', hex: '#808080' },
  { name: 'Coral', hex: '#FF6B63' },
  { name: 'Ink', hex: '#000000' },
];

describe('parseGplPalette', () => {
  it('round-trips a palette exported by buildGplPalette', () => {
    const text = buildGplPalette('My palette', PALETTE);
    const { colors, skipped } = parseGplPalette(text);
    expect(colors).toEqual(PALETTE);
    expect(skipped).toBe(0);
  });

  it('skips malformed lines but keeps the valid ones', () => {
    const text = 'GIMP Palette\nName: X\n#\n255 0 0\tRed\n999 0 0\tBroken\nnot a line\n';
    const { colors, skipped } = parseGplPalette(text);
    expect(colors).toEqual([{ name: 'Red', hex: '#FF0000' }]);
    expect(skipped).toBe(2);
  });

  it('rejects text that is not a GIMP palette', () => {
    expect(() => parseGplPalette('{"not": "a palette"}')).toThrow(/not a gimp palette/i);
  });
});

describe('parseAsePalette', () => {
  it('round-trips a palette exported by buildAsePalette', () => {
    const bytes = buildAsePalette(PALETTE);
    const { colors, skipped } = parseAsePalette(bytes);
    expect(colors).toEqual(PALETTE);
    expect(skipped).toBe(0);
  });

  it('rejects bytes without the ASEF signature', () => {
    expect(() => parseAsePalette(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(
      /not an adobe swatch/i,
    );
  });

  it('counts non-RGB color entries as skipped instead of failing the import', () => {
    // Hand-build a one-block file whose color model is CMYK.
    const name = 'C';
    const blockBodySize = 2 + (name.length + 1) * 2 + 4 + 16 + 2;
    const file = new DataView(new ArrayBuffer(12 + 6 + blockBodySize));
    new Uint8Array(file.buffer).set([0x41, 0x53, 0x45, 0x46], 0); // "ASEF"
    file.setUint16(4, 1);
    file.setUint32(8, 1); // one block
    let o = 12;
    file.setUint16(o, 0x0001); // color entry
    file.setUint32(o + 2, blockBodySize);
    file.setUint16(o + 6, name.length + 1);
    file.setUint16(o + 8, name.charCodeAt(0));
    o += 10 + 2; // name + terminator
    for (const char of 'CMYK') {
      file.setUint8(o, char.charCodeAt(0));
      o += 1;
    }

    const { colors, skipped } = parseAsePalette(new Uint8Array(file.buffer));
    expect(colors).toEqual([]);
    expect(skipped).toBe(1);
  });
});

describe('parseProcreateSwatches', () => {
  it('round-trips a palette exported by buildProcreateSwatches', async () => {
    const bytes = buildProcreateSwatches('My palette', PALETTE);
    const { colors, skipped } = await parseProcreateSwatches(bytes);
    // Procreate stores no names, only HSB values.
    expect(colors.map((c) => c.hex)).toEqual(PALETTE.map((c) => c.hex));
    expect(colors.every((c) => c.name === '')).toBe(true);
    expect(skipped).toBe(0);
  });

  it('ignores the null padding entries real Procreate files contain', async () => {
    const payload = JSON.stringify([
      {
        name: 'Padded',
        swatches: [{ hue: 0, saturation: 1, brightness: 1, alpha: 1, colorSpace: 0 }, null, null],
      },
    ]);
    // Reuse the exporter's own STORE zip via a single-color build, then swap
    // is not possible — build the zip through the public builder instead.
    const { buildZipStore } = await import('../../src/utils/paletteExport');
    const bytes = buildZipStore([{ name: 'Swatches.json', data: payload }]);

    const { colors, skipped } = await parseProcreateSwatches(bytes);
    expect(colors).toEqual([{ name: '', hex: '#FF0000' }]);
    expect(skipped).toBe(0);
  });

  it('rejects an archive with no Swatches.json', async () => {
    const { buildZipStore } = await import('../../src/utils/paletteExport');
    const bytes = buildZipStore([{ name: 'other.txt', data: 'nope' }]);
    await expect(parseProcreateSwatches(bytes)).rejects.toThrow(/not a procreate/i);
  });
});

describe('parsePaletteFile', () => {
  const makeFile = (name, data) => new File([data], name);

  it('dispatches on the file extension', async () => {
    const gpl = await parsePaletteFile(makeFile('x.gpl', buildGplPalette('X', PALETTE)));
    expect(gpl.colors).toEqual(PALETTE);

    const ase = await parsePaletteFile(makeFile('x.ase', buildAsePalette(PALETTE)));
    expect(ase.colors).toEqual(PALETTE);

    const swatches = await parsePaletteFile(
      makeFile('x.swatches', buildProcreateSwatches('X', PALETTE)),
    );
    expect(swatches.colors.map((c) => c.hex)).toEqual(PALETTE.map((c) => c.hex));
  });

  it('rejects unsupported extensions with a clear message', async () => {
    await expect(parsePaletteFile(makeFile('x.png', 'data'))).rejects.toThrow(/\.ase, \.gpl/i);
  });

  it('rejects files above the size cap before reading them', async () => {
    const big = new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], 'x.gpl');
    await expect(parsePaletteFile(big)).rejects.toThrow(/too large/i);
  });
});
