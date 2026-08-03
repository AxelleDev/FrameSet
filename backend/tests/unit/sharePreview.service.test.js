/**
 * The social-preview renderer: SVG composition rules (escaping, truncation,
 * overflow tile, near-white borders, empty fallback) and the real PNG
 * rasterization through resvg with the bundled Figtree faces.
 */
const {
  buildSharePreviewSvg,
  getSharePreviewPngByToken,
} = require('../../src/services/sharePreview.service');
const db = require('../../src/database');

jest.mock('../../src/database');

const baseProject = {
  name: 'Alyse — Twitch émotes',
  ownerName: 'Axelle',
  palette: [
    { id: 1, name: 'Ink', hex: '#2E2836' },
    { id: 2, name: 'Periwinkle', hex: '#8994DF' },
  ],
  brushNorms: [{}, {}],
  typographyNorms: [{}],
};

describe('sharePreview service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('buildSharePreviewSvg', () => {
    it('draws every palette swatch with its uppercase hex label and the meta line', () => {
      const svg = buildSharePreviewSvg(baseProject);

      expect(svg).toContain('fill="#2E2836"');
      expect(svg).toContain('fill="#8994DF"');
      expect(svg).toContain('>#2E2836</text>');
      expect(svg).toContain('by Axelle  ·  2 colors  ·  3 specs');
    });

    it('escapes markup in the project and owner names (no SVG injection)', () => {
      const svg = buildSharePreviewSvg({
        ...baseProject,
        name: '<script>"pouet"</script>',
        ownerName: "O'Brien & Co",
      });

      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
      expect(svg).toContain('O&apos;Brien &amp; Co');
    });

    it('collapses palettes beyond eight swatches into a "+N" tile', () => {
      const palette = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        hex: `#${String(100000 + i * 1111).slice(0, 6)}`,
      }));
      const svg = buildSharePreviewSvg({ ...baseProject, palette });

      expect(svg).toContain('>+43</text>');
      // 7 real swatches + the overflow tile (the background rect has no x).
      expect(svg.match(/<rect x/g).length).toBe(8);
    });

    it('gives near-white swatches a hairline border so they stay visible', () => {
      const svg = buildSharePreviewSvg({
        ...baseProject,
        palette: [
          { id: 1, hex: '#FFFFFF' },
          { id: 2, hex: '#111111' },
        ],
      });

      const white = svg.split('\n').find((line) => line.includes('fill="#FFFFFF"'));
      const dark = svg.split('\n').find((line) => line.includes('fill="#111111"'));
      expect(white).toContain('stroke=');
      expect(dark).not.toContain('stroke=');
    });

    it('falls back to a brand panel when the palette is empty, and drops the zero counts', () => {
      const svg = buildSharePreviewSvg({
        ...baseProject,
        palette: [],
        brushNorms: [],
        typographyNorms: [],
      });

      expect(svg).toContain('A graphic reference sheet');
      expect(svg).not.toContain('0 colors');
      expect(svg).not.toContain('0 specs');
    });

    it('truncates very long names with an ellipsis', () => {
      const svg = buildSharePreviewSvg({
        ...baseProject,
        name: 'Un projet avec un nom vraiment interminable qui ne rentre pas',
      });

      expect(svg).toContain('…');
      expect(svg).not.toContain('interminable qui ne rentre pas');
    });
  });

  describe('getSharePreviewPngByToken', () => {
    it('renders a real PNG for a valid token', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 7, name: 'Alyse', owner_name: 'Axelle' }]])
        .mockResolvedValueOnce([[]]) // brush norms
        .mockResolvedValueOnce([[]]) // typography norms
        .mockResolvedValueOnce([[{ id: 1, name: 'Ink', hex: '#2E2836' }]]);

      const png = await getSharePreviewPngByToken('aa11bb22cc33dd44ee55ff6677889900');

      // PNG magic bytes: \x89PNG
      expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      expect(png.length).toBeGreaterThan(1000);
    });

    it("propagates the share lookup's not_found untouched", async () => {
      db.query.mockResolvedValueOnce([[]]);

      await expect(
        getSharePreviewPngByToken('aa11bb22cc33dd44ee55ff6677889900'),
      ).rejects.toMatchObject({ code: 'not_found' });
    });
  });
});
