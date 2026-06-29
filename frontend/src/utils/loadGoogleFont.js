/**
 * Dynamically injects a Google Fonts stylesheet <link> for a given family and
 * weight so the font can be used to preview typography norms.
 *
 * The font name is URL-encoded (spaces become '+') and we de-duplicate by
 * checking for an existing <link> with the same href, so calling this repeatedly
 * for the same font is a no-op. `display=swap` avoids invisible text while the
 * font loads.
 *
 * @param {string} family Google Font family name (e.g. "Roboto").
 * @param {string} [weight] Numeric font weight to request (default "400").
 */
export function loadGoogleFont(family, weight = "400") {
  if (!family) return;
  const familyParam = family.replace(/ /g, "+");
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&display=swap`;
  // Skip if this exact stylesheet has already been injected.
  if (document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}
