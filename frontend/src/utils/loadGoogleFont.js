/**
 * Dynamically injects a Google Fonts stylesheet <link> for a given family and
 * weight so the font can be used to preview typography norms.
 *
 * The font name is URL-encoded and the weight coerced to digits, and we
 * de-duplicate by checking for an existing <link> with the same href, so calling
 * this repeatedly for the same font is a no-op. `display=swap` avoids invisible
 * text while the font loads.
 *
 * @param {string} family Google Font family name (e.g. "Roboto").
 * @param {string|number} [weight] Numeric font weight to request (default "400").
 */
export function loadGoogleFont(family, weight = "400") {
  if (!family) return;
  const familyParam = encodeURIComponent(family.trim());
  const weightParam = String(weight).replace(/[^0-9]/g, "") || "400";
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weightParam}&display=swap`;
  // Skip if this exact stylesheet has already been injected.
  if (document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}
