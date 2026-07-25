// Project export page (/app/project/:id/export): download the style guide as a
// jsPDF-built PDF or raw JSON (with a live preview), or share a public
// read-only link to the reference sheet.
import React, { useMemo, useState } from 'react';
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

export default function ProjectExport() {
  const { id } = useParams();
  const { activeProject, projectsLoading, activeProjectId, enableSharing, disableSharing } =
    useProjects();
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
  const downloadAse = () => {
    if (!hasPalette) return;
    downloadBlob(
      buildAsePalette(activeProject.palette),
      `${fileSlug}_palette.ase`,
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

  // Brand colors mirrored from index.css (light theme, since the PDF page is
  // always white) so the export reads as the same product as the app and the
  // Shared reference sheet: --color-primary #3C3D48, --color-blue #8994DF,
  // --color-secondary #6B6B6B.
  const PDF_PRIMARY = [60, 61, 72];
  const PDF_BLUE = [137, 148, 223];
  const PDF_SECONDARY = [107, 107, 107];
  const PDF_LIGHT_RULE = [225, 226, 235];

  // Build and download the style-guide PDF. Drawn imperatively with jsPDF: `y`
  // is the running vertical cursor (mm), advanced per section/row, with a page
  // break whenever it nears the page bottom. Section order and hierarchy
  // (palette tiles with centered name/hex, then standards as bordered cards
  // with a category label, a big value line and a detail line) mirror the
  // Shared reference sheet and the in-app Palette/Standards pages, so the PDF,
  // the public share link and the editor all read as the same document.
  const downloadPdf = async () => {
    if (!activeProject) return;

    // Load jsPDF on demand to keep its ~hundreds of KB out of the initial bundle;
    // the footer logo loads in parallel (light-mode file: the PDF page is always white).
    const [{ jsPDF }, logoDataUrl] = await Promise.all([
      import('jspdf'),
      loadImageDataUrl('/FrameSet_Logo.png'),
    ]);
    const doc = new jsPDF();
    let y = 20;

    // Truncates `text` (at the currently active font/size) with an ellipsis so
    // it fits within `maxWidth`. jsPDF's own `maxWidth` option wraps to a new
    // line instead of truncating, which would silently overlap the
    // fixed-position content drawn below it in these single-line layouts.
    const truncateToWidth = (text, maxWidth) => {
      if (doc.getTextWidth(text) <= maxWidth) return text;
      let truncated = text;
      while (truncated.length > 1 && doc.getTextWidth(`${truncated}…`) > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      return `${truncated}…`;
    };

    // Header: project name + generation date, then a divider rule.
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_PRIMARY);
    doc.text(activeProject.name, 20, y);
    y += 8;

    // Same "Made by <name>" credit as the Shared reference sheet, then the
    // generation date.
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_SECONDARY);
    if (user?.name) {
      doc.text(`Made by ${user.name}`, 20, y);
      y += 6;
    }
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, y);
    y += 14;

    doc.setDrawColor(...PDF_LIGHT_RULE);
    doc.line(20, y, 190, y);
    y += 14;

    // Section: color palette — a grid of SQUARE flat color tiles (name + hex
    // centered below), matching the ColorTile component used everywhere else
    // a palette shows up (Landing, ProjectPalette, the Shared reference sheet).
    if (activeProject.palette.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_PRIMARY);
      doc.text('Color palette', 20, y);
      y += 12;

      const cols = 4;
      const cellW = 42.5;
      const squareSize = 34;
      const nameLineH = 4.2;
      // Fixed row height reserves room for up to 2 wrapped name lines + the hex
      // line, so a long name (wrapped) can never overlap the hex line below it.
      const rowH = squareSize + 6 + nameLineH * 2 + 7;
      activeProject.palette.forEach((color, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) y += rowH;
        if (y + rowH > 280) {
          doc.addPage();
          y = 20;
        }
        const x = 20 + col * cellW;

        doc.setFillColor(color.hex);
        doc.roundedRect(x, y, squareSize, squareSize, 3, 3, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_PRIMARY);
        let nameLines = doc.splitTextToSize(color.name, squareSize);
        if (nameLines.length > 2) {
          // More than 2 lines: keep the first two and ellipsize the second so
          // the hex line's position (fixed at 2 lines' worth of height) stays correct.
          let secondLine = nameLines[1];
          while (secondLine.length > 1 && doc.getTextWidth(`${secondLine}…`) > squareSize) {
            secondLine = secondLine.slice(0, -1);
          }
          nameLines = [nameLines[0], `${secondLine}…`];
        }
        nameLines.forEach((line, li) => {
          doc.text(line, x + squareSize / 2, y + squareSize + 6 + li * nameLineH, {
            align: 'center',
          });
        });

        doc.setFontSize(8);
        doc.setFont('courier', 'normal');
        doc.setTextColor(...PDF_SECONDARY);
        doc.text(
          color.hex.toUpperCase(),
          x + squareSize / 2,
          y + squareSize + 6 + nameLines.length * nameLineH + 3,
          { align: 'center' },
        );
      });
      y += rowH + 10;
    }

    // Section: graphic standards — brush norms then typography norms (same
    // order as the Shared reference sheet), each as a bordered card with a
    // category label, a big value/unit line and a detail line.
    const standardCards = [
      ...(activeProject.brushNorms || []).map((n) => ({
        category: 'Brush',
        name: n.name,
        value: `${n.value}`,
        unit: n.unit || '',
        detail: n.opacity !== undefined && n.opacity !== null ? `Opacity: ${n.opacity}` : null,
      })),
      ...(activeProject.typographyNorms || []).map((n) => ({
        category: 'Typography',
        name: n.fontUsage || n.fontFamily,
        value: n.fontFamily,
        unit: n.fontWeight || '',
        detail: n.fontStyle || null,
      })),
    ];

    if (standardCards.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_PRIMARY);
      doc.text('Graphic standards', 20, y);
      y += 12;

      const cols = 2;
      const cellW = 85;
      const cardH = 30;
      const gap = 5;
      const textMaxWidth = cellW - 10;
      standardCards.forEach((card, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) y += cardH + gap;
        if (y + cardH > 280) {
          doc.addPage();
          y = 20;
        }
        const x = 20 + col * (cellW + gap);

        doc.setDrawColor(...PDF_LIGHT_RULE);
        doc.roundedRect(x, y, cellW, cardH, 3, 3, 'S');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_BLUE);
        doc.text(card.category.toUpperCase(), x + 5, y + 7);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_PRIMARY);
        doc.text(truncateToWidth(card.name, textMaxWidth), x + 5, y + 13);

        // Measure the unit first, at its own font, so the value can be
        // truncated to leave it exactly enough room. jsPDF has no CSS-style
        // "shrink to fit" layout, so this order is what keeps them from overlapping.
        let unitWidth = 0;
        if (card.unit) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          unitWidth = doc.getTextWidth(card.unit);
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_PRIMARY);
        const valueMaxWidth = textMaxWidth - (card.unit ? unitWidth + 2 : 0);
        const valueText = truncateToWidth(`${card.value}`, valueMaxWidth);
        doc.text(valueText, x + 5, y + 21);
        const valueWidth = doc.getTextWidth(valueText);

        if (card.unit) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...PDF_BLUE);
          doc.text(card.unit, x + 5 + valueWidth + 2, y + 21);
        }

        if (card.detail) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...PDF_SECONDARY);
          doc.text(truncateToWidth(card.detail, textMaxWidth), x + 5, y + 27);
        }
      });
      y += cardH + 10;
    }

    // Footer: same "Made with FrameSet" credit (logo + line) as the Shared
    // reference sheet's footer — no CTA button here, this is the owner's own copy.
    const footerH = 16;
    if (y + footerH > 285) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(...PDF_LIGHT_RULE);
    doc.line(20, y, 190, y);
    y += 10;

    if (logoDataUrl) {
      const logoH = 7;
      const logoW = logoH * (2244 / 1148); // the source PNG's aspect ratio
      doc.addImage(logoDataUrl, 'PNG', 20, y - 5, logoW, logoH);
    }
    // Right-aligned against the page's right margin, same side as the
    // "Create your own" button on the Shared reference sheet's footer.
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_SECONDARY);
    doc.text('Made with FrameSet — the graphic reference for your projects.', 190, y, {
      align: 'right',
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
                    { label: 'Photoshop / Illustrator', ext: '.ase', onClick: downloadAse },
                    { label: 'Krita / GIMP', ext: '.gpl', onClick: downloadGpl },
                    { label: 'Procreate', ext: '.swatches', onClick: downloadSwatches },
                  ].map(({ label, ext, onClick }) => (
                    <button
                      key={ext}
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
                standards. Anyone with the link can view it, no account needed. Disable it anytime
                to revoke access.
              </p>

              {shareUrl ? (
                <div className="w-full flex flex-col sm:flex-row gap-3">
                  <code
                    data-testid="share-url"
                    className="flex-1 min-w-0 truncate rounded-2xl bg-primary/5 px-4 py-3 text-sm text-primary font-mono"
                  >
                    {shareUrl}
                  </code>
                  <div className="flex gap-3 shrink-0">
                    <Button onClick={handleCopyShareUrl} variant="primary">
                      {copiedValue === shareUrl ? 'Copied!' : 'Copy link'}
                    </Button>
                    <Button onClick={handleDisableSharing} variant="ghost" loading={shareBusy}>
                      Disable
                    </Button>
                  </div>
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
          loading={projectsLoading || String(activeProjectId) !== String(id)}
        />
      )}
    </>
  );
}
