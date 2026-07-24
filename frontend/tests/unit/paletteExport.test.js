import {
  hexToRgb,
  rgbToHsb,
  buildGplPalette,
  buildAsePalette,
  buildProcreateSwatches,
  buildZipStore,
  crc32,
  PROCREATE_MAX_SWATCHES,
} from '../../src/utils/paletteExport';

const PALETTE = [
  { name: 'Coral', hex: '#FF6B63' },
  { name: 'Deep Blue', hex: '#1A2B8F' },
];

describe('paletteExport', () => {
  describe('hexToRgb', () => {
    it('parses 6-digit hex colors', () => {
      expect(hexToRgb('#FF6B63')).toEqual({ r: 255, g: 107, b: 99 });
    });

    it('parses 3-digit and lowercase hex colors', () => {
      expect(hexToRgb('#0af')).toEqual({ r: 0, g: 170, b: 255 });
      expect(hexToRgb('ff6b63')).toEqual({ r: 255, g: 107, b: 99 });
    });
  });

  describe('rgbToHsb', () => {
    it('converts primary and achromatic colors', () => {
      expect(rgbToHsb({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, b: 1 });
      expect(rgbToHsb({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, b: 1 });
      expect(rgbToHsb({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, b: 0 });
    });

    it('converts a mixed color to normalized [0,1] components', () => {
      const { h, s, b } = rgbToHsb({ r: 0, g: 128, b: 255 });
      expect(h).toBeCloseTo(0.583, 2); // ~210°
      expect(s).toBeCloseTo(1, 5);
      expect(b).toBeCloseTo(1, 5);
    });
  });

  describe('buildGplPalette', () => {
    it('writes the GIMP header and one aligned RGB line per color', () => {
      const gpl = buildGplPalette('My Palette', PALETTE);
      expect(gpl).toBe(
        'GIMP Palette\n' +
          'Name: My Palette\n' +
          'Columns: 0\n' +
          '#\n' +
          '255 107  99\tCoral\n' +
          ' 26  43 143\tDeep Blue\n',
      );
    });

    it('falls back to the hex code when a color has no name', () => {
      const gpl = buildGplPalette('P', [{ name: '', hex: '#000000' }]);
      expect(gpl).toContain('  0   0   0\t#000000');
    });
  });

  describe('buildAsePalette', () => {
    it('produces a parseable ASEF file with one RGB block per color', () => {
      const bytes = buildAsePalette(PALETTE);
      const view = new DataView(bytes.buffer);

      // Header: "ASEF", version 1.0, block count.
      expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('ASEF');
      expect(view.getUint16(4)).toBe(1);
      expect(view.getUint16(6)).toBe(0);
      expect(view.getUint32(8)).toBe(2);

      // First block: color entry with the UTF-16BE name then "RGB " floats.
      let offset = 12;
      expect(view.getUint16(offset)).toBe(0x0001);
      const blockLength = view.getUint32(offset + 2);
      const nameUnits = view.getUint16(offset + 6);
      expect(nameUnits).toBe('Coral'.length + 1);
      let name = '';
      for (let i = 0; i < nameUnits - 1; i += 1) {
        name += String.fromCharCode(view.getUint16(offset + 8 + i * 2));
      }
      expect(name).toBe('Coral');

      const modelOffset = offset + 8 + nameUnits * 2;
      const model = String.fromCharCode(
        bytes[modelOffset],
        bytes[modelOffset + 1],
        bytes[modelOffset + 2],
        bytes[modelOffset + 3],
      );
      expect(model).toBe('RGB ');
      expect(view.getFloat32(modelOffset + 4)).toBeCloseTo(255 / 255, 5);
      expect(view.getFloat32(modelOffset + 8)).toBeCloseTo(107 / 255, 5);
      expect(view.getFloat32(modelOffset + 12)).toBeCloseTo(99 / 255, 5);
      expect(view.getUint16(modelOffset + 16)).toBe(0x0002); // "normal" color type

      // The declared block length must land exactly on the next block.
      const secondBlockOffset = offset + 6 + blockLength;
      expect(view.getUint16(secondBlockOffset)).toBe(0x0001);
    });
  });

  describe('crc32', () => {
    it('matches the reference IEEE value', () => {
      // Well-known test vector: crc32("123456789") = 0xCBF43926.
      const bytes = new TextEncoder().encode('123456789');
      expect(crc32(bytes)).toBe(0xcbf43926);
    });
  });

  describe('buildZipStore', () => {
    it('writes a STORE-only archive with matching local and central records', () => {
      const zip = buildZipStore([{ name: 'Swatches.json', data: '[]' }]);
      const view = new DataView(zip.buffer);

      // Local file header at 0, then the name, then the raw (stored) data.
      expect(view.getUint32(0, true)).toBe(0x04034b50);
      expect(view.getUint16(8, true)).toBe(0); // method STORE
      const nameLength = view.getUint16(26, true);
      expect(nameLength).toBe('Swatches.json'.length);
      const data = new TextDecoder().decode(zip.slice(30 + nameLength, 30 + nameLength + 2));
      expect(data).toBe('[]');

      // End-of-central-directory: one entry, central directory right after the data.
      const endOffset = zip.length - 22;
      expect(view.getUint32(endOffset, true)).toBe(0x06054b50);
      expect(view.getUint16(endOffset + 10, true)).toBe(1);
      const centralOffset = view.getUint32(endOffset + 16, true);
      expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
      expect(view.getUint32(centralOffset + 16, true)).toBe(crc32(new TextEncoder().encode('[]')));
    });
  });

  describe('buildProcreateSwatches', () => {
    // Extracts Swatches.json back out of the STORE-only archive.
    const readSwatchesJson = (zip) => {
      const view = new DataView(zip.buffer);
      const nameLength = view.getUint16(26, true);
      const dataLength = view.getUint32(18, true);
      const start = 30 + nameLength;
      return JSON.parse(new TextDecoder().decode(zip.slice(start, start + dataLength)));
    };

    it('wraps the palette as HSB swatches in a zipped Swatches.json', () => {
      const zip = buildProcreateSwatches('My Palette', [{ name: 'Red', hex: '#FF0000' }]);
      const payload = readSwatchesJson(zip);

      expect(payload).toEqual([
        {
          name: 'My Palette',
          swatches: [{ hue: 0, saturation: 1, brightness: 1, alpha: 1, colorSpace: 0 }],
        },
      ]);
    });

    it("caps the export at Procreate's 30-slot grid", () => {
      const colors = Array.from({ length: 40 }, (_, i) => ({
        name: `Color ${i}`,
        hex: '#112233',
      }));
      const payload = readSwatchesJson(buildProcreateSwatches('Big', colors));
      expect(payload[0].swatches).toHaveLength(PROCREATE_MAX_SWATCHES);
    });
  });
});
