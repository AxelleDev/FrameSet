export function loadGoogleFont(family, weight = '400') {
  if (!family) return;
  const familyParam = encodeURIComponent(family.trim());
  const weightParam = String(weight).replace(/[^0-9]/g, '') || '400';
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weightParam}&display=swap`;
  // Skip if this exact stylesheet has already been injected.
  if (document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
