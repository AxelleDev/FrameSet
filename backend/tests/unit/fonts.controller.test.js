/**
 * Fonts controller: the thin proxy layer over the Google Fonts catalog service.
 * Success returns { items }; any service failure (network, upstream 5xx,
 * timeout) is a 502 with a generic message — never the upstream error detail.
 */

jest.mock('../../src/services/fonts.service', () => ({
  getGoogleFontsCatalog: jest.fn(),
  getGoogleFontFiles: jest.fn(),
}));

const fontsService = require('../../src/services/fonts.service');
const fontsController = require('../../src/controllers/fonts.controller');

describe('fonts controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the catalog items', async () => {
    const items = [{ family: 'Figtree', variants: ['regular', '700'] }];
    fontsService.getGoogleFontsCatalog.mockResolvedValueOnce(items);

    const req = { id: 'req-1' };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await fontsController.getFonts(req, res);

    expect(res.json).toHaveBeenCalledWith({ items });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 502 with a generic message when the catalog fetch fails', async () => {
    fontsService.getGoogleFontsCatalog.mockRejectedValueOnce(
      new Error('Google Fonts API responded with 500'),
    );

    const req = { id: 'req-2' };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await fontsController.getFonts(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    // The upstream error text must never leak to the client.
    expect(res.json).toHaveBeenCalledWith({ error: 'Could not load the font catalog.' });
  });

  it("returns one family's file URLs", async () => {
    const files = { regular: 'https://fonts.gstatic.com/s/parisienne/x.ttf' };
    fontsService.getGoogleFontFiles.mockResolvedValueOnce(files);

    const req = { id: 'req-3', query: { family: 'Parisienne' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await fontsController.getFontFiles(req, res);

    expect(fontsService.getGoogleFontFiles).toHaveBeenCalledWith('Parisienne');
    expect(res.json).toHaveBeenCalledWith({ files });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown family (service resolves null)', async () => {
    fontsService.getGoogleFontFiles.mockResolvedValueOnce(null);

    const req = { id: 'req-4', query: { family: 'Not A Font' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await fontsController.getFontFiles(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unknown font family.' });
  });

  it('answers 502 with a generic message when the files fetch fails', async () => {
    fontsService.getGoogleFontFiles.mockRejectedValueOnce(
      new Error('Google Fonts API responded with 503'),
    );

    const req = { id: 'req-5', query: { family: 'Parisienne' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await fontsController.getFontFiles(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'Could not load the font files.' });
  });
});
