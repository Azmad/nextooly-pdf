import { TextItem } from "@/lib/mupdf/edit-service";

export const detectColors = (
  line: TextItem,
  canvas: HTMLCanvasElement | null
) => {
  if (!canvas) {
    return {
      bg: "#ffffff",
      text: "#000000",
      palette: ["#000000"],
      bgPalette: ["#ffffff"],
      inkBounds: { x: line.x, y: line.y, width: line.width, height: line.height },
    };
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      bg: "#ffffff",
      text: "#000000",
      palette: ["#000000"],
      bgPalette: ["#ffffff"],
      inkBounds: { x: line.x, y: line.y, width: line.width, height: line.height },
    };
  }

  const x = Math.floor(line.x * canvas.width);
  const y = Math.floor(line.y * canvas.height);
  const w = Math.max(1, Math.floor(line.width * canvas.width));
  const h = Math.max(1, Math.floor(line.height * canvas.height));
  const pageToRelX = (px: number) => px / canvas.width;
  const pageToRelY = (py: number) => py / canvas.height;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

  // Quantise a channel to the nearest multiple of Q.
  // Groups similar shades (scanner noise, JPEG artefacts) into the same bucket.
  const Q = 16;
  const q = (v: number) =>
    clamp(Math.round(v / Q) * Q, 0, 255);
  const rgbToHexQ = (r: number, g: number, b: number) =>
    rgbToHex(q(r), q(g), q(b));

  // ── 1. BACKGROUND DETECTION ─────────────────────────────────────────────
  // Sample a horizontal strip above the bbox AND one below.
  // A full strip gives hundreds of samples, so quantised grouping easily
  // finds the dominant background shade even on noisy scanned pages.
  const bgCounts: Record<string, number> = {};

  const sampleStrip = (stripY: number) => {
    if (stripY < 0 || stripY >= canvas.height) return;
    const stripX = Math.max(0, x - 4);
    const stripW = Math.min(canvas.width - stripX, w + 8);
    if (stripW <= 0) return;
    const data = ctx.getImageData(stripX, stripY, stripW, 1).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) continue;
      const hex = rgbToHexQ(data[i], data[i + 1], data[i + 2]);
      bgCounts[hex] = (bgCounts[hex] || 0) + 1;
    }
  };

  // Strip above and below; try multiple rows for robustness
  for (let dy = 2; dy <= 6; dy++) sampleStrip(y - dy);
  for (let dy = 2; dy <= 6; dy++) sampleStrip(y + h + dy);

  // Fallback: sample corners with padding if strips produced nothing
  if (Object.keys(bgCounts).length === 0) {
    const pad = 4;
    [[x - pad, y - pad], [x + w + pad, y - pad],
     [x - pad, y + h + pad], [x + w + pad, y + h + pad]].forEach(([px, py]) => {
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return;
      const p = ctx.getImageData(px, py, 1, 1).data;
      if (p[3] < 10) return;
      const hex = rgbToHexQ(p[0], p[1], p[2]);
      bgCounts[hex] = (bgCounts[hex] || 0) + 1;
    });
  }

  const sortedBg = Object.entries(bgCounts).sort((a, b) => b[1] - a[1]);
  // For scanned docs the background is the lightest frequent shade, not just
  // the most frequent (dark text near the strip could dominate otherwise).
  // Pick the most frequent colour whose perceived brightness > 128.
  let bestBg = sortedBg[0]?.[0] ?? "#ffffff";
  for (const [hex] of sortedBg) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if ((r * 299 + g * 587 + b * 114) / 1000 > 128) { bestBg = hex; break; }
  }

  const sortedBgColors = sortedBg.map(([hex]) => hex).slice(0, 5);
  if (sortedBgColors.length === 0) sortedBgColors.push("#ffffff");

  // ── 2. TEXT COLOR DETECTION ──────────────────────────────────────────────
  const colorCounts: Record<string, number> = {};

  const getDist = (c1: string, c2: string) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
  };
  const bgR = parseInt(bestBg.slice(1, 3), 16);
  const bgG = parseInt(bestBg.slice(3, 5), 16);
  const bgB = parseInt(bestBg.slice(5, 7), 16);
  const getDistToBg = (r: number, g: number, b: number) =>
    Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

  const scanRows = [0.15, 0.32, 0.50, 0.67, 0.85];
  scanRows.forEach(rowPercent => {
    const rowY = Math.min(y + h - 1, Math.floor(y + h * rowPercent));
    if (rowY < 0 || rowY >= canvas.height) return;
    const rowData = ctx.getImageData(x, rowY, w, 1).data;
    for (let i = 0; i < rowData.length; i += 4) {
      if (rowData[i + 3] < 50) continue;
      const hex = rgbToHex(rowData[i], rowData[i + 1], rowData[i + 2]);
      if (getDist(hex, bestBg) < 60) continue; // skip background-like pixels
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
  });

  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, 5);

  // Tighten the erase box to the visible "ink" region instead of the full
  // extracted line bbox. This avoids obvious background bands on clean PDFs.
  const rowCounts = new Array(h).fill(0);
  const colCounts = new Array(w).fill(0);
  const INK_THRESHOLD = 52;

  for (let py = 0; py < h; py++) {
    const rowData = ctx.getImageData(x, y + py, w, 1).data;
    for (let px = 0; px < w; px++) {
      const idx = px * 4;
      if (rowData[idx + 3] < 40) continue;
      if (getDistToBg(rowData[idx], rowData[idx + 1], rowData[idx + 2]) < INK_THRESHOLD) continue;
      rowCounts[py]++;
      colCounts[px]++;
    }
  }

  const rowPeak = Math.max(...rowCounts, 0);
  const colPeak = Math.max(...colCounts, 0);
  let inkBounds = { x: line.x, y: line.y, width: line.width, height: line.height };

  if (rowPeak > 0 && colPeak > 0) {
    const minRowHits = Math.max(2, Math.floor(rowPeak * 0.12));
    const minColHits = Math.max(2, Math.floor(colPeak * 0.12));

    let top = rowCounts.findIndex((count) => count >= minRowHits);
    let bottom = rowCounts.length - 1 - [...rowCounts].reverse().findIndex((count) => count >= minRowHits);
    let left = colCounts.findIndex((count) => count >= minColHits);
    let right = colCounts.length - 1 - [...colCounts].reverse().findIndex((count) => count >= minColHits);

    if (top >= 0 && bottom >= top && left >= 0 && right >= left) {
      const padX = clamp(Math.round(w * 0.01), 1, 3);
      const padY = clamp(Math.round(h * 0.06), 1, 4);

      left = clamp(left - padX, 0, w - 1);
      right = clamp(right + padX, left + 1, w);
      top = clamp(top - padY, 0, h - 1);
      bottom = clamp(bottom + padY, top + 1, h);

      const inkPixelWidth = Math.max(1, right - left);
      const inkPixelHeight = Math.max(1, bottom - top);
      const inkAreaRatio = (inkPixelWidth * inkPixelHeight) / (w * h);

      // Only trust the refined bounds if they materially tighten the patch.
      if (inkAreaRatio < 0.9) {
        inkBounds = {
          x: pageToRelX(x + left),
          y: pageToRelY(y + top),
          width: pageToRelX(inkPixelWidth),
          height: pageToRelY(inkPixelHeight),
        };
      }
    }
  }

  return {
    bg: bestBg,
    text: sortedColors[0] || "#000000",
    palette: sortedColors.length > 0 ? sortedColors : ["#000000"],
    bgPalette: sortedBgColors,
    inkBounds,
  };
};
