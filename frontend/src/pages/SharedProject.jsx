// Public shared reference sheet (/s/:token): read-only view of a project's
// palette, typography and brush standards for anyone holding the link — no
// account needed. Fetched from the public share endpoint; a revoked or unknown
// token shows a friendly "link inactive" state.
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Seo from '../components/Seo';
import Logo from '../components/Logo';
import PublicTopBar from '../components/PublicTopBar';
import Button from '../components/Button';
import CopyBadge from '../components/CopyBadge';
import useClipboard from '../hooks/useClipboard';
import { loadGoogleFont } from '../utils/loadGoogleFont';

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

  // Load each typography family so names render in their own typeface.
  useEffect(() => {
    (sheet?.typographyNorms || []).forEach((norm) => {
      loadGoogleFont(norm.fontFamily, norm.fontWeight || '400');
    });
  }, [sheet]);

  const palette = sheet?.palette || [];
  const typographyNorms = sheet?.typographyNorms || [];
  const brushNorms = sheet?.brushNorms || [];
  const isEmpty = palette.length === 0 && typographyNorms.length === 0 && brushNorms.length === 0;

  return (
    <div className="min-h-dvh bg-canvas text-primary">
      {/* Tokens are private links: keep them out of search engines. */}
      <Seo title={sheet ? `${sheet.name} — shared reference` : 'Shared reference'} noindex />
      <PublicTopBar />

      <main className="max-w-4xl mx-auto px-6 pb-16">
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
            </header>

            {isEmpty && (
              <Card className="p-8 text-center">
                <p className="text-sm text-primary/60">This reference sheet is empty for now.</p>
              </Card>
            )}

            <div className="space-y-12">
              {palette.length > 0 && (
                <section aria-labelledby="shared-palette-title">
                  <h2 id="shared-palette-title" className="text-lg font-medium mb-4">Color palette</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {palette.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => copy(color.hex)}
                        title={`Copy ${color.hex}`}
                        className="group text-left rounded-2xl overflow-hidden bg-surface focus-ring"
                      >
                        <div
                          className="h-24 w-full flex items-end justify-end p-2"
                          style={{ backgroundColor: color.hex }}
                        >
                          <CopyBadge isCopied={copiedValue === color.hex} />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium truncate">{color.name}</p>
                          <p className="text-xs text-primary/60 font-mono uppercase">{color.hex}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {typographyNorms.length > 0 && (
                <section aria-labelledby="shared-typography-title">
                  <h2 id="shared-typography-title" className="text-lg font-medium mb-4">Typography</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {typographyNorms.map((norm) => (
                      <Card key={norm.id} className="p-6">
                        {norm.fontUsage && <Badge color="blue" className="mb-3">{norm.fontUsage}</Badge>}
                        <p
                          className="text-2xl text-primary break-words"
                          style={{ fontFamily: `'${norm.fontFamily}', sans-serif` }}
                        >
                          {norm.fontFamily}
                        </p>
                        <p className="text-xs text-primary/60 mt-2">
                          {[
                            norm.fontWeight ? `Weight ${norm.fontWeight}` : null,
                            norm.fontStyle || null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {brushNorms.length > 0 && (
                <section aria-labelledby="shared-brushes-title">
                  <h2 id="shared-brushes-title" className="text-lg font-medium mb-4">Brush standards</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {brushNorms.map((norm) => (
                      <Card key={norm.id} className="p-6">
                        <p className="text-sm font-medium text-primary mb-1 break-words">{norm.name}</p>
                        <p className="text-2xl font-semibold text-blue">
                          {norm.value}
                          <span className="text-sm font-normal text-primary/60 ml-1">{norm.unit}</span>
                        </p>
                        <p className="text-xs text-primary/60 mt-2">
                          {[
                            norm.brushName ? `Brush: ${norm.brushName}` : null,
                            norm.opacity !== null && norm.opacity !== undefined
                              ? `Opacity: ${norm.opacity}%`
                              : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <footer className="mt-16 pt-8 border-t border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link to="/" aria-label="Discover FrameSet" className="inline-flex rounded-lg transition-opacity hover:opacity-80 focus-ring w-16">
                  <Logo className="object-contain w-full h-auto" />
                </Link>
                <p className="text-xs text-primary/60">Made with FrameSet — the graphic reference for your projects.</p>
              </div>
              <Button to="/register" variant="primary" className="text-sm">
                Create your own
              </Button>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
