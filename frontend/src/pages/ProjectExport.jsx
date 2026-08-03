// Project export page (/app/project/:id/export): download the style guide as a
// jsPDF-built PDF or raw JSON (with a live preview), or share a public
// read-only link to the reference sheet.
import React, { useEffect, useMemo, useState } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useParams } from 'react-router-dom';
import Card from '../components/Card';
import IconCircle from '../components/IconCircle';
import PageHeader from '../components/PageHeader';
import Seo from '../components/Seo';
import Button from '../components/Button';
import ProjectStatePlaceholder from '../components/ProjectStatePlaceholder';
import useActiveProject from '../hooks/useActiveProject';
import useClipboard from '../hooks/useClipboard';
import api from '../services/api';
import { buildStyleGuidePdf } from '../utils/pdfStyleGuide';
import {
  buildAsePalette,
  buildGplPalette,
  buildProcreateSwatches,
  PROCREATE_MAX_SWATCHES,
} from '../utils/paletteExport';

// Loads an image (same-origin, e.g. the public logo) as a PNG data URL via an
// offscreen canvas, so it can be embedded in the jsPDF document. Resolves null
// on failure so a broken/slow logo load never blocks the PDF download.
const loadImageDataUrl = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

// The Figtree faces embedded in the style-guide PDF (converted once from the
// site's own font files — see public/fonts/pdf). Loaded only when a PDF is
// actually generated; any failure falls back to helvetica rather than
// blocking the export.
const PDF_FONT_FILES = [
  ['Figtree-Light.ttf', 'light'],
  ['Figtree-Regular.ttf', 'normal'],
  ['Figtree-Medium.ttf', 'medium'],
  ['Figtree-Bold.ttf', 'bold'],
  ['Figtree-Italic.ttf', 'italic'],
];
const bytesToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const loadPdfFonts = async () => {
  try {
    return await Promise.all(
      PDF_FONT_FILES.map(async ([file, style]) => {
        const res = await fetch(`/fonts/pdf/${file}`);
        if (!res.ok) throw new Error(`font ${file}: HTTP ${res.status}`);
        return { vfsName: file, style, base64: bytesToBase64(await res.arrayBuffer()) };
      }),
    );
  } catch {
    return undefined;
  }
};

// Picks the download URL matching a norm's weight/style as closely as the
// family offers, ending on whatever exists (better a slightly-off weight than
// no real face at all).
const pickFontFileUrl = (files, weight, style) => {
  const wantsItalic = /italic/i.test(style || '');
  const w = `${weight || ''}`.trim();
  const candidates = wantsItalic
    ? [w && w !== '400' ? `${w}italic` : 'italic', 'italic', 'regular']
    : [!w || w === '400' ? 'regular' : w, 'regular'];
  const key = candidates.find((candidate) => candidate && files[candidate]);
  const url = key ? files[key] : Object.values(files)[0];
  // Google returns http:// URLs; upgrade so the fetch never mixes content.
  return url ? url.replace(/^http:/, 'https:') : null;
};

// Fetches the real face of each typography norm (the backend's files proxy
// gives the URL, fonts.gstatic.com serves the TTF) so the PDF's AaBbCc
// specimens render in their own fonts, like the site's live previews. Any
// failure just skips that family — the specimen falls back to the app font.
const loadSpecimenFonts = async (typographyNorms) => {
  const families = [...new Set((typographyNorms || []).map((n) => n.fontFamily).filter(Boolean))];
  const entries = await Promise.all(
    families.map(async (family) => {
      try {
        const norm = typographyNorms.find((n) => n.fontFamily === family);
        const { files } = await api.get(`/fonts/files?family=${encodeURIComponent(family)}`);
        const url = pickFontFileUrl(files || {}, norm?.fontWeight, norm?.fontStyle);
        if (!url) return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        return [
          family,
          {
            vfsName: `${family.replace(/[^a-z0-9]/gi, '_')}.ttf`,
            base64: bytesToBase64(await res.arrayBuffer()),
          },
        ];
      } catch {
        return null;
      }
    }),
  );
  const map = Object.fromEntries(entries.filter(Boolean));
  return Object.keys(map).length > 0 ? map : undefined;
};

export default function ProjectExport() {
  const { id } = useParams();
  const {
    activeProject,
    activeProjectNotFound,
    projectsLoading,
    activeProjectId,
    enableSharing,
    disableSharing,
  } = useProjects();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { copy, copiedValue } = useClipboard({ timeout: 1500 });
  const [shareBusy, setShareBusy] = useState(false);

  // Sync the active project with the route id (shared hook).
  useActiveProject(id);

  // Public read-only link for this project (null while sharing is disabled).
  const shareUrl = activeProject?.shareToken
    ? `${window.location.origin}/s/${activeProject.shareToken}`
    : null;

  const handleEnableSharing = async () => {
    if (shareBusy || !activeProject) return;
    setShareBusy(true);
    try {
      const token = await enableSharing(activeProject.id);
      if (token) showToast('Share link created.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleDisableSharing = async () => {
    if (shareBusy || !activeProject) return;
    setShareBusy(true);
    try {
      const ok = await disableSharing(activeProject.id);
      if (ok) showToast('Share link disabled.');
    } finally {
      setShareBusy(false);
    }
  };

  // QR code of the share link, for showing the sheet on a phone (conventions,
  // client meetings) without dictating a URL out loud. Rendered from the same
  // lazily-imported qrcode module the 2FA setup uses, so it never lands in the
  // initial bundle; a failed/blocked import just leaves the QR out — the
  // copyable link above it still works.
  const [shareQrDataUrl, setShareQrDataUrl] = useState('');
  useEffect(() => {
    if (!shareUrl) {
      setShareQrDataUrl('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { toDataURL } = await import('qrcode');
        const dataUrl = await toDataURL(shareUrl, { margin: 1, width: 220 });
        if (!cancelled) setShareQrDataUrl(dataUrl);
      } catch {
        /* the plain link still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  // Save the QR as a PNG (print it, drop it on a portfolio, tape it to a
  // convention table…), named like every other export of this project.
  const downloadShareQr = () => {
    if (!shareQrDataUrl) return;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', shareQrDataUrl);
    downloadAnchorNode.setAttribute('download', `${fileSlug}_share_qr.png`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    const ok = await copy(shareUrl);
    if (!ok) showToast("Couldn't copy the link.", 'danger');
  };

  // Pretty-printed JSON, used for both the preview and the download.
  const projectJson = useMemo(() => {
    return activeProject ? JSON.stringify(activeProject, null, 2) : '';
  }, [activeProject]);

  // Filesystem-safe base name for every downloaded file (PDF, JSON, palettes),
  // derived from the project name: characters that are invalid in file names on
  // common platforms are dropped, whitespace becomes '_'. Falls back to
  // 'project' if nothing survives (e.g. a name made only of such characters).
  const fileSlug = activeProject
    ? (activeProject.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'project')
        .replace(/\s+/g, '_')
        .toLowerCase()
    : '';

  // Trigger a JSON file download via a transient data-URI anchor.
  const downloadJson = () => {
    if (!activeProject) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(projectJson);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `${fileSlug}_standards.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Downloads in-memory bytes (or text) as a file via a transient object URL —
  // the binary-safe counterpart of downloadJson's data-URI approach.
  const downloadBlob = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.setAttribute('href', url);
    anchor.setAttribute('download', filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const hasPalette = (activeProject?.palette?.length || 0) > 0;

  // Palette-only exports, in the native formats of the main drawing tools so
  // the palette can be imported instead of re-picked color by color.
  // Adobe Swatch Exchange (.ase) is also Clip Studio Paint's own color-set
  // import format (Edit > Color Set > New from File), so both entries below
  // share this one builder — `suffix` just keeps their downloaded filenames
  // apart when someone grabs both from the same page.
  const downloadAse = (suffix = '') => {
    if (!hasPalette) return;
    downloadBlob(
      buildAsePalette(activeProject.palette),
      `${fileSlug}_palette${suffix}.ase`,
      'application/octet-stream',
    );
  };

  const downloadGpl = () => {
    if (!hasPalette) return;
    downloadBlob(
      buildGplPalette(activeProject.name, activeProject.palette),
      `${fileSlug}_palette.gpl`,
      'text/plain',
    );
  };

  const downloadSwatches = () => {
    if (!hasPalette) return;
    downloadBlob(
      buildProcreateSwatches(activeProject.name, activeProject.palette),
      `${fileSlug}_palette.swatches`,
      'application/zip',
    );
    if (activeProject.palette.length > PROCREATE_MAX_SWATCHES) {
      showToast(
        `Procreate palettes hold ${PROCREATE_MAX_SWATCHES} colors — the first ${PROCREATE_MAX_SWATCHES} were exported.`,
      );
    }
  };

  // Build and download the style-guide PDF (drawn by utils/pdfStyleGuide so
  // the PDF design lab previews exactly what ships here).
  const downloadPdf = async () => {
    if (!activeProject) return;

    // Load jsPDF on demand to keep its ~hundreds of KB out of the initial bundle;
    // the footer logo loads in parallel (light-mode file: the PDF page is always white).
    const [{ jsPDF }, logoDataUrl, fonts, typographyFonts] = await Promise.all([
      import('jspdf'),
      loadImageDataUrl('/FrameSet_Logo.png'),
      loadPdfFonts(),
      loadSpecimenFonts(activeProject.typographyNorms),
    ]);

    const doc = buildStyleGuidePdf(new jsPDF(), {
      name: activeProject.name,
      palette: activeProject.palette || [],
      brushNorms: activeProject.brushNorms || [],
      typographyNorms: activeProject.typographyNorms || [],
      userName: user?.name,
      logoDataUrl,
      fonts,
      typographyFonts,
    });

    // Save with the same filesystem-safe base name as every other export.
    doc.save(`${fileSlug}_style_guide.pdf`);
  };

  return (
    <>
      <Seo title="Export standards" noindex />
      <PageHeader
        title="Export standards"
        subtitle="Export the essentials of your art direction."
      />

      {activeProject ? (
        <>
          {/* Three equal download cards on one row (wrapping to 2/1 columns on
              smaller screens), then the share link on its own full-width row. */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-8 flex flex-col items-start text-left">
              <IconCircle>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </IconCircle>
              <h2 className="text-lg font-medium text-primary mb-2">PDF style guide</h2>
              <p className="text-sm text-primary mb-6">
                A structured PDF document bringing together all of the project's active standards
                and palettes. Ideal for printing or sharing.
              </p>
              {/* mt-auto pins the action to the card bottom so the three
                  download cards keep their buttons on one line. */}
              <Button onClick={downloadPdf} variant="primary" className="mt-auto">
                Download PDF
              </Button>
            </Card>

            <Card className="p-8 flex flex-col items-start text-left">
              <IconCircle>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </IconCircle>
              <h2 className="text-lg font-medium text-primary mb-2">JSON data</h2>
              <p className="text-sm text-primary mb-6">
                Raw data structure covering the entire project: standards, palettes, identifiers and
                settings. Ready to plug into your own tools.
              </p>
              <Button onClick={downloadJson} variant="primary" className="mt-auto">
                Download JSON
              </Button>
            </Card>

            <Card className="p-8 flex flex-col items-start text-left md:col-span-2 lg:col-span-1">
              <IconCircle>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </IconCircle>
              <h2 className="text-lg font-medium text-primary mb-2">
                Palette for your drawing app
              </h2>
              <p className="text-sm text-primary mb-6">
                Import the color palette straight into your drawing app — no re-picking color by
                color.
              </p>
              {hasPalette ? (
                <div className="w-full mt-auto space-y-2">
                  {[
                    { label: 'Photoshop / Illustrator', ext: '.ase', onClick: () => downloadAse() },
                    {
                      label: 'Clip Studio Paint',
                      ext: '.ase',
                      onClick: () => downloadAse('_csp'),
                    },
                    { label: 'Krita / GIMP', ext: '.gpl', onClick: downloadGpl },
                    { label: 'Procreate', ext: '.swatches', onClick: downloadSwatches },
                  ].map(({ label, ext, onClick }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={onClick}
                      className="w-full flex items-center justify-between gap-3 rounded-xl bg-primary/5 hover:bg-blue/10 px-4 py-3 text-sm font-medium text-primary transition-colors focus-ring"
                    >
                      <span className="flex items-center gap-2.5">
                        <svg
                          className="w-4 h-4 text-blue"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                          />
                        </svg>
                        {label}
                      </span>
                      <span className="font-mono text-xs text-primary/60">{ext}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-primary/60 mt-auto">
                  Add colors to this project&apos;s palette to enable these exports.
                </p>
              )}
            </Card>

            <Card className="p-8 flex flex-col items-start text-left md:col-span-2 lg:col-span-3">
              <IconCircle>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
              </IconCircle>
              <h2 className="text-lg font-medium text-primary mb-2">Public share link</h2>
              <p className="text-sm text-primary mb-6">
                A read-only web page of this reference sheet — palette, typography and brush
                standards. Anyone with the link can view it, no account needed, and the page updates
                live as you edit the project. Disable it anytime to revoke access.
              </p>

              {shareUrl ? (
                <div className="w-full space-y-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <code
                      data-testid="share-url"
                      className="flex-1 min-w-0 truncate rounded-2xl bg-primary/5 px-4 py-3 text-sm text-primary font-mono"
                    >
                      {shareUrl}
                    </code>
                    <div className="flex gap-3 shrink-0">
                      <Button
                        onClick={handleCopyShareUrl}
                        variant="primary"
                        className="whitespace-nowrap"
                      >
                        {copiedValue === shareUrl ? 'Copied!' : 'Copy link'}
                      </Button>
                      <Button onClick={handleDisableSharing} variant="ghost" loading={shareBusy}>
                        Disable
                      </Button>
                    </div>
                  </div>

                  {shareQrDataUrl && (
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      {/* Always on a white tile: a QR needs dark-on-light
                          contrast to scan reliably, dark mode included. */}
                      <div className="shrink-0 rounded-2xl bg-white p-3 border border-primary/10">
                        <img
                          src={shareQrDataUrl}
                          alt="QR code opening this project's shared reference sheet"
                          width={132}
                          height={132}
                        />
                      </div>
                      <div className="flex flex-col items-center sm:items-start gap-3 text-center sm:text-left">
                        <p className="text-sm text-primary/60 max-w-sm">
                          Scan it to open this reference sheet on a phone — handy at a convention
                          table or in a client meeting. It stops working if you disable the link.
                        </p>
                        <Button onClick={downloadShareQr} variant="outline" className="text-sm">
                          Download QR code
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button onClick={handleEnableSharing} variant="primary" loading={shareBusy}>
                  Create share link
                </Button>
              )}
            </Card>
          </div>

          <div className="mt-12">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">
              JSON output preview
            </h2>
            <div className="bg-primary/5 rounded-2xl p-6 overflow-x-auto">
              <pre className="text-xs text-primary font-mono leading-relaxed whitespace-pre-wrap break-words">
                {projectJson}
              </pre>
            </div>
          </div>
        </>
      ) : (
        <ProjectStatePlaceholder
          // Stay in the loading state until the deep-link lookup has actually
          // failed: a project beyond the loaded pages is fetched by id first.
          loading={
            projectsLoading || String(activeProjectId) !== String(id) || !activeProjectNotFound
          }
        />
      )}
    </>
  );
}
