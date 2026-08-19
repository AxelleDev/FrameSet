export function extractColorsFromImage(file, maxColors = 8) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        // Downscale for speed; sampling a small version is plenty for a palette.
        const maxDimension = 160;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);

        // Group pixels into 16-levels-per-channel buckets, accumulating sums so
        // each bucket can be reduced to its average color.
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 125) continue; // skip mostly-transparent pixels
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = { count: 0, r: 0, g: 0, b: 0 };
            buckets.set(key, bucket);
          }
          bucket.count += 1;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
        }

        const averaged = Array.from(buckets.values())
          .map((bucket) => ({
            count: bucket.count,
            r: Math.round(bucket.r / bucket.count),
            g: Math.round(bucket.g / bucket.count),
            b: Math.round(bucket.b / bucket.count),
          }))
          .sort((a, b) => b.count - a.count);

        // Keep the most frequent colors, skipping any too close to one already
        // kept (Euclidean RGB distance) so the palette stays varied.
        const picked = [];
        const isDistinct = (color) =>
          picked.every((p) => {
            const dr = p.r - color.r;
            const dg = p.g - color.g;
            const db = p.b - color.b;
            return Math.sqrt(dr * dr + dg * dg + db * db) > 32;
          });

        for (const color of averaged) {
          if (picked.length >= maxColors) break;
          if (isDistinct(color)) picked.push(color);
        }

        const toHex = (n) => n.toString(16).padStart(2, '0');
        const hexes = picked.map((c) => `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase());
        resolve(hexes);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unreadable image'));
    };

    image.src = objectUrl;
  });
}
