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

module.exports = { getFonts };
