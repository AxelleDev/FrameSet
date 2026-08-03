// Public shared reference sheet (/s/:token): read-only view of a project's
// palette, typography and brush standards for anyone holding the link — no
// account needed. Fetched from the public share endpoint; a revoked or unknown
// token shows a friendly "link inactive" state.
//
// Visual parity: every section below reuses the exact swatch/card look of the
// authenticated ProjectPalette and ProjectNorms pages (same shapes, radii,
// badges and typography), so a shared link and the in-app editor never look
// like two different products.
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import useShareLiveUpdates from '../hooks/useShareLiveUpdates';
import Card from '../components/Card';
import Seo from '../components/Seo';
import PublicTopBar from '../components/PublicTopBar';
import PublicFooter from '../components/PublicFooter';
import Button from '../components/Button';
import ColorTile from '../components/ColorTile';
import StandardCard from '../components/StandardCard';
import BrushPreview from '../components/BrushPreview';
import TypographyPreview from '../components/TypographyPreview';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import useClipboard from '../hooks/useClipboard';
import useNormFontLoader from '../hooks/useNormFontLoader';

export default function SharedProject() {
  const { token } = useParams();
  const [sheet, setSheet] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'not-found' | 'error'
  const { copy, copiedValue } = useClipboard({ timeout: 1200 });

  // One fetch path for the initial load AND the live refreshes: a silent
  // refetch swaps the sheet in place (no loading flash), and a 404 flips the
  // page to "link inactive" — which is exactly what a live revocation does.
  const loadSheet = useCallback(
    (options = {}) => {
      if (!options.silent) setStatus('loading');
      return api
        .get(`/share/${token}`, { skipTokenRefresh: true })
        .then((data) => {
          setSheet(data);
          setStatus('ready');
        })
        .catch((error) => {
          setStatus(error?.status === 404 ? 'not-found' : 'error');
        });
    },
    [token],
  );

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  // Server-sent events: the owner edits, this page refetches — live.
  const isLive = useShareLiveUpdates(token, {
    enabled: status === 'ready',
    onChanged: () => loadSheet({ silent: true }),
  });

  const palette = sheet?.palette || [];
  const typographyNorms = sheet?.typographyNorms || [];
  const brushNorms = sheet?.brushNorms || [];
  const isEmpty = palette.length === 0 && typographyNorms.length === 0 && brushNorms.length === 0;

  // Same font-loading dance as the in-app norms editor: the "AaBbCc" specimen
  // only swaps in once the family has actually finished loading.
  const loadedFonts = useNormFontLoader(typographyNorms);

  return (
    <div className="min-h-dvh bg-canvas text-primary">
      {/* Tokens are private links: keep them out of search engines. The
          og:image mirrors what social crawlers get served (they hit the
          backend embed page via a Vercel rewrite, since they don't run JS). */}
      <Seo
        title={sheet ? `${sheet.name} — shared reference` : 'Shared reference'}
        path={`/s/${token}`}
        image={`${window.location.origin}/api/share/${token}/preview.png`}
        noindex
      />
      <PublicTopBar />

      {/* pt-8 sm:pt-12: the standard breathing room between the sticky top bar
          and page content, shared with LegalPage. */}
      <main className="max-w-6xl mx-auto px-6 pt-8 sm:pt-12">
        {status === 'loading' && (
          <div
            className="min-h-[50vh] flex items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <Spinner size="lg" className="text-blue" />
          </div>
        )}

        {(status === 'not-found' || status === 'error') && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-medium mb-2">
              {status === 'not-found' ? 'This link is no longer active' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-primary/60 max-w-sm mb-8">
              {status === 'not-found'
                ? 'The share link may have been disabled by the project owner, or it never existed.'
                : "We couldn't load this reference sheet. Please try again in a moment."}
            </p>
            <Button to="/">Discover FrameSet</Button>
          </div>
        )}

        {status === 'ready' && sheet && (
          <div className="animate-fade-in">
            <header className="pb-10 sm:pb-14">
              <div className="mb-3 flex items-center gap-3">
                <p className="text-xs uppercase tracking-widest text-blue font-semibold">
                  Shared reference sheet
                </p>
                {isLive && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                    title="This page updates automatically as the owner edits the project."
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"
                      aria-hidden="true"
                    />
                    Live
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight break-words">
                {sheet.name}
              </h1>
              {sheet.ownerName && (
                <p className="mt-3 text-sm text-primary/60">Made by {sheet.ownerName}</p>
              )}
            </header>

            {isEmpty && (
              <Card className="p-8">
                <EmptyState description="This reference sheet is empty for now." />
              </Card>
            )}

            <div className="space-y-14">
              {/* Color palette: the exact same ColorTile as ProjectPalette's own
                  swatches (square, rounded-3xl, name/hex centered below). */}
              {palette.length > 0 && (
                <section aria-labelledby="shared-palette-title">
                  <h2 id="shared-palette-title" className="text-xl font-medium text-primary mb-6">
                    Color palette
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                    {palette.map((color) => (
                      <ColorTile
                        key={color.id}
                        hex={color.hex}
                        name={color.name}
                        onCopy={() => copy(color.hex)}
                        copied={copiedValue === color.hex}
                        onCopyValue={copy}
                        copiedValue={copiedValue}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Typography + brush standards: the exact same StandardCard as
                  ProjectNorms, so a shared link reads like the editor. */}
              {(typographyNorms.length > 0 || brushNorms.length > 0) && (
                <section aria-labelledby="shared-standards-title">
                  <h2 id="shared-standards-title" className="text-xl font-medium text-primary mb-6">
                    Graphic standards
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {brushNorms.map((norm) => (
                      <StandardCard
                        key={`brush-${norm.id}`}
                        category="Brush"
                        badgeColor="primary"
                        title={norm.name}
                        value={norm.value}
                        unit={norm.unit}
                        detail={
                          <div className="text-xs text-secondary mb-2">
                            {/* opacity is a plain 0-1 decimal (not a percentage), same as the editor's own display. */}
                            Opacity:{' '}
                            {typeof norm.opacity === 'number'
                              ? norm.opacity
                              : (norm.opacity ?? '—')}
                          </div>
                        }
                        preview={
                          <BrushPreview
                            value={norm.value}
                            opacity={norm.opacity}
                            brushName={norm.brushName}
                          />
                        }
                      />
                    ))}

                    {typographyNorms.map((norm) => (
                      <StandardCard
                        key={`typo-${norm.id}`}
                        category="Typography"
                        badgeColor="blue"
                        title={norm.fontUsage || norm.fontFamily}
                        value={norm.fontFamily}
                        valueTitle={norm.fontFamily}
                        valueTruncate
                        unit={norm.fontWeight}
                        detail={
                          norm.fontStyle && (
                            <div className="mb-2">
                              <span className="text-xs text-primary italic">{norm.fontStyle}</span>
                            </div>
                          )
                        }
                        preview={
                          <TypographyPreview
                            fontFamily={norm.fontFamily}
                            fontStyle={norm.fontStyle}
                            loaded={loadedFonts.includes(norm.fontFamily)}
                          />
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <footer className="mt-16 pt-8 pb-10 border-t border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-primary/60">
                Made with FrameSet — the graphic reference for your projects.
              </p>
              <Button
                to="/register"
                variant="primary"
                className="text-sm shrink-0 whitespace-nowrap"
              >
                Create your own
              </Button>
            </footer>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
