/**
 * Palette importers — the exact mirror of the exporters in paletteExport.js:
 *
 * - .gpl       GIMP palette (text) — Krita, GIMP, Inkscape, Aseprite.
 * - .ase       Adobe Swatch Exchange (binary, big-endian) — Photoshop,
 *              Illustrator, Affinity, Clip Studio Paint.
 * - .swatches  Procreate palette — a ZIP holding a Swatches.json of HSB
 *              entries (STORE or DEFLATE, both handled).
 *
 * All parsing happens client-side on user-picked files. Defensive by design:
 * a hard size cap before any bytes are read, bounds checks on every offset,
 * unrecognized entries counted as `skipped` rather than failing the import,
 * and clear user-facing errors for files that aren't palettes at all.
 */

// A real palette file is a few KB; anything above this is not a palette.
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

const toHexChannel = (value) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

const rgbToHex = (r, g, b) => `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;

// HSB (each in [0, 1], the encoding Procreate uses) -> RGB 0-255.
const hsbToRgb = ({ h, s, b }) => {
  const sector = Math.floor(h * 6);
  const fraction = h * 6 - sector;
  const p = b * (1 - s);
  const q = b * (1 - fraction * s);
  const t = b * (1 - (1 - fraction) * s);
  const [red, green, blue] = [
    [b, t, p],
    [q, b, p],
    [p, b, t],
    [p, q, b],
    [t, p, b],
    [b, p, q],
  ][((sector % 6) + 6) % 6];
  return { r: red * 255, g: green * 255, b: blue * 255 };
};

/**
 * GIMP palette (.gpl): a "GIMP Palette" header, optional Name:/Columns:/#
 * lines, then one "R G B<tab>Name" line per color. Invalid color lines are
 * counted as skipped; a missing header means this is not a .gpl at all.
 */
export function parseGplPalette(text) {
  const lines = String(text).split(/\r?\n/);
  if (!/^GIMP Palette/i.test((lines[0] || '').trim())) {
    throw new Error('This is not a GIMP palette (.gpl) file.');
  }

  const colors = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || /^(Name|Columns):/i.test(trimmed)) {
      continue;
    }
    // Channels first (whitespace-separated), then the name (after the tab the
    // exporter writes, or whatever follows the third channel otherwise).
    const match = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:[\t ]+(.*))?$/.exec(trimmed);
    const channels = match ? [match[1], match[2], match[3]].map(Number) : null;
    if (!channels || channels.some((channel) => channel > 255)) {
      skipped += 1;
      continue;
    }
    colors.push({ name: (match[4] || '').trim(), hex: rgbToHex(...channels) });
  }

  return { colors, skipped };
}

/**
 * Adobe Swatch Exchange (.ase): "ASEF" signature, version, then blocks. Only
 * RGB color entries import; other color models (CMYK, LAB, Gray) and group
 * blocks are counted as skipped. Truncated files fail with a clear error.
 */
export function parseAsePalette(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || view.getUint32(0) !== 0x41534546 /* "ASEF" */) {
    throw new Error('This is not an Adobe Swatch Exchange (.ase) file.');
  }

  const blockCount = view.getUint32(8);
  const colors = [];
  let skipped = 0;
  let offset = 12;

  for (let block = 0; block < blockCount && offset + 6 <= bytes.byteLength; block += 1) {
    const blockType = view.getUint16(offset);
    const bodyStart = offset + 6;
    const bodyEnd = bodyStart + view.getUint32(offset + 2);
    if (bodyEnd > bytes.byteLength) {
      throw new Error('This .ase file is truncated or corrupted.');
    }

    if (blockType === 0x0001) {
      const nameUnits = view.getUint16(bodyStart);
      const modelStart = bodyStart + 2 + nameUnits * 2;
      let name = '';
      for (let i = 0; i < nameUnits - 1; i += 1) {
        name += String.fromCharCode(view.getUint16(bodyStart + 2 + i * 2));
      }
      const model = String.fromCharCode(
        bytes[modelStart],
        bytes[modelStart + 1],
        bytes[modelStart + 2],
        bytes[modelStart + 3],
      );
      if (model === 'RGB ') {
        colors.push({
          name,
          hex: rgbToHex(
            view.getFloat32(modelStart + 4) * 255,
            view.getFloat32(modelStart + 8) * 255,
            view.getFloat32(modelStart + 12) * 255,
          ),
        });
      } else {
        skipped += 1;
      }
    }

    offset = bodyEnd;
  }

  return { colors, skipped };
}

// Little-endian ZIP reading, just enough for a palette archive: locate the end
// of central directory, walk the central directory to the wanted entry, then
// return its (possibly DEFLATE-compressed) bytes.
const readZipEntry = async (bytes, entryName) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const scanFloor = Math.max(0, bytes.byteLength - 22 - 65535);
  for (let i = bytes.byteLength - 22; i >= scanFloor; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let entry = 0; entry < entryCount && offset + 46 <= bytes.byteLength; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) return null;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    if (name === entryName || name.endsWith(`/${entryName}`)) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) return null;
      const dataStart =
        localOffset +
        30 +
        view.getUint16(localOffset + 26, true) +
        view.getUint16(localOffset + 28, true);
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data;
      if (method === 8) {
        const stream = new Blob([data])
          .stream()
          .pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }
      return null;
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return null;
};

/**
 * Procreate palette (.swatches): a ZIP holding Swatches.json — an array of
 * { name, swatches: [{ hue, saturation, brightness } | null] } in HSB [0, 1].
 * The null padding entries real Procreate files contain are ignored; invalid
 * non-null entries are counted as skipped. Procreate stores no per-color
 * names, so imported colors arrive unnamed.
 */
export async function parseProcreateSwatches(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const notProcreate = new Error('This is not a Procreate palette (.swatches) file.');

  let parsed;
  try {
    const entry = await readZipEntry(bytes, 'Swatches.json');
    if (!entry) throw notProcreate;
    parsed = JSON.parse(new TextDecoder().decode(entry));
  } catch {
    throw notProcreate;
  }

  const swatches = (Array.isArray(parsed) ? parsed[0] : parsed)?.swatches;
  if (!Array.isArray(swatches)) throw notProcreate;

  const colors = [];
  let skipped = 0;
  for (const swatch of swatches) {
    if (swatch === null || swatch === undefined) continue; // grid padding
    const { hue, saturation, brightness } = swatch;
    const valid = [hue, saturation, brightness].every(
      (component) => typeof component === 'number' && component >= 0 && component <= 1,
    );
    if (!valid) {
      skipped += 1;
      continue;
    }
    const rgb = hsbToRgb({ h: hue, s: saturation, b: brightness });
    colors.push({ name: '', hex: rgbToHex(rgb.r, rgb.g, rgb.b) });
  }

  return { colors, skipped };
}

/**
 * Parses a user-picked palette file by extension. Resolves { colors, skipped };
 * rejects with a user-facing message for oversized, unsupported or malformed files.
 */
export async function parsePaletteFile(file) {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('This file is too large to be a palette (1 MB maximum).');
  }

  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.gpl')) {
    return parseGplPalette(await file.text());
  }
  if (name.endsWith('.ase')) {
    return parseAsePalette(new Uint8Array(await file.arrayBuffer()));
  }
  if (name.endsWith('.swatches')) {
    return parseProcreateSwatches(new Uint8Array(await file.arrayBuffer()));
  }
  throw new Error('Unsupported file type — use .ase, .gpl or .swatches.');
}
