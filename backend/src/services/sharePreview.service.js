const path = require('path');
const fs = require('fs');
const { Resvg } = require('@resvg/resvg-js');
const { getSharedProjectByToken } = require('./projectSharing.service');

// Standard Open Graph canvas.
const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 64;

// Design tokens mirrored from the frontend (canvas / primary ink / periwinkle).
const CANVAS = '#F8F9FF';
const INK = '#3C3D48';
const BLUE = '#8994DF';

// One row of swatches; anything beyond the cap collapses into a "+N" tile.
const MAX_SWATCHES = 8;
const SWATCH_TOP = 236;
const SWATCH_HEIGHT = 248;
const SWATCH_GAP = 14;
const SWATCH_RADIUS = 20;

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const FONT_FILES = ['Figtree-Regular.ttf', 'Figtree-Medium.ttf', 'Figtree-Bold.ttf'].map((file) =>
  path.join(ASSETS_DIR, file),
);

// Loaded once; the logo is embedded in the SVG as a data URI.
let logoDataUri = null;
const getLogoDataUri = () => {
  if (!logoDataUri) {
    const buffer = fs.readFileSync(path.join(ASSETS_DIR, 'frameset-logo.png'));
    logoDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
  }
  return logoDataUri;
};

const escapeXml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );

const truncate = (value, max) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

// Same near-white rule as the PDF: swatches lighter than this get a hairline
// border so they don't dissolve into the background.
const hexLuminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

// The swatch row, flush to both margins like the PDF grid: only the gaps
// between tiles are fixed, the tiles share the remaining width equally.
const buildSwatches = (palette) => {
  const shown = palette.slice(0, palette.length > MAX_SWATCHES ? MAX_SWATCHES - 1 : MAX_SWATCHES);
  const overflow = palette.length - shown.length;
  const tiles = overflow > 0 ? shown.length + 1 : shown.length;
  const innerWidth = WIDTH - 2 * MARGIN;
  const tileWidth = (innerWidth - SWATCH_GAP * (tiles - 1)) / tiles;
  const labelY = SWATCH_TOP + SWATCH_HEIGHT + 42;

  const parts = [];
  shown.forEach((color, index) => {
    const x = MARGIN + index * (tileWidth + SWATCH_GAP);
    const needsBorder = hexLuminance(color.hex) > 0.93;
    parts.push(
      `<rect x="${x}" y="${SWATCH_TOP}" width="${tileWidth}" height="${SWATCH_HEIGHT}" rx="${SWATCH_RADIUS}" fill="${escapeXml(color.hex)}"${
        needsBorder ? ` stroke="${INK}" stroke-opacity="0.12" stroke-width="1.5"` : ''
      }/>`,
      `<text x="${x + tileWidth / 2}" y="${labelY}" text-anchor="middle" font-family="Figtree" font-weight="500" font-size="22" fill="${INK}" fill-opacity="0.6">${escapeXml(color.hex.toUpperCase())}</text>`,
    );
  });

  if (overflow > 0) {
    const x = MARGIN + shown.length * (tileWidth + SWATCH_GAP);
    parts.push(
      `<rect x="${x}" y="${SWATCH_TOP}" width="${tileWidth}" height="${SWATCH_HEIGHT}" rx="${SWATCH_RADIUS}" fill="${BLUE}" fill-opacity="0.12"/>`,
      `<text x="${x + tileWidth / 2}" y="${SWATCH_TOP + SWATCH_HEIGHT / 2 + 12}" text-anchor="middle" font-family="Figtree" font-weight="700" font-size="34" fill="${BLUE}">+${overflow}</text>`,
    );
  }

  return parts.join('\n  ');
};

// Fallback panel when the shared project has no palette yet: a soft brand
// band so the card never looks broken or empty.
const buildEmptyPanel = () => {
  const innerWidth = WIDTH - 2 * MARGIN;
  return [
    `<rect x="${MARGIN}" y="${SWATCH_TOP}" width="${innerWidth}" height="${SWATCH_HEIGHT}" rx="${SWATCH_RADIUS}" fill="${BLUE}" fill-opacity="0.10"/>`,
    `<text x="${WIDTH / 2}" y="${SWATCH_TOP + SWATCH_HEIGHT / 2 + 10}" text-anchor="middle" font-family="Figtree" font-weight="500" font-size="28" fill="${BLUE}">A graphic reference sheet</text>`,
  ].join('\n  ');
};

const countLabel = (count, singular) => `${count} ${singular}${count === 1 ? '' : 's'}`;

const buildSharePreviewSvg = ({ name, ownerName, palette, brushNorms, typographyNorms }) => {
  const specsCount = brushNorms.length + typographyNorms.length;
  const metaParts = [`by ${truncate(ownerName, 30)}`];
  if (palette.length > 0) metaParts.push(countLabel(palette.length, 'color'));
  if (specsCount > 0) metaParts.push(countLabel(specsCount, 'spec'));

  // The logo keeps its native 2244x1148 ratio; sized and placed so it clears
  // the hex labels above it.
  const logoHeight = 56;
  const logoWidth = Math.round(logoHeight * (2244 / 1148));

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${CANVAS}"/>
  <text x="${MARGIN}" y="132" font-family="Figtree" font-weight="700" font-size="58" fill="${INK}">${escapeXml(truncate(name, 28))}</text>
  <text x="${MARGIN}" y="184" font-family="Figtree" font-weight="500" font-size="27" fill="${BLUE}">${escapeXml(metaParts.join('  ·  '))}</text>
  ${palette.length > 0 ? buildSwatches(palette) : buildEmptyPanel()}
  <image x="${MARGIN}" y="${HEIGHT - 72}" width="${logoWidth}" height="${logoHeight}" href="${getLogoDataUri()}"/>
  <text x="${WIDTH - MARGIN}" y="${HEIGHT - 34}" text-anchor="end" font-family="Figtree" font-weight="400" font-size="21" fill="${INK}" fill-opacity="0.55">Made with FrameSet — the graphic reference for your projects.</text>
</svg>`;
};

const renderSvgToPng = (svg) => {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      defaultFontFamily: 'Figtree',
      loadSystemFonts: false,
    },
  });
  return Buffer.from(resvg.render().asPng());
};

// Token in, PNG out. Propagates the share lookup's 'not_found' untouched so
// the controller maps revoked/unknown tokens to a 404 exactly like the JSON
// share endpoint does.
const getSharePreviewPngByToken = async (token) => {
  const project = await getSharedProjectByToken(token);
  return renderSvgToPng(buildSharePreviewSvg(project));
};

module.exports = { buildSharePreviewSvg, getSharePreviewPngByToken };
