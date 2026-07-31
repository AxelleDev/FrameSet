/**
 * The style-guide PDF, drawn imperatively on a jsPDF document: `y` is the
 * running vertical cursor (mm), advanced per section/row, with row-atomic
 * page breaks above the footer zone. Section order and hierarchy (eyebrow +
 * light title header, palette tiles with centered name/hex, standards as
 * soft cards with a badge, a big value line, a detail line and a preview
 * strip, a logo + credit footer on every page) mirror the Shared reference
 * sheet and the in-app Palette/Standards pages, so the PDF, the public share
 * link and the editor all read as the same document.
 *
 * Dependency-free on purpose: the page hands in the jsPDF instance and the
 * data, and the PDF design lab renders this very module — what is previewed
 * is exactly what ships.
 */

const PRIMARY = [60, 61, 72];
const BLUE = [137, 148, 223];
const SECONDARY = [107, 107, 107];
const LIGHT_RULE = [225, 226, 235];
// The site's canvas tint: on the PDF's white page it plays the surface
// cards' role, so the document reads like the Shared reference sheet.
const CANVAS = [242, 243, 255];

// A4 metrics (mm). The footer is stamped on EVERY page, so all content must
// stop above it: CONTENT_BOTTOM is the page-break threshold.
const MARGIN = 20;
const CONTENT_WIDTH = 170;
const CONTENT_BOTTOM = 268;

// Flattens an rgb color at `alpha` over `base` — jsPDF has no opacity in its
// stable API, so the site's translucent fills (bg-blue/10, bg-primary/10, the
// preview strip's bg-blue/5) are pre-blended into solid colors.
const blend = (rgb, alpha, base = [255, 255, 255]) =>
  rgb.map((channel, i) => Math.round(base[i] + (channel - base[i]) * alpha));

// WCAG relative-luminance approximation, enough to spot near-white swatches.
const hexLuminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function buildStyleGuidePdf(
  doc,
  {
    name,
    palette = [],
    brushNorms = [],
    typographyNorms = [],
    userName,
    logoDataUrl,
    generatedOn = new Date().toLocaleDateString(),
    fonts,
    typographyFonts,
  },
) {
  let y = MARGIN;

  // Embed the site's Figtree faces when provided (see the page's font loader);
  // helvetica stays as the drop-in fallback so a failed font fetch can never
  // block the export. Figtree carries the site's exact weights — including
  // the light and medium the built-in fonts simply don't have.
  const family = (() => {
    if (!fonts || fonts.length === 0) return 'helvetica';
    try {
      fonts.forEach(({ vfsName, style, base64 }) => {
        doc.addFileToVFS(vfsName, base64);
        doc.addFont(vfsName, 'Figtree', style);
      });
      return 'Figtree';
    } catch {
      return 'helvetica';
    }
  })();
  const HELVETICA_STYLES = {
    light: 'normal',
    normal: 'normal',
    medium: 'bold',
    bold: 'bold',
    italic: 'italic',
  };
  const setF = (style) =>
    doc.setFont(family, family === 'Figtree' ? style : HELVETICA_STYLES[style] || 'normal');

  // The actual face of each typography norm (fetched from Google Fonts by the
  // page), so a specimen reads in ITS font — like the site's live previews.
  // Families that failed to load just fall back to the app font.
  const specimenFamilies = new Set();
  Object.entries(typographyFonts || {}).forEach(([specimenFamily, file]) => {
    try {
      doc.addFileToVFS(file.vfsName, file.base64);
      doc.addFont(file.vfsName, specimenFamily, 'normal');
      specimenFamilies.add(specimenFamily);
    } catch {
      /* fall back to the app font for this family */
    }
  });

  // Truncates `text` (at the currently active font/size) with an ellipsis so
  // it fits within `maxWidth`. jsPDF's own `maxWidth` option wraps to a new
  // line instead of truncating, which would silently overlap the
  // fixed-position content drawn below it in these single-line layouts.
  // `charSpace` must match the tracking the text will be DRAWN with:
  // getTextWidth ignores it, so a tracked string is wider than measured by
  // one charSpace per character.
  const trackedWidth = (text, charSpace) => doc.getTextWidth(text) + charSpace * text.length;
  const truncateToWidth = (text, maxWidth, charSpace = 0) => {
    if (trackedWidth(text, charSpace) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && trackedWidth(`${truncated}…`, charSpace) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  };

  // Header, mirroring the Shared reference sheet's: a small blue uppercase
  // eyebrow, the project name big and light, then the "Made by" credit
  // (generation date right-aligned on the same line — the one PDF-only bit,
  // since a printed document has no "last edited" to lean on).
  doc.setFontSize(8);
  setF('bold');
  doc.setTextColor(...BLUE);
  doc.text('REFERENCE SHEET', MARGIN, y, { charSpace: 0.6 });
  y += 9;

  doc.setFontSize(25);
  setF('light');
  doc.setTextColor(...PRIMARY);
  const allTitleLines = doc.splitTextToSize(name, CONTENT_WIDTH);
  const titleLines = allTitleLines.slice(0, 2);
  if (allTitleLines.length > 2) {
    // A name longer than two lines is ellipsized, never silently cut mid-word.
    titleLines[1] = truncateToWidth(`${titleLines[1]}…`, CONTENT_WIDTH);
  }
  titleLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 11;
  });
  y += 1;

  doc.setFontSize(9.5);
  setF('normal');
  doc.setTextColor(...SECONDARY);
  if (userName) {
    doc.text(`Made by ${userName}`, MARGIN, y);
  }
  doc.text(`Generated on ${generatedOn}`, MARGIN + CONTENT_WIDTH, y, { align: 'right' });
  y += 16;

  const sectionTitle = (label) => {
    doc.setFontSize(13);
    setF('medium');
    doc.setTextColor(...PRIMARY);
    doc.text(label, MARGIN, y);
    y += 10;
  };

  // Keep-together pagination: a section that fits on one full page never gets
  // split — better a clean chapter-like break than a lone orphan row on a
  // near-empty continuation page. Sections taller than a page still flow,
  // with their row-atomic breaks.
  const SECTION_TITLE_H = 10;
  const startSection = (label, bodyHeight) => {
    const sectionH = SECTION_TITLE_H + bodyHeight;
    const fitsHere = y + sectionH <= CONTENT_BOTTOM;
    const fitsOnFreshPage = sectionH <= CONTENT_BOTTOM - MARGIN;
    if ((!fitsHere && fitsOnFreshPage) || y > CONTENT_BOTTOM - 60) {
      doc.addPage();
      y = MARGIN;
    }
    sectionTitle(label);
  };

  // ---- Color palette ------------------------------------------------------
  if (palette.length > 0) {
    // Adaptive grid: pick the column count that balances the rows and lets
    // the tiles fill the full content width — 6 colors read as one full row
    // of 6, not a 4 + 2 with a hole (max 6 per row, min 4 columns' worth of
    // sizing so a tiny palette never turns into billboard-sized tiles).
    const MAX_COLS = 6;
    const rows = Math.ceil(palette.length / MAX_COLS);
    const cols = Math.max(Math.ceil(palette.length / rows), 4);
    // Gap lives only BETWEEN columns: the first tile sits flush on the left
    // margin and the last one flush on the right, like every other block.
    const TILE_GAP = 5;
    const squareSize = (CONTENT_WIDTH - TILE_GAP * (cols - 1)) / cols;
    const tileStep = squareSize + TILE_GAP;
    const nameLineH = cols >= 6 ? 3.8 : 4.2;
    const nameFontSize = cols >= 6 ? 8 : 9;
    const hexFontSize = cols >= 6 ? 7 : 8;

    // Rows are measured up front (names wrap, max 2 lines) so the whole row
    // shares one height — every hex in a row sits on the same baseline, a row
    // of short names doesn't reserve phantom space, and the section's total
    // height is known before anything is drawn (see startSection).
    doc.setFontSize(nameFontSize);
    setF('bold');
    const rowsData = [];
    for (let rowStart = 0; rowStart < palette.length; rowStart += cols) {
      const rowColors = palette.slice(rowStart, rowStart + cols);
      const rowNameLines = rowColors.map((color) => {
        let nameLines = doc.splitTextToSize(color.name, squareSize);
        if (nameLines.length > 2) {
          // More than 2 lines: keep the first two and ellipsize the second so
          // the reserved slot is never overflowed.
          let secondLine = nameLines[1];
          while (secondLine.length > 1 && doc.getTextWidth(`${secondLine}…`) > squareSize) {
            secondLine = secondLine.slice(0, -1);
          }
          nameLines = [nameLines[0], `${secondLine}…`];
        }
        return nameLines;
      });
      const rowLineCount = Math.max(1, ...rowNameLines.map((lines) => lines.length));
      rowsData.push({
        rowColors,
        rowNameLines,
        rowLineCount,
        rowH: squareSize + 5.5 + nameLineH * rowLineCount + 9.5,
      });
    }

    startSection(
      'Color palette',
      rowsData.reduce((total, row) => total + row.rowH, 0),
    );

    let rowH = 0;
    rowsData.forEach(({ rowColors, rowNameLines, rowLineCount, rowH: thisRowH }, rowIndex) => {
      rowH = thisRowH;
      // Row-atomic page break: the whole row moves, it never splits.
      if (rowIndex > 0) y += rowH;
      if (y + rowH > CONTENT_BOTTOM) {
        doc.addPage();
        y = MARGIN;
      }

      rowColors.forEach((color, col) => {
        const x = MARGIN + col * tileStep;

        // Radius scaled to the tile (ColorTile's rounded-3xl look at any
        // size). Near-white colors get a hairline border, or they would melt
        // into the white page (the site's canvas background does this job on
        // screen).
        doc.setFillColor(color.hex);
        if (hexLuminance(color.hex) > 0.93) {
          doc.setDrawColor(...LIGHT_RULE);
          doc.setLineWidth(0.3);
          doc.roundedRect(x, y, squareSize, squareSize, squareSize * 0.16, squareSize * 0.16, 'FD');
        } else {
          doc.roundedRect(x, y, squareSize, squareSize, squareSize * 0.16, squareSize * 0.16, 'F');
        }

        doc.setFontSize(nameFontSize);
        setF('bold');
        doc.setTextColor(...PRIMARY);
        rowNameLines[col].forEach((line, li) => {
          doc.text(line, x + squareSize / 2, y + squareSize + 5.5 + li * nameLineH, {
            align: 'center',
          });
        });

        doc.setFontSize(hexFontSize);
        doc.setFont('courier', 'normal');
        doc.setTextColor(...SECONDARY);
        doc.text(
          color.hex.toUpperCase(),
          x + squareSize / 2,
          y + squareSize + 5.5 + nameLineH * rowLineCount + 1.5,
          { align: 'center' },
        );
      });
    });
    y += rowH + 10;
  }

  // ---- Graphic standards --------------------------------------------------
  const standardCards = [
    ...brushNorms.map((n) => ({
      category: 'Brush',
      name: n.name,
      value: `${n.value}`,
      unit: n.unit || '',
      detail: n.opacity !== undefined && n.opacity !== null ? `Opacity: ${n.opacity}` : null,
      preview: {
        kind: 'brush',
        size: parseFloat(n.value),
        opacity: typeof n.opacity === 'number' ? n.opacity : n.opacity ? parseFloat(n.opacity) : 1,
        brushName: n.brushName || 'Brush',
      },
    })),
    ...typographyNorms.map((n) => ({
      category: 'Typography',
      name: n.fontUsage || n.fontFamily,
      value: n.fontFamily,
      unit: n.fontWeight ? `${n.fontWeight}` : '',
      detail: n.fontStyle || null,
      preview: { kind: 'typography', fontStyle: n.fontStyle || '', fontFamily: n.fontFamily },
    })),
  ];

  if (standardCards.length > 0) {
    // StandardCard, transposed: a soft canvas-tinted card (no hairline box)
    // with a category badge pill, the uppercase usage title, the big light
    // value + blue unit, a detail line, and the same preview strip the site
    // renders — a real brush bar sized/faded to the norm, or an AaBbCc
    // specimen for typography.
    const cols = 2;
    const gap = 6;
    const cellW = (CONTENT_WIDTH - gap) / cols;
    const cardH = 54;
    const pad = 6;

    const cardRows = Math.ceil(standardCards.length / cols);
    startSection('Graphic standards', cardRows * cardH + (cardRows - 1) * gap);
    const textMaxWidth = cellW - pad * 2;
    standardCards.forEach((card, i) => {
      const col = i % cols;
      // Row-atomic page break, like the palette's: a pair of cards always
      // lands on the same page.
      if (col === 0) {
        if (i > 0) y += cardH + gap;
        if (y + cardH > CONTENT_BOTTOM) {
          doc.addPage();
          y = MARGIN;
        }
      }
      const x = MARGIN + col * (cellW + gap);

      // White cards with a hairline border, like the site's surface cards
      // (the hairline stands in for their soft shadow on the white page).
      const isTypography = card.category === 'Typography';
      const cardBg = [255, 255, 255];
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...LIGHT_RULE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cellW, cardH, 7, 7, 'FD');

      // Category badge, as the site's pill: tinted fill + matching text
      // (blue for Typography, neutral for Brush — same mapping as the pages).
      const badgeTone = isTypography ? BLUE : PRIMARY;
      doc.setFontSize(6.5);
      setF('bold');
      const badgeLabel = card.category.toUpperCase();
      const badgeTextW = doc.getTextWidth(badgeLabel) + 0.4 * badgeLabel.length;
      doc.setFillColor(...blend(badgeTone, 0.1, cardBg));
      doc.roundedRect(x + pad, y + pad, badgeTextW + 7, 5.2, 2.6, 2.6, 'F');
      doc.setTextColor(...badgeTone);
      doc.text(badgeLabel, x + pad + 3.5, y + pad + 3.7, { charSpace: 0.4 });

      // Usage title: small caps feel (uppercase + tracking), like the cards'.
      doc.setFontSize(8.5);
      setF('medium');
      doc.setTextColor(...PRIMARY);
      doc.text(truncateToWidth(card.name.toUpperCase(), textMaxWidth, 0.3), x + pad, y + pad + 11, {
        charSpace: 0.3,
      });

      // Measure the unit first, at its own font, so the value can be
      // truncated to leave it exactly enough room. jsPDF has no CSS-style
      // "shrink to fit" layout, so this order is what keeps them from overlapping.
      let unitWidth = 0;
      if (card.unit) {
        doc.setFontSize(9);
        setF('medium');
        unitWidth = doc.getTextWidth(card.unit);
      }

      doc.setFontSize(16);
      setF('light');
      doc.setTextColor(...PRIMARY);
      const valueMaxWidth = textMaxWidth - (card.unit ? unitWidth + 2 : 0);
      const valueText = truncateToWidth(`${card.value}`, valueMaxWidth);
      doc.text(valueText, x + pad, y + pad + 19.5);
      const valueWidth = doc.getTextWidth(valueText);

      if (card.unit) {
        doc.setFontSize(9);
        setF('medium');
        doc.setTextColor(...BLUE);
        doc.text(card.unit, x + pad + valueWidth + 2, y + pad + 19.5);
      }

      if (card.detail) {
        doc.setFontSize(7.5);
        // The site renders a typography style ("Italic") in italics — do too.
        setF(isTypography ? 'italic' : 'normal');
        doc.setTextColor(...SECONDARY);
        doc.text(truncateToWidth(card.detail, textMaxWidth), x + pad, y + pad + 25);
      }

      // Preview strip (the h-16 bg-blue/5 rounded box on the site).
      const stripH = 13.5;
      const stripY = y + cardH - pad - stripH;
      const stripBg = blend(BLUE, 0.08, cardBg);
      doc.setFillColor(...stripBg);
      doc.roundedRect(x + pad, stripY, cellW - pad * 2, stripH, 4.5, 4.5, 'F');

      if (card.preview.kind === 'brush') {
        // The brush bar: 16mm wide (the site's w-16), as thick as the norm's
        // size (px→mm, clamped to the strip), opacity flattened into the color
        // since jsPDF's stable API has none. Then the brush name in blue.
        const barW = 16;
        const barH = Math.min(
          Math.max((Number.isFinite(card.preview.size) ? card.preview.size : 2) * 0.26, 0.6),
          6.5,
        );
        const opacity = Math.min(Math.max(card.preview.opacity, 0), 1);
        doc.setFillColor(...blend(PRIMARY, opacity, stripBg));
        doc.roundedRect(
          x + cellW / 2 - barW / 2,
          stripY + 4.7 - barH / 2,
          barW,
          barH,
          barH / 2,
          barH / 2,
          'F',
        );
        doc.setFontSize(6);
        setF('bold');
        doc.setTextColor(...BLUE);
        doc.text(
          truncateToWidth(card.preview.brushName.toUpperCase(), cellW - pad * 2 - 8, 0.4),
          x + cellW / 2,
          stripY + stripH - 2.6,
          { align: 'center', charSpace: 0.4 },
        );
      } else {
        // The AaBbCc specimen. Helvetica stands in for the actual family
        // (jsPDF can't load arbitrary web fonts), but the style carries over.
        doc.setFontSize(13);
        if (specimenFamilies.has(card.preview.fontFamily)) {
          // The fetched file already matches the norm's weight/style.
          doc.setFont(card.preview.fontFamily, 'normal');
        } else {
          setF(card.preview.fontStyle ? 'italic' : 'normal');
        }
        doc.setTextColor(...PRIMARY);
        doc.text('AaBbCc', x + cellW / 2, stripY + stripH / 2 + 2, { align: 'center' });
      }
    });
    y += cardH + 10;
  }

  // ---- Footer on EVERY page ----------------------------------------------
  // Pinned to the bottom (content stops at CONTENT_BOTTOM): the Shared
  // reference sheet's footer — a hairline, the logo left, the credit right.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LIGHT_RULE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 278, MARGIN + CONTENT_WIDTH, 278);
    if (logoDataUrl) {
      const logoH = 7;
      const logoW = logoH * (2244 / 1148); // the source PNG's aspect ratio
      doc.addImage(logoDataUrl, 'PNG', MARGIN, 281, logoW, logoH);
    }
    doc.setFontSize(8);
    setF('normal');
    doc.setTextColor(...SECONDARY);
    doc.text(
      'Made with FrameSet — the graphic reference for your projects.',
      MARGIN + CONTENT_WIDTH,
      284.5,
      { align: 'right' },
    );
  }

  return doc;
}
