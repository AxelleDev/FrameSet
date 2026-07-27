// Applies the saved/preferred theme before paint to avoid a flash of the wrong
// theme. Kept as an external file (not inline) so a strict CSP
// `script-src 'self'` applies without a hash or 'unsafe-inline'.
(function () {
  try {
    var t = localStorage.getItem('frameset-theme');
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      // Title-bar color to match before paint too (the meta defaults to the
      // light value; useTheme keeps it updated after mount).
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', '#16171E');
    }
  } catch (e) { /* ignore */ }
})();
