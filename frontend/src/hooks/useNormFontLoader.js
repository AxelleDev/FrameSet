// Loads each typography norm's Google Font so its preview renders in the real
// typeface. Returns the list of families whose font has finished loading.
//
// Correctness notes:
// - Depends on `googleFonts` so it re-runs when the catalog arrives; a weight
//   resolved against an empty catalog (fallback 400) is then corrected.
// - Dedupes by `family@weight`, not by family alone, so a corrected weight can
//   still load (and a family isn't blocked forever after a wrong first resolve).
// - A `cancelled` flag prevents a state update after unmount (the observer waits
//   up to 5s).
import { useEffect, useRef, useState } from 'react';
import FontFaceObserver from 'fontfaceobserver';
import { loadGoogleFont } from '../utils/loadGoogleFont';

// Resolve the weight to actually request: the norm's weight if the catalog offers
// it, else the first available weight, else 400. Returns { fontWeight, availableWeights }.
function resolveFontWeight(norm, googleFonts) {
  const fontMeta = (googleFonts || []).find((f) => f.family === norm.fontFamily);
  let fontWeight = norm.fontWeight || '400';
  let availableWeights = [];
  if (fontMeta && fontMeta.variants) {
    // Numeric weights from variant labels (e.g. 'regular', '700italic'), deduped.
    availableWeights = fontMeta.variants
      .map((v) => v.replace(/[^0-9]/g, '') || '400')
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }
  if (availableWeights.length === 0) {
    fontWeight = '400';
  } else if (!availableWeights.includes(fontWeight)) {
    fontWeight = availableWeights[0] || '400';
  }
  return { fontWeight, availableWeights };
}

export default function useNormFontLoader(typographyNorms, googleFonts) {
  const [loadedFonts, setLoadedFonts] = useState([]);
  // `${family}@${weight}` -> true, so each family/weight pair is requested once.
  const requestedRef = useRef({});

  useEffect(() => {
    if (!typographyNorms) return undefined;
    let cancelled = false;

    typographyNorms.forEach(async (norm) => {
      if (!norm.fontFamily) return;

      const { fontWeight, availableWeights } = resolveFontWeight(norm, googleFonts);
      const key = `${norm.fontFamily}@${fontWeight}`;
      if (requestedRef.current[key]) return;
      requestedRef.current[key] = true;

      try {
        // Inject the stylesheet; loadGoogleFont may return a promise to await.
        const maybePromise = loadGoogleFont(norm.fontFamily, fontWeight);
        if (maybePromise && typeof maybePromise.then === 'function') {
          await maybePromise;
        }
        // Wait until the font is usable. Omit the weight option when none resolved
        // so FontFaceObserver does not over-constrain.
        const fontObserverOpts = availableWeights.length > 0 ? { weight: fontWeight } : {};
        const font = new FontFaceObserver(norm.fontFamily, fontObserverOpts);
        await font.load(null, 5000); // give up after 5s
      } catch (e) {
        // On timeout/failure, still mark loaded so the UI stops waiting (the
        // preview falls back to the system font).
      }

      if (!cancelled) {
        setLoadedFonts((prev) => (prev.includes(norm.fontFamily) ? prev : [...prev, norm.fontFamily]));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [typographyNorms, googleFonts]);

  return loadedFonts;
}
