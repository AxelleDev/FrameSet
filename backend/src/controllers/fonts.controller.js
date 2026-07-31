/**
 * Google Fonts proxy controller: returns the catalog (fetched server-side) so
 * the API key is never present in the client.
 */

const fontsService = require('../services/fonts.service');
const { createControllerLogger } = require('../utils/auth.utils');

const logFontsError = createControllerLogger('fonts');

const getFonts = async (req, res) => {
  try {
    const items = await fontsService.getGoogleFontsCatalog();
    res.json({ items });
  } catch (error) {
    logFontsError(req, 'catalog', error);
    res.status(502).json({ error: 'Could not load the font catalog.' });
  }
};

// Download URLs for one family (used by the PDF export to embed the real
// face in a typography specimen). 404 covers unknown families, junk input
// and the no-key setup alike — the caller just falls back to the app font.
const getFontFiles = async (req, res) => {
  try {
    const files = await fontsService.getGoogleFontFiles(req.query.family);
    if (!files) {
      return res.status(404).json({ error: 'Unknown font family.' });
    }
    res.json({ files });
  } catch (error) {
    logFontsError(req, 'files', error);
    res.status(502).json({ error: 'Could not load the font files.' });
  }
};

module.exports = { getFonts, getFontFiles };
