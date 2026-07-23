// Public shared reference sheet (/s/:token): read-only view of a project's
// palette, typography and brush standards for anyone holding the link — no
// account needed. Fetched from the public share endpoint; a revoked or unknown
// token shows a friendly "link inactive" state.
//
// Visual parity: every section below reuses the exact swatch/card look of the
// authenticated ProjectPalette and ProjectNorms pages (same shapes, radii,
// badges and typography), so a shared link and the in-app editor never look
// like two different products.
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Card from '../components/Card';
import Seo from '../components/Seo';
import Logo from '../components/Logo';
import PublicTopBar from '../components/PublicTopBar';
import Button from '../components/Button';
import ColorTile from '../components/ColorTile';
import StandardCard from '../components/StandardCard';
import BrushPreview from '../components/BrushPreview';
import TypographyPreview from '../components/TypographyPreview';
import useClipboard from '../hooks/useClipboard';
import useNormFontLoader from '../hooks/useNormFontLoader';

export default function SharedProject() {
  const { token } = useParams();
  const [sheet, setSheet] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'not-found' | 'error'
  const { copy, copiedValue } = useClipboard({ timeout: 1200 });

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    api
      .get(`/share/${token}`, { skipTokenRefresh: true })
      .then((data) => {
        if (cancelled) return;
        setSheet(data);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(error?.status === 404 ? 'not-found' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const palette = sheet?.palette || [];
  const typographyNorms = sheet?.typographyNorms || [];
  const brushNorms = sheet?.brushNorms || [];
  const isEmpty = palette.length === 0 && typographyNorms.length === 0 && brushNorms.length === 0;

  // Same font-loading dance as the in-app norms editor: the "AaBbCc" specimen
  // only swaps in once the family has actually finished loading.
  const loadedFonts = useNormFontLoader(typographyNorms);

  return (
    <div className="min-h-dvh bg-canvas text-primary">
      {/* Tokens are private links: keep them out of search engines. */}
      <Seo
        title={sheet ? `${sheet.name} — shared reference` : 'Shared reference'}
        path={`/s/${token}`}
        noindex
      />
      <PublicTopBar />

      <main className="max-w-5xl mx-auto px-6 pb-16">
        {status === 'loading' && (
          <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite">
            <div className="border-4 border-blue/20 border-t-blue rounded-full w-10 h-10 animate-spin"></div>
          </div>
        )}

        {(status === 'not-found' || status === 'error') && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
            <Logo className="w-20 h-auto mb-8" />
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
            <header className="pt-6 pb-10 sm:pt-10 sm:pb-14">
              <p className="text-xs uppercase tracking-widest text-blue font-semibold mb-3">
                Shared reference sheet
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight break-words">
                {sheet.name}
              </h1>
              {sheet.ownerName && (
                <p className="mt-3 text-sm text-primary/60">Made by {sheet.ownerName}</p>
              )}
            </header>

            {isEmpty && (
              <Card className="p-8 text-center">
                <p className="text-sm text-primary/60">This reference sheet is empty for now.</p>
              </Card>
            )}

            <div className="space-y-14">
              {/* Color palette: the exact same ColorTile as ProjectPalette's own
                  swatches (square, rounded-3xl, name/hex centered below). */}
              {palette.length > 0 && (
                <section aria-labelledby="shared-palette-title">
                  <h2 id="shared-palette-title" className="text-xl font-medium text-primary mb-6">Color palette</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                    {palette.map((color) => (
                      <ColorTile
                        key={color.id}
                        hex={color.hex}
                        name={color.name}
                        onCopy={() => copy(color.hex)}
                        copied={copiedValue === color.hex}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Typography + brush standards: the exact same StandardCard as
                  ProjectNorms, so a shared link reads like the editor. */}
              {(typographyNorms.length > 0 || brushNorms.length > 0) && (
                <section aria-labelledby="shared-standards-title">
                  <h2 id="shared-standards-title" className="text-xl font-medium text-primary mb-6">Graphic standards</h2>
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
                            Opacity: {typeof norm.opacity === 'number' ? norm.opacity : (norm.opacity ?? '—')}
                          </div>
                        }
                        preview={<BrushPreview value={norm.value} opacity={norm.opacity} brushName={norm.brushName} />}
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
                        detail={norm.fontStyle && (
                          <div className="mb-2">
                            <span className="text-xs text-primary italic">{norm.fontStyle}</span>
                          </div>
                        )}
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

            <footer className="mt-16 pt-8 border-t border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link to="/" aria-label="Discover FrameSet" className="inline-flex rounded-lg transition-opacity hover:opacity-80 focus-ring w-16">
                <Logo className="object-contain w-full h-auto" />
              </Link>
              <div className="flex items-center gap-3">
                <p className="text-xs text-primary/60">Made with FrameSet — the graphic reference for your projects.</p>
                <Button to="/register" variant="primary" className="text-sm">
                  Create your own
                </Button>
              </div>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
