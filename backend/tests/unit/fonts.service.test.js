const fontsService = require('../../src/services/fonts.service');

describe('fonts service (Google Fonts proxy)', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GOOGLE_FONTS_API_KEY;
    fontsService.resetCatalogCache();
  });

  it('returns an empty catalog when no API key is configured', async () => {
    delete process.env.GOOGLE_FONTS_API_KEY;
    await expect(fontsService.getGoogleFontsCatalog()).resolves.toEqual([]);
  });

  it('fetches the catalog and caches it (no refetch on the second call)', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ family: 'Roboto', variants: ['regular'] }] })
    });

    const items = await fontsService.getGoogleFontsCatalog();
    expect(items).toEqual([{ family: 'Roboto', variants: ['regular'] }]);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await fontsService.getGoogleFontsCatalog();
    expect(global.fetch).toHaveBeenCalledTimes(1); // served from cache
  });

  it('throws when the Google API responds with an error status', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(fontsService.getGoogleFontsCatalog()).rejects.toThrow(/429/);
  });
});
