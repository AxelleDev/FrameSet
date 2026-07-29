// iOS Safari doesn't apply :active (and CSS relying on it, like the
// press-and-hold reveal on card actions — see ActionIconButton/ColorTile)
// on a plain tap unless some element in the document has a touchstart
// listener. A no-op listener on the whole page is the standard fix. Kept as
// an external file (not inline) so a strict CSP `script-src 'self'` applies
// without a hash or 'unsafe-inline'.
// `passive: true` keeps the no-op listener from ever delaying scroll.
document.addEventListener('touchstart', function () {}, { passive: true });
