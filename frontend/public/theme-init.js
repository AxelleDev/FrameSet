// Applies the saved/preferred theme before paint to avoid a flash of the wrong
// theme. Kept as an external file (not inline) so a strict CSP
// `script-src 'self'` applies without a hash or 'unsafe-inline'.
(function () {
  try {
    var t = localStorage.getItem('frameset-theme');
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) { /* ignore */ }
})();
