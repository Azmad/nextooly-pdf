import { TextItem } from "@/lib/mupdf/edit-service";

export const detectColors = (
  line: TextItem,
  canvas: HTMLCanvasElement | null
) => {
  if (!canvas) return { bg: "#ffffff", text: "#000000", palette: ["#000000"], bgPalette: ["#ffffff"] };

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { bg: "#ffffff", text: "#000000", palette: ["#000000"], bgPalette: ["#ffffff"] };

  const x = Math.floor(line.x * canvas.width);
  const y = Math.floor(line.y * canvas.height);
  const w = Math.floor(line.width * canvas.width);
  const h = Math.floor(line.height * canvas.height);

  // 1. BACKGROUND DETECTION
  const padding = 4;
  const bgSamples = [
    { x: x - padding, y: y - padding },
    { x: x + w + padding, y: y - padding },
    { x: x - padding, y: y + h + padding },
    { x: x + w + padding, y: y + h + padding },
    { x: x + w / 2, y: y - padding },
    { x: x + w / 2, y: y + h + padding },
    { x: x - padding, y: y + h / 2 },
    { x: x + w + padding, y: y + h / 2 }
  ];

  const bgCounts: Record<string, number> = {};
  let maxBgCount = 0;
  let bestBg = "#ffffff";

  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

  bgSamples.forEach(pt => {
    if (pt.x < 0 || pt.y < 0 || pt.x >= canvas.width || pt.y >= canvas.height) return;
    const p = ctx.getImageData(pt.x, pt.y, 1, 1).data;
    if (p[3] === 0) return;
    const hex = rgbToHex(p[0], p[1], p[2]);
    bgCounts[hex] = (bgCounts[hex] || 0) + 1;
    if (bgCounts[hex] > maxBgCount) {
      maxBgCount = bgCounts[hex];
      bestBg = hex;
    }
  });

  if (maxBgCount === 0) {
    const p = ctx.getImageData(x, y, 1, 1).data;
    if (p[3] > 0) bestBg = rgbToHex(p[0], p[1], p[2]);
  }

  const sortedBgColors = Object.entries(bgCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, 5);
  if (sortedBgColors.length === 0) sortedBgColors.push("#ffffff");

  // 2. TEXT COLOR DETECTION
  const colorCounts: Record<string, number> = {};
  
  const getDist = (c1: string, c2: string) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
  };

  const scanRows = [0.15, 0.32, 0.50, 0.67, 0.85];
  scanRows.forEach(rowPercent => {
    const rowY = Math.min(y + h - 1, Math.floor(y + (h * rowPercent)));
    if (rowY < 0 || rowY >= canvas.height) return;
    const rowData = ctx.getImageData(x, rowY, w, 1).data;
    for (let i = 0; i < rowData.length; i += 4) {
      if (rowData[i + 3] < 50) continue; 
      const hex = rgbToHex(rowData[i], rowData[i + 1], rowData[i + 2]);
      if (hex === bestBg || getDist(hex, bestBg) < 50) continue;
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
  });

  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, 5);

  return {
    bg: bestBg,
    text: sortedColors[0] || "#000000",
    palette: sortedColors.length > 0 ? sortedColors : ["#000000"],
    bgPalette: sortedBgColors
  };
};