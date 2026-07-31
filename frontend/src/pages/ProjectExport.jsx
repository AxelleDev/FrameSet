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

  // Brand colors mirrored from index.css (light theme, since the PDF page is
  // always white) so the export reads as the same product as the app and the
  // Shared reference sheet: --color-primary #3C3D48, --color-blue #8994DF,
  // --color-secondary #6B6B6B.
  const PDF_PRIMARY = [60, 61, 72];
  const PDF_BLUE = [137, 148, 223];
  const PDF_SECONDARY = [107, 107, 107];
  const PDF_LIGHT_RULE = [225, 226, 235];
  // The site's canvas tint: on the PDF's white page it plays the surface
  // cards' role, so the document reads like the Shared reference sheet.
  const PDF_CANVAS = [242, 243, 255];

  // Flattens an rgb color at `alpha` over `base` — jsPDF has no opacity in
  // its stable API, so the site's translucent fills (bg-blue/10, bg-primary/10,
  // the preview strip's bg-blue/5) are pre-blended into solid colors.
  const blendPdfColor = (rgb, alpha, base = [255, 255, 255]) =>
    rgb.map((channel, i) => Math.round(base[i] + (channel - base[i]) * alpha));

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

    // The footer is stamped on EVERY page (see drawFooters at the end), so all
    // content must stop above it: this is the page-break threshold.
    const CONTENT_BOTTOM = 268;

    // Header, mirroring the Shared reference sheet's: a small blue uppercase
    // eyebrow, the project name big and light, then the "Made by" credit
    // (generation date right-aligned on the same line — the one PDF-only bit,
    // since a printed document has no "last edited" to lean on).
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_BLUE);
    doc.text('REFERENCE SHEET', 20, y, { charSpace: 0.6 });
    y += 9;

    doc.setFontSize(25);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_PRIMARY);
    const titleLines = doc.splitTextToSize(activeProject.name, 170).slice(0, 2);
    titleLines.forEach((line) => {
      doc.text(line, 20, y);
      y += 11;
    });
    y += 1;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_SECONDARY);
    if (user?.name) {
      doc.text(`Made by ${user.name}`, 20, y);
    }
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 190, y, { align: 'right' });
    y += 16;

    // Section: color palette — a grid of SQUARE flat color tiles (name + hex
    // centered below), matching the ColorTile component used everywhere else
    // a palette shows up (Landing, ProjectPalette, the Shared reference sheet).
    if (activeProject.palette.length > 0) {
      if (y > CONTENT_BOTTOM - 60) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_PRIMARY);
      doc.text('Color palette', 20, y);
      y += 10;

      // Adaptive grid: pick the column count that balances the rows and lets
      // the tiles fill the full content width — 6 colors read as one full row
      // of 6, not a 4 + 2 with a hole (max 6 per row, min 4 so a tiny palette
      // never turns into billboard-sized tiles).
      const MAX_COLS = 6;
      const count = activeProject.palette.length;
      const rows = Math.ceil(count / MAX_COLS);
      const cols = Math.max(Math.ceil(count / rows), Math.min(count, 4));
      const cellW = 170 / cols;
      const squareSize = cellW - 5;
      const nameLineH = cols >= 6 ? 3.8 : 4.2;
      const nameFontSize = cols >= 6 ? 8 : 9;
      const hexFontSize = cols >= 6 ? 7 : 8;
      // Fixed row height reserves room for up to 2 wrapped name lines + the hex
      // line, so a long name (wrapped) can never overlap the hex line below it.
      const rowH = squareSize + 6 + nameLineH * 2 + 7;
      activeProject.palette.forEach((color, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) y += rowH;
        if (y + rowH > CONTENT_BOTTOM) {
          doc.addPage();
          y = 20;
        }
        const x = 20 + col * cellW;

        // Radius scaled to the tile (ColorTile's rounded-3xl look at any size).
        // Near-white colors get a hairline border, or they would melt into the
        // white page (the site's canvas background does this job on screen).
        const [r, g, b] = [1, 3, 5].map((o) => parseInt(color.hex.slice(o, o + 2), 16) / 255);
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        doc.setFillColor(color.hex);
        if (luminance > 0.93) {
          doc.setDrawColor(...PDF_LIGHT_RULE);
          doc.setLineWidth(0.3);
          doc.roundedRect(x, y, squareSize, squareSize, squareSize * 0.16, squareSize * 0.16, 'FD');
        } else {
          doc.roundedRect(x, y, squareSize, squareSize, squareSize * 0.16, squareSize * 0.16, 'F');
        }

        doc.setFontSize(nameFontSize);
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

        doc.setFontSize(hexFontSize);
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
        // Raw fields for the preview strip (see below), same inputs as BrushPreview.
        preview: {
          kind: 'brush',
          size: parseFloat(n.value),
          opacity:
            typeof n.opacity === 'number' ? n.opacity : n.opacity ? parseFloat(n.opacity) : 1,
          brushName: n.brushName || 'Brush',
        },
      })),
      ...(activeProject.typographyNorms || []).map((n) => ({
        category: 'Typography',
        name: n.fontUsage || n.fontFamily,
        value: n.fontFamily,
        unit: n.fontWeight || '',
        detail: n.fontStyle || null,
        preview: { kind: 'typography', fontStyle: n.fontStyle || '' },
      })),
    ];

    if (standardCards.length > 0) {
      if (y > CONTENT_BOTTOM - 60) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_PRIMARY);
      doc.text('Graphic standards', 20, y);
      y += 10;

      // StandardCard, transposed: a soft canvas-tinted card (no hairline box)
      // with a category badge pill, the uppercase usage title, the big light
      // value + blue unit, a detail line, and the same preview strip the site
      // renders — a real brush bar sized/faded to the norm, or an AaBbCc
      // specimen for typography.
      const cols = 2;
      const cellW = 82.5;
      const cardH = 54;
      const gap = 5;
      const pad = 6;
      const textMaxWidth = cellW - pad * 2;
      standardCards.forEach((card, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) y += cardH + gap;
        if (y + cardH > CONTENT_BOTTOM) {
          doc.addPage();
          y = 20;
        }
        const x = 20 + col * (cellW + gap);

        doc.setFillColor(...PDF_CANVAS);
        doc.roundedRect(x, y, cellW, cardH, 7, 7, 'F');

        // Category badge, as the site's pill: tinted fill + matching text
        // (blue for Typography, neutral for Brush — same mapping as the pages).
        const isTypography = card.category === 'Typography';
        const badgeTone = isTypography ? PDF_BLUE : PDF_PRIMARY;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        const badgeLabel = card.category.toUpperCase();
        const badgeTextW = doc.getTextWidth(badgeLabel);
        doc.setFillColor(...blendPdfColor(badgeTone, 0.1, PDF_CANVAS));
        doc.roundedRect(x + pad, y + pad, badgeTextW + 7, 5.2, 2.6, 2.6, 'F');
        doc.setTextColor(...badgeTone);
        doc.text(badgeLabel, x + pad + 3.5, y + pad + 3.6, { charSpace: 0.4 });

        // Usage title: small caps feel (uppercase + tracking), like the cards'.
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_PRIMARY);
        doc.text(truncateToWidth(card.name.toUpperCase(), textMaxWidth), x + pad, y + pad + 11, {
          charSpace: 0.3,
        });

        // Measure the unit first, at its own font, so the value can be
        // truncated to leave it exactly enough room. jsPDF has no CSS-style
        // "shrink to fit" layout, so this order is what keeps them from overlapping.
        let unitWidth = 0;
        if (card.unit) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          unitWidth = doc.getTextWidth(card.unit);
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_PRIMARY);
        const valueMaxWidth = textMaxWidth - (card.unit ? unitWidth + 2 : 0);
        const valueText = truncateToWidth(`${card.value}`, valueMaxWidth);
        doc.text(valueText, x + pad, y + pad + 19.5);
        const valueWidth = doc.getTextWidth(valueText);

        if (card.unit) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...PDF_BLUE);
          doc.text(card.unit, x + pad + valueWidth + 2, y + pad + 19.5);
        }

        if (card.detail) {
          doc.setFontSize(7.5);
          // The site renders a typography style ("Italic") in italics — do too.
          doc.setFont('helvetica', isTypography ? 'italic' : 'normal');
          doc.setTextColor(...PDF_SECONDARY);
          doc.text(truncateToWidth(card.detail, textMaxWidth), x + pad, y + pad + 25);
        }

        // Preview strip (the h-16 bg-blue/5 rounded box on the site).
        const stripH = 13.5;
        const stripY = y + cardH - 5.5 - stripH;
        doc.setFillColor(...blendPdfColor(PDF_BLUE, 0.1, PDF_CANVAS));
        doc.roundedRect(x + pad, stripY, cellW - pad * 2, stripH, 4.5, 4.5, 'F');

        if (card.preview.kind === 'brush') {
          // The brush bar: 16mm wide (the site's w-16), as thick as the norm's
          // size (px→mm), opacity flattened into the color since jsPDF's
          // stable API has none. Then the brush name in blue, like BrushPreview.
          const barW = 16;
          const barH = Math.min(
            Math.max((Number.isFinite(card.preview.size) ? card.preview.size : 2) * 0.26, 0.6),
            6.5,
          );
          const opacity = Math.min(Math.max(card.preview.opacity, 0), 1);
          const stripBg = blendPdfColor(PDF_BLUE, 0.1, PDF_CANVAS);
          doc.setFillColor(...blendPdfColor(PDF_PRIMARY, opacity, stripBg));
          doc.roundedRect(
            x + cellW / 2 - barW / 2,
            stripY + stripH / 2 - barH / 2 - 1.5,
            barW,
            barH,
            barH / 2,
            barH / 2,
            'F',
          );
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...PDF_BLUE);
          doc.text(
            truncateToWidth(card.preview.brushName.toUpperCase(), cellW - pad * 2 - 4),
            x + cellW / 2,
            stripY + stripH - 2.5,
            { align: 'center', charSpace: 0.4 },
          );
        } else {
          // The AaBbCc specimen. Helvetica stands in for the actual family
          // (jsPDF can't load arbitrary web fonts), but the style carries over.
          doc.setFontSize(12);
          doc.setFont('helvetica', card.preview.fontStyle ? 'italic' : 'normal');
          doc.setTextColor(...PDF_PRIMARY);
          doc.text('AaBbCc', x + cellW / 2, stripY + stripH / 2 + 1.5, { align: 'center' });
        }
      });
      y += cardH + 10;
    }

    // Footer on EVERY page, pinned to the bottom (content stops at
    // CONTENT_BOTTOM): the Shared reference sheet's footer — a hairline, the
    // logo on the left, the credit line on the right.
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...PDF_LIGHT_RULE);
      doc.line(20, 278, 190, 278);
      if (logoDataUrl) {
        const logoH = 7;
        const logoW = logoH * (2244 / 1148); // the source PNG's aspect ratio
        doc.addImage(logoDataUrl, 'PNG', 20, 281, logoW, logoH);
      }
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_SECONDARY);
      doc.text('Made with FrameSet — the graphic reference for your projects.', 190, 284.5, {
        align: 'right',
      });
    }

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
                standards. Anyone with the link can view it, no account needed. Disable it anytime
                to revoke access.
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
