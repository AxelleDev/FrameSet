import { extractColorsFromImage } from '../../src/utils/extractColors';

// extractColorsFromImage relies on the browser canvas + Image APIs, which jsdom
// does not implement. We stub them to feed known pixels and assert the
// quantization output deterministically.
describe('extractColorsFromImage', () => {
  const setup = (pixels, { width = 2, height = 2 } = {}) => {
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: Uint8ClampedArray.from(pixels) })),
    };
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) =>
      tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx } : realCreateElement(tag),
    );

    global.Image = class {
      constructor() {
        this.width = width;
        this.height = height;
      }
      set src(_value) {
        if (this.onload) this.onload();
      }
    };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts a solid dominant color', async () => {
    const pixels = [];
    for (let i = 0; i < 4; i++) pixels.push(255, 0, 0, 255);
    setup(pixels);
    const colors = await extractColorsFromImage(new Blob(['x']));
    expect(colors).toContain('#FF0000');
  });

  it('ignores transparent pixels', async () => {
    // 2 opaque reds + 2 fully transparent greens.
    const pixels = [255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 0, 0, 255, 0, 0];
    setup(pixels);
    const colors = await extractColorsFromImage(new Blob(['x']));
    expect(colors).toEqual(['#FF0000']);
  });

  it('limits the number of colors returned', async () => {
    const pixels = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255];
    setup(pixels);
    const colors = await extractColorsFromImage(new Blob(['x']), 2);
    expect(colors.length).toBeLessThanOrEqual(2);
  });
});
