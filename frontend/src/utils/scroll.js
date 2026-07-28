// Scrolls the window to the top, honoring the user's reduced-motion
// preference. Used by the logo links (PublicTopBar/PublicFooter): clicking
// "home" while already on that page is a same-URL click, so react-router
// never re-navigates or scrolls — this is what actually moves the viewport.
export default function scrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
