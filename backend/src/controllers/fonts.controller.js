/**
 * Contrôleur du proxy Google Fonts : renvoie le catalogue (récupéré côté
 * serveur) pour que la clé API ne soit jamais présente dans le client.
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
