// Applique le thème sauvegardé/préféré avant le paint pour éviter un flash du
// mauvais thème. Fichier externe (et non inline) afin qu'une CSP stricte
// `script-src 'self'` s'applique sans hash ni 'unsafe-inline'.
(function () {
  try {
    var t = localStorage.getItem('frameset-theme');
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) { /* ignore */ }
})();
