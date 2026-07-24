/**
 * Palette exporters for the formats drawing tools actually import — pure
 * builders (bytes in, bytes out), kept out of the view for unit testing:
 *
 * - .gpl       GIMP palette (text) — Krita, GIMP, Inkscape, Aseprite.
 * - .ase       Adobe Swatch Exchange (binary, big-endian) — Photoshop,
 *              Illustrator, Affinity, Clip Studio Paint.
 * - .swatches  Procreate palette — a ZIP archive holding a Swatches.json of
 *              HSB entries. Built with a dependency-free STORE-only ZIP writer
 *              (same spirit as extractColors: ~60 lines beat a whole library).
 */

// Procreate palettes are a fixed 30-slot grid; extra colors don't import.
export const PROCREATE_MAX_SWATCHES = 30;

// Parses a 3- or 6-digit hex color into 0-255 channels. Input is assumed
// already validated by the palette editor (see hex.js), so this only needs to
// normalize, not defend.
export function hexToRgb(hex) {
  let value = String(hex || '')
    .trim()
    .replace(/^#/, '');
  if (value.length === 3) {
    value = value.replace(/./g, (char) => char + char);
  }
  const number = parseInt(value, 16);
  return {
    r: (number >> 16) & 0xff,
    g: (number >> 8) & 0xff,
    b: number & 0xff,
  };
}

// RGB (0-255) -> HSB, each component in [0, 1] — the encoding Procreate uses.
export function rgbToHsb({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue /= 6;
    if (hue < 0) hue += 1;
  }

  return {
    h: hue,
    s: max === 0 ? 0 : delta / max,
    b: max,
  };
}

/**
 * GIMP palette (.gpl): a plain-text header followed by one "R G B<tab>Name"
 * line per color. Channels are right-aligned to 3 columns, matching the files
 * GIMP itself writes.
 */
export function buildGplPalette(paletteName, colors) {
  const lines = [
    'GIMP Palette',
    `Name: ${paletteName}`,
    'Columns: 0',
    '#',
    ...colors.map((color) => {
      const { r, g, b } = hexToRgb(color.hex);
      const channels = [r, g, b].map((c) => String(c).padStart(3, ' ')).join(' ');
      return `${channels}\t${color.name || color.hex}`;
    }),
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Adobe Swatch Exchange (.ase): big-endian binary — "ASEF" signature, version
 * 1.0, then one block per color: UTF-16BE null-terminated name, "RGB " color
 * model, three float32 channels in [0, 1], and the "normal" color type.
 */
export function buildAsePalette(colors) {
  const encodeBlock = (color) => {
    // Name length is counted in UTF-16 code units, null terminator included.
    const name = String(color.name || color.hex);
    const nameUnits = name.length + 1;
    const blockBodySize = 2 + nameUnits * 2 + 4 + 12 + 2;
    // Block header (type + length) + body.
    const block = new DataView(new ArrayBuffer(6 + blockBodySize));
    let offset = 0;

    block.setUint16(offset, 0x0001); // block type: color entry
    offset += 2;
    block.setUint32(offset, blockBodySize);
    offset += 4;
    block.setUint16(offset, nameUnits);
    offset += 2;
    for (let i = 0; i < name.length; i += 1) {
      block.setUint16(offset, name.charCodeAt(i));
      offset += 2;
    }
    block.setUint16(offset, 0); // name terminator
    offset += 2;
    // Color model: "RGB " (trailing space is part of the format).
    for (const char of 'RGB ') {
      block.setUint8(offset, char.charCodeAt(0));
      offset += 1;
    }
    const { r, g, b } = hexToRgb(color.hex);
    for (const channel of [r / 255, g / 255, b / 255]) {
      block.setFloat32(offset, channel);
      offset += 4;
    }
    block.setUint16(offset, 0x0002); // color type: normal (not global/spot)

    return new Uint8Array(block.buffer);
  };

  const blocks = colors.map(encodeBlock);
  const blocksSize = blocks.reduce((total, block) => total + block.byteLength, 0);

  const file = new Uint8Array(12 + blocksSize);
  const header = new DataView(file.buffer);
  file.set([0x41, 0x53, 0x45, 0x46], 0); // "ASEF"
  header.setUint16(4, 1); // version major
  header.setUint16(6, 0); // version minor
  header.setUint32(8, blocks.length);

  let offset = 12;
  for (const block of blocks) {
    file.set(block, offset);
    offset += block.byteLength;
  }

  return file;
}

// CRC-32 (IEEE), required by the ZIP format for each stored entry.
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Minimal ZIP writer, STORE only (no compression): local file headers, central
 * directory, end-of-central-directory. Palette JSONs are tiny, so compression
 * would buy nothing and cost a dependency.
 */
export function buildZipStore(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = entry.data instanceof Uint8Array ? entry.data : encoder.encode(entry.data);
    const checksum = crc32(dataBytes);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0, true); // flags
    local.setUint16(8, 0, true); // method: STORE
    local.setUint16(10, 0, true); // mod time
    local.setUint16(12, 0, true); // mod date
    local.setUint32(14, checksum, true);
    local.setUint32(18, dataBytes.length, true); // compressed size
    local.setUint32(22, dataBytes.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra field length
    localParts.push(new Uint8Array(local.buffer), nameBytes, dataBytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // central directory signature
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0, true); // flags
    central.setUint16(10, 0, true); // method: STORE
    central.setUint16(12, 0, true); // mod time
    central.setUint16(14, 0, true); // mod date
    central.setUint32(16, checksum, true);
    central.setUint32(20, dataBytes.length, true);
    central.setUint32(24, dataBytes.length, true);
    central.setUint16(28, nameBytes.length, true);
    // Extra/comment/disk/attributes: all zero.
    central.setUint32(42, offset, true); // local header offset
    centralParts.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory signature
  end.setUint16(8, entries.length, true); // entries on this disk
  end.setUint16(10, entries.length, true); // entries total
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true); // central directory offset

  const parts = [...localParts, ...centralParts, new Uint8Array(end.buffer)];
  const file = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) {
    file.set(part, position);
    position += part.length;
  }
  return file;
}

/**
 * Procreate palette (.swatches): a ZIP archive with a single Swatches.json —
 * an array of { name, swatches: [{ hue, saturation, brightness, alpha,
 * colorSpace }] } in HSB [0, 1]. Capped at Procreate's 30-slot grid; the
 * caller can warn when colors were dropped.
 */
export function buildProcreateSwatches(paletteName, colors) {
  const swatches = colors.slice(0, PROCREATE_MAX_SWATCHES).map((color) => {
    const { h, s, b } = rgbToHsb(hexToRgb(color.hex));
    return {
      hue: h,
      saturation: s,
      brightness: b,
      alpha: 1,
      colorSpace: 0,
    };
  });

  const payload = JSON.stringify([{ name: paletteName, swatches }]);
  return buildZipStore([{ name: 'Swatches.json', data: payload }]);
}
