/*
 * Nextooly – Online PDF Tools
 * Copyright (C) 2026 Nextooly
 *
 * This file is part of the Nextooly PDF Tools project.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { loadMuPDF } from "./client";
import {
  PDFDocument, rgb, degrees, StandardFonts, PDFFont, PageSizes, PDFBool,
  PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList,
  PDFName, PDFDict, PDFArray, PDFRef // <--- ADD PDFRef HERE
} from "pdf-lib";
import fontkit from '@pdf-lib/fontkit';

export type RenderResult = {
  imageData: ImageData;
  width: number;
  height: number;
};

export type PdfFormField = {
  id: string; // Unique ID (usually field name)
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "button";
  pageIndex: number;
  x: number; // 0-1 relative coordinates
  y: number;
  width: number;
  height: number;
  value?: string | boolean | number;
  options?: string[]; // For dropdowns/radio
  isReadOnly?: boolean;
};

export async function getPdfFormFields(fileBuffer: ArrayBuffer): Promise<PdfFormField[]> {
  try {
    const doc = await PDFDocument.load(fileBuffer);
    const form = doc.getForm();
    const fields = form.getFields();
    const pages = doc.getPages();

    const widgetLocationMap = new Map<string, { pageIndex: number; rect: any }>();
    pages.forEach((page, pageIndex) => {
      const annots = page.node.Annots();
      if (!annots || !(annots instanceof PDFArray)) return;
      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);

        if (annotRef instanceof PDFRef) {
          const annotDict = doc.context.lookup(annotRef);

          if (annotDict instanceof PDFDict) {
            const subtype = annotDict.get(PDFName.of("Subtype"));

            if (subtype?.toString() === "/Widget") {
              const rectArr = annotDict.get(PDFName.of("Rect"));

              if (rectArr instanceof PDFArray) {
                const r = rectArr.asRectangle();
                const cropBox = page.getCropBox() || page.getMediaBox();
                const pageWidth = cropBox.width;
                const pageHeight = cropBox.height;

                widgetLocationMap.set(annotRef.toString(), {
                  pageIndex,
                  rect: {
                    x: (r.x - cropBox.x) / pageWidth,
                    y: (pageHeight - (r.y - cropBox.y) - r.height) / pageHeight,
                    width: r.width / pageWidth,
                    height: r.height / pageHeight
                  }
                });
              }
            }
          }
        }
      }
    });

    const extracted: PdfFormField[] = [];
    for (const field of fields) {
      const name = field.getName();
      const refsToSearch: PDFRef[] = [];
      const kids = field.acroField.dict.get(PDFName.of('Kids'));

      if (kids instanceof PDFArray) {
        for (let i = 0; i < kids.size(); i++) {
          const kid = kids.get(i);
          if (kid instanceof PDFRef) refsToSearch.push(kid);
        }
      } else {
        if (field.ref instanceof PDFRef) refsToSearch.push(field.ref);
      }
      refsToSearch.forEach((ref, index) => {
        const loc = widgetLocationMap.get(ref.toString());
        if (loc) {
          let type: PdfFormField["type"] = "text";
          let value: any = undefined;
          let options: string[] = [];

          if (field instanceof PDFTextField) {
            type = "text";
            value = field.getText();
          } else if (field instanceof PDFCheckBox) {
            type = "checkbox";
            value = field.isChecked();
          } else if (field instanceof PDFRadioGroup) {
            type = "radio";
            value = field.getSelected();
            try {
              const widgetDict = doc.context.lookup(ref);
              if (widgetDict instanceof PDFDict) {
                const ap = widgetDict.get(PDFName.of('AP'));
                if (ap instanceof PDFDict) {
                  const n = ap.get(PDFName.of('N'));
                  if (n instanceof PDFDict) {
                    const keys = n.keys().map(k => k.decodeText());
                    const onValue = keys.find(k => k !== 'Off');
                    if (onValue) {
                      options = [onValue];
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Error parsing radio value", e);
            }

            if (options.length === 0) {
              options = field.getOptions();
            }

          } else if (field instanceof PDFDropdown) {
            type = "dropdown";
            value = field.getSelected()[0];
            options = field.getOptions();
          }

          extracted.push({
            id: `${name}-${index}`,
            name,
            type,
            pageIndex: loc.pageIndex,
            x: loc.rect.x,
            y: loc.rect.y,
            width: loc.rect.width,
            height: loc.rect.height,
            value,
            options,
            isReadOnly: field.isReadOnly()
          });
        }
      });
    }
    return extracted;
  } catch (err) {
    console.error("Error extracting form fields:", err);
    return [];
  }
}

type TextRun = {
  text: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  color: string;
  font: string;
  size: number;
};

function normalizeColorToHex(colorStr: string): string | null {
  if (!colorStr) return null;
  const s = colorStr.trim();
  if (s.startsWith("#")) return s;
  if (s.startsWith("rgb")) {
    const match = s.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  return null;
}

function safeHexToRgb01(hex: string) {
  const c = hex?.startsWith("#") ? hex : "#000000";
  const r = parseInt(c.slice(1, 3), 16) / 255;
  const g = parseInt(c.slice(3, 5), 16) / 255;
  const b = parseInt(c.slice(5, 7), 16) / 255;
  return rgb(isFinite(r) ? r : 0, isFinite(g) ? g : 0, isFinite(b) ? b : 0);
}

function parseRichText(html: string, baseStyle: { color: string; isBold: boolean; isItalic: boolean; isUnderline: boolean; font: string; size: number }): TextRun[] {
  if (!html) return [];
  const div = document.createElement("div");
  div.innerHTML = html;
  const runs: TextRun[] = [];
  const traverse = (node: Node, currentStyle: typeof baseStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        runs.push({ text: text, ...currentStyle });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (el.tagName === "BR") {
        runs.push({ text: "\n", ...currentStyle });
        return;
      }
      const isBlock = ["DIV", "P", "LI"].includes(el.tagName);
      if (isBlock && runs.length > 0 && runs[runs.length - 1].text !== "\n") {
        runs.push({ text: "\n", ...currentStyle });
      }

      const newStyle = { ...currentStyle };
      const fw = el.style.fontWeight;
      if (fw === "normal" || (parseInt(fw) < 400 && fw !== "")) newStyle.isBold = false;
      else if (["B", "STRONG"].includes(el.tagName) || fw === "bold" || parseInt(fw) >= 600) newStyle.isBold = true;

      // 2. Italic
      const fs = el.style.fontStyle;
      if (fs === "italic" || ["I", "EM"].includes(el.tagName)) newStyle.isItalic = true;
      else if (fs === "normal") newStyle.isItalic = false;

      // 3. Underline
      if (el.style.textDecoration.includes("underline") || el.tagName === "U") newStyle.isUnderline = true;

      // 4. Color
      let foundColor = normalizeColorToHex(el.style.color) || (el.hasAttribute("color") ? normalizeColorToHex(el.getAttribute("color") || "") : null);
      if (foundColor) newStyle.color = foundColor;
      const fSize = el.style.fontSize;
      if (fSize) {
        if (fSize.endsWith("em")) {
          newStyle.size *= parseFloat(fSize);
        } else if (fSize.endsWith("%")) {
          newStyle.size *= (parseFloat(fSize) / 100);
        }
      }

      node.childNodes.forEach(child => traverse(child, newStyle));
    }
  };

  traverse(div, baseStyle);
  return runs;
}

function wrapRichText(
  runs: TextRun[],
  maxWidth: number,
  fontMap: Map<string, PDFFont>,
  baseFontName: string
): TextRun[][] {
  const lines: TextRun[][] = [];
  let currentLine: TextRun[] = [];
  let currentLineWidth = 0;

  for (const run of runs) {
    // 1. Handle Explicit Newlines
    if (run.text === "\n") {
      lines.push(currentLine);
      currentLine = [];
      currentLineWidth = 0;
      continue;
    }
    const words = run.text.split(/(\s+)/);

    for (const word of words) {
      if (word === "") continue;
      const fontKey = run.isBold ? `${baseFontName}_bold` : baseFontName;
      const font = fontMap.get(fontKey) || fontMap.get(baseFontName);
      let wordWidth = 0;
      try {
        wordWidth = font ? font.widthOfTextAtSize(word, run.size) : 0;
      } catch (e) { wordWidth = 0; }

      // 3. Check Wrapping
      if (currentLineWidth + wordWidth > maxWidth && currentLineWidth > 0 && word.trim() !== "") {
        // Wrap to next line
        lines.push(currentLine);
        currentLine = [];
        currentLineWidth = 0;
      }

      const lastRun = currentLine[currentLine.length - 1];
      if (lastRun &&
        lastRun.isBold === run.isBold &&
        lastRun.color === run.color &&
        lastRun.size === run.size &&
        lastRun.font === run.font) {
        lastRun.text += word;
      } else {
        currentLine.push({ ...run, text: word });
      }

      currentLineWidth += wordWidth;
    }
  }

  if (currentLine.length > 0) lines.push(currentLine);

  return lines;
}

// Helper to measure width of a specific run
function getRunWidth(run: TextRun, fontMap: Map<string, PDFFont>, baseFontName: string): number {
  const fontKey = run.isBold ? `${baseFontName}_bold` : baseFontName;
  const font = fontMap.get(fontKey) || fontMap.get(baseFontName); // Fallback
  if (!font) return 0;

  try {
    return font.widthOfTextAtSize(run.text, run.size);
  } catch (e) { return 0; }
}

export type TextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
  color?: string | null;
  isBold?: boolean;
  lineHeight?: number;
};

export const AVAILABLE_FONTS = [
  { name: "Helvetica (Sans-Serif)", value: "Helvetica", type: "standard" },
  { name: "Times Roman (Serif)", value: "Times Roman", type: "standard" },
  { name: "Courier (Monospace)", value: "Courier", type: "standard" },
];

// --- Helper: Get Page Count ---
export async function getPdfPageCount(fileBuffer: ArrayBuffer): Promise<number> {
  const mupdf = await loadMuPDF();
  const doc = mupdf.PDFDocument.openDocument(fileBuffer, "application/pdf");
  try {
    return doc.countPages();
  } finally {
    doc.destroy();
  }
}

function toHexColor(colorVal: any): string | null {
  if (colorVal === undefined || colorVal === null) return null;
  if (Array.isArray(colorVal) && colorVal.length >= 3) {
    const r = colorVal[0];
    const g = colorVal[1];
    const b = colorVal[2];

    const isNormalized = (r <= 1 && g <= 1 && b <= 1 && (r > 0 || g > 0 || b > 0));
    const scale = isNormalized ? 255 : 1;

    const toHex = (n: number) => Math.round(n * scale).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  if (typeof colorVal === "number") {
    try {
      const hex = Math.floor(colorVal).toString(16);
      return "#" + "000000".substring(0, 6 - hex.length) + hex;
    } catch (e) { return null; }
  }

  if (typeof colorVal === "string") {
    return colorVal.startsWith("#") ? colorVal : `#${colorVal}`;
  }
  return null;
}

export async function getPageText(
  fileBuffer: ArrayBuffer,
  pageIndex: number,
  mode: "block" | "line" = "block"
): Promise<TextItem[]> {
  const mupdf = await loadMuPDF();
  const doc = mupdf.PDFDocument.openDocument(fileBuffer, "application/pdf");

  try {
    const page = doc.loadPage(pageIndex);
    const bounds = page.getBounds();
    const pageWidth = bounds[2] - bounds[0];
    const pageHeight = bounds[3] - bounds[1];

    let structuredText = page.toStructuredText();
    let data: any;

    if (structuredText && typeof structuredText.asJSON === 'function') {
      try { data = JSON.parse(structuredText.asJSON()); } catch (e) { return []; }
    } else {
      data = structuredText;
    }
    if (!data || !data.blocks) return [];
    const textItems: TextItem[] = [];
    for (const block of data.blocks) {
      if (!block.lines || !Array.isArray(block.lines) || block.lines.length === 0) continue;
      const processedLines = block.lines.map((line: any) => {
        if (!line.text || !line.text.trim()) return null;

        let lx = 0, ly = 0, lw = 0, lh = 0;
        if (line.bbox) {
          if (Array.isArray(line.bbox)) {
            lx = line.bbox[0]; ly = line.bbox[1]; lw = line.bbox[2] - line.bbox[0]; lh = line.bbox[3] - line.bbox[1];
          } else {
            lx = line.bbox.x; ly = line.bbox.y; lw = line.bbox.w; lh = line.bbox.h;
          }
        }

        const fontSize = line.font?.size || 12;
        const tightHeight = fontSize * 1.45;
        const verticalCorrection = fontSize * 0.15;
        const originalCenterY = ly + (lh / 2);
        const tightY = originalCenterY - (tightHeight / 2) + verticalCorrection;

        return {
          ...line,
          lx,
          ly: tightY,        // Updated Y position
          lw,
          lh: tightHeight,   // Updated Height
          fontSize
        };
      }).filter((l: any) => l !== null);

      if (processedLines.length === 0) continue;

      if (mode === "line") {
        for (const line of processedLines) {
          const finalX = (line.lx - bounds[0]) / pageWidth;
          const finalY = (line.ly - bounds[1]) / pageHeight;
          const finalW = line.lw / pageWidth;
          const finalH = line.lh / pageHeight;

          const fontName = line.font?.name || "Helvetica";
          const color = toHexColor(line.color);
          const lower = (fontName || "").toLowerCase();
          const isBold = lower.includes("bold") || lower.includes("black");

          textItems.push({
            text: line.text,
            x: finalX,
            y: finalY,
            width: finalW,
            height: finalH,
            fontSize: line.fontSize,
            fontName: fontName,
            color: color,
            isBold: isBold,
            lineHeight: 1.15 // Keep editor text spacing normal
          });
        }
      }
      // --- MODE: BLOCK (Aggregate tight lines) ---
      else {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let fullText = "";
        let dominantFontName = "";
        let dominantFontSize = 0;
        let dominantColor: any = undefined;
        let isBold = false;

        let firstLineY = 0;
        let lastLineY = 0;
        for (let i = 0; i < processedLines.length; i++) {
          const line = processedLines[i];
          fullText += (i === 0 ? "" : "\n") + line.text;

          // Union the TIGHT boxes
          minX = Math.min(minX, line.lx);
          minY = Math.min(minY, line.ly);
          maxX = Math.max(maxX, line.lx + line.lw);
          maxY = Math.max(maxY, line.ly + line.lh);

          if (i === 0) firstLineY = line.ly;
          if (i === processedLines.length - 1) lastLineY = line.ly;

          if (!dominantFontName && line.font) {
            dominantFontName = line.font.name;
            dominantFontSize = line.font.size;
            const lower = (dominantFontName || "").toLowerCase();
            isBold = lower.includes("bold") || lower.includes("black");
          }
          if (dominantColor === undefined && line.color) dominantColor = toHexColor(line.color);
        }
        const finalX = (minX - bounds[0]) / pageWidth;
        const finalY = (minY - bounds[1]) / pageHeight;
        const finalW = (maxX - minX) / pageWidth;
        const finalH = (maxY - minY) / pageHeight;

        let calculatedLineHeight = 1.2;
        if (dominantFontSize > 0 && processedLines.length > 1) {
          const totalDist = Math.abs(lastLineY - firstLineY);
          const avgDist = totalDist / (processedLines.length - 1);
          calculatedLineHeight = avgDist / dominantFontSize;
        }

        if (fullText.trim().length > 0) {
          textItems.push({
            text: fullText,
            x: finalX,
            y: finalY,
            width: finalW,
            height: finalH,
            fontSize: dominantFontSize,
            fontName: dominantFontName,
            color: dominantColor,
            isBold: isBold,
            lineHeight: calculatedLineHeight
          });
        }
      }
    }
    return textItems;
  } catch (e) {
    console.error("Text extraction failed:", e);
    return [];
  } finally {
    if (doc) doc.destroy();
  }
}

export async function renderPageWithMuPDF(
  fileBuffer: ArrayBuffer,
  pageIndex: number,
  scale: number = 1.5
): Promise<RenderResult> {
  if (pageIndex === -1) {
    const w = 595 * scale;
    const h = 842 * scale;
    return { imageData: new ImageData(w, h), width: w, height: h };
  }

  const mupdf = await loadMuPDF();
  const doc = mupdf.PDFDocument.openDocument(fileBuffer, "application/pdf");
  let page: any = null;
  let pixmap: any = null;

  try {
    page = doc.loadPage(pageIndex);
    const matrix = mupdf.Matrix.scale(scale, scale);
    pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
    const width = pixmap.getWidth();
    const height = pixmap.getHeight();
    const samples = pixmap.getPixels();
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgbaData[i * 4] = samples[i * 3];
      rgbaData[i * 4 + 1] = samples[i * 3 + 1];
      rgbaData[i * 4 + 2] = samples[i * 3 + 2];
      rgbaData[i * 4 + 3] = 255;
    }
    return {
      imageData: new ImageData(rgbaData, width, height),
      width,
      height
    };
  } finally {
    if (pixmap) pixmap.destroy();
    if (page) page.destroy();
    if (doc) doc.destroy();
  }
}

function breakTextIntoLines(text: string, size: number, font: PDFFont, maxWidth: number) {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      try {
        const width = font.widthOfTextAtSize(`${currentLine} ${word}`, size);
        if (width < maxWidth) {
          currentLine += ` ${word}`;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      } catch (e) {
        currentLine += ` ${word}`;
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

async function applyRedactionsWithMuPDF(
  fileBuffer: ArrayBuffer,
  redactions: Array<{ originalPageIndex: number; rect: { x: number; y: number; width: number; height: number } }>
): Promise<Uint8Array> {
  const mupdf = await loadMuPDF();

  const opener = mupdf?.PDFDocument?.openDocument ?? mupdf?.Document?.openDocument;
  if (typeof opener !== "function") {
    throw new Error("MuPDF openDocument API not available (expected PDFDocument.openDocument).");
  }

  const doc = opener(fileBuffer, "application/pdf");

  try {
    const byPage = new Map<number, Array<{ x: number; y: number; width: number; height: number }>>();
    for (const r of redactions) {
      if (!byPage.has(r.originalPageIndex)) byPage.set(r.originalPageIndex, []);
      byPage.get(r.originalPageIndex)!.push(r.rect);
    }

    for (const [pageIndex, rects] of byPage.entries()) {
      const page = doc.loadPage(pageIndex);
      try {
        if (typeof page.createAnnotation !== "function") {
          throw new Error("MuPDF build does not expose page.createAnnotation (redaction unsupported in this build).");
        }

        const bounds = page.getBounds ? page.getBounds() : [0, 0, page.getWidth?.() ?? 0, page.getHeight?.() ?? 0];
        const ulx = bounds[0], uly = bounds[1], lrx = bounds[2], lry = bounds[3];
        const pageW = lrx - ulx;
        const pageH = lry - uly;

        for (const rr of rects) {
          const x0 = ulx + rr.x * pageW;
          const y0 = uly + rr.y * pageH;
          const x1 = ulx + (rr.x + rr.width) * pageW;
          const y1 = uly + (rr.y + rr.height) * pageH;

          const left = Math.min(x0, x1);
          const top = Math.min(y0, y1);
          const right = Math.max(x0, x1);
          const bottom = Math.max(y0, y1);

          const annot = page.createAnnotation("Redact");
          try {
            if (typeof annot.setRect === "function") {
              annot.setRect([left, top, right, bottom]);
            } else if (typeof annot.setRectFromQuad === "function") {
              annot.setRectFromQuad([left, top, right, bottom]);
            } else {
              throw new Error("MuPDF redact annotation does not expose setRect.");
            }

            if (typeof annot.applyRedaction === "function") {
              annot.applyRedaction(true);
            } else {
              throw new Error("MuPDF redact annotation does not expose applyRedaction.");
            }
          } finally {
            annot.destroy?.();
          }
        }
      } finally {
        page.destroy?.();
      }
    }

    const buf = doc.saveToBuffer("garbage");
    try {
      const view: Uint8Array =
        typeof buf.asUint8Array === "function"
          ? buf.asUint8Array()
          : buf instanceof Uint8Array
            ? buf
            : new Uint8Array(buf);

      const bytes = new Uint8Array(view); // makes a real JS-owned copy

      if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        throw new Error("MuPDF redaction output does not look like a PDF (missing %PDF header).");
      }

      return bytes;
    } finally {
      buf.destroy?.();
    }
  } finally {
    doc.destroy?.();
  }
}

export async function saveEditedPdf(
  fileBuffer: ArrayBuffer,
  annotations: any[],
  deletedPages: Set<number>,
  pageRotations: Record<number, number>,
  pageOrder: number[],
  metadata: { title?: string; author?: string; subject?: string; keywords?: string; creator?: string; producer?: string },
  options?: { flatten?: boolean; rasterScale?: number; redact?: boolean },
  formValues?: Record<string, string | boolean>
): Promise<Uint8Array> {
  const flatten = !!options?.flatten;
  const rasterScale = Math.min(5, Math.max(1, options?.rasterScale ?? 3));
  const redact = !!options?.redact;

  // 1. Check if the document structure (page count/order) has changed.
  const pageCount = await getPdfPageCount(fileBuffer);
  const isStructureModified =
    deletedPages.size > 0 ||
    pageOrder.length !== pageCount ||
    pageOrder.some((originalIndex, visualIndex) => originalIndex !== visualIndex);

  let workingBuffer: ArrayBuffer = fileBuffer;

  // --------------------------------------------------------------------------
  // STEP 1: PHYSICAL REDACTIONS (MuPDF)
  // --------------------------------------------------------------------------
  if (redact) {
    const redactions = annotations
      .filter((ann) => ann.type === "redact" || (ann.type === "text_edit" && ann.originalBounds))
      .map((ann) => {
        const originalPageIndex = pageOrder[ann.pageIndex];
        const r = ann.type === "text_edit" && ann.originalBounds
          ? ann.originalBounds
          : { x: ann.x, y: ann.y, width: ann.width, height: ann.height };

        return {
          originalPageIndex,
          rect: r,
        };
      })
      .filter((r) => Number.isFinite(r.originalPageIndex) && r.originalPageIndex >= 0)
      .filter((r) => !deletedPages.has(r.originalPageIndex));

    if (redactions.length > 0) {
      try {
        const redactedBytes = await applyRedactionsWithMuPDF(workingBuffer, redactions);
        workingBuffer = redactedBytes.buffer.slice(
          redactedBytes.byteOffset,
          redactedBytes.byteOffset + redactedBytes.byteLength
        ) as ArrayBuffer;
      } catch (e) {
        console.warn("MuPDF Redaction failed, falling back to visual mask only", e);
      }
    }
  }

  //
  // --------------------------------------------------------------------------
  // STEP 2: SETUP PDF-LIB & HANDLE FORMS
  // --------------------------------------------------------------------------
  let originalDoc = await PDFDocument.load(workingBuffer); // <--- CHANGED to 'let'
  originalDoc.registerFontkit(fontkit);

  if (formValues) {
    const form = originalDoc.getForm();
    Object.entries(formValues).forEach(([name, val]) => {
      try {
        const field = form.getField(name);
        if (field instanceof PDFTextField) {
          field.setText(String(val));
        } else if (field instanceof PDFCheckBox && typeof val === 'boolean') {
          val ? field.check() : field.uncheck();
        } else if (field instanceof PDFRadioGroup && typeof val === 'string') {
          field.select(val);
        } else if (field instanceof PDFDropdown && typeof val === 'string') {
          field.select(val);
        }
      } catch (e) {
        // Field might not exist or be mismatch type, ignore
      }
    });

    if (flatten || isStructureModified) {
      try {
        form.flatten();
        const flushedBytes = await originalDoc.save();
        originalDoc = await PDFDocument.load(flushedBytes);
        originalDoc.registerFontkit(fontkit);
      } catch (e) {
        console.warn("Form flattening failed", e);
      }
    } else {
      try {
        const acroForm = originalDoc.catalog.lookup(PDFName.of('AcroForm'));
        if (acroForm && typeof acroForm === 'object' && 'set' in acroForm) {
          // @ts-ignore
          acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True);
        }
      } catch (e) {
        console.warn("Could not set NeedAppearances", e);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3: PREPARE FINAL DOCUMENT (Smart Strategy)
  // --------------------------------------------------------------------------
  let newDoc: PDFDocument; // FIX: Renamed from finalDoc to newDoc to match your existing code
  const pageMap = new Map<number, any>();

  if (isStructureModified) {
    // STRATEGY A: CREATE NEW DOC (If pages reordered/deleted)
    // We must copy pages. Forms are already flattened above so values persist as text.
    newDoc = await PDFDocument.create();
    newDoc.registerFontkit(fontkit);

    // Copy Pages Logic
    for (let visualIdx = 0; visualIdx < pageOrder.length; visualIdx++) {
      const originalIdx = pageOrder[visualIdx];

      if (deletedPages.has(originalIdx)) continue;

      let page;
      if (originalIdx === -1) {
        page = newDoc.addPage(PageSizes.A4);
      } else {
        const [copiedPage] = await newDoc.copyPages(originalDoc, [originalIdx]);
        page = newDoc.addPage(copiedPage);

        // Apply Rotation
        if (pageRotations[originalIdx]) {
          const currentRot = page.getRotation().angle;
          page.setRotation(degrees((currentRot + pageRotations[originalIdx]) % 360));
        }
      }
      pageMap.set(visualIdx, page);
    }
  } else {
    // STRATEGY B: EDIT ORIGINAL (Structure Same)
    // This preserves the interactive form fields!
    newDoc = originalDoc;

    // Apply Rotations in Place & Build Map
    const pages = newDoc.getPages();
    pages.forEach((page, originalIdx) => {
      pageMap.set(originalIdx, page);

      if (pageRotations[originalIdx]) {
        const currentRot = page.getRotation().angle;
        page.setRotation(degrees((currentRot + pageRotations[originalIdx]) % 360));
      }
    });
  }

  // Set Metadata
  if (metadata.title) newDoc.setTitle(metadata.title);
  if (metadata.author) newDoc.setAuthor(metadata.author);
  if (metadata.subject) newDoc.setSubject(metadata.subject);
  if (metadata.keywords) {
    const kw = metadata.keywords.split(/[,\s]+/).filter(k => k.trim().length > 0);
    newDoc.setKeywords(kw);
  }
  newDoc.setProducer("Nextooly PDF Editor");
  newDoc.setCreator("Nextooly Web App");

  // --------------------------------------------------------------------------
  // STEP 4: DRAW ANNOTATIONS
  // --------------------------------------------------------------------------
  const fontMap = new Map<string, PDFFont>();
  // Embed standard Helvetica as fallback
  const helveticaFont = await newDoc.embedFont(StandardFonts.Helvetica);
  fontMap.set("Helvetica", helveticaFont);

  // Helper to load fonts on demand
  const getFontForAnn = async (fontName?: string, isBold?: boolean, isItalic?: boolean) => {
    const name = fontName || "Helvetica";
    const cacheKey = `${name}_${isBold ? 'b' : ''}_${isItalic ? 'i' : ''}`;
    if (fontMap.has(cacheKey)) return fontMap.get(cacheKey)!;

    let font: PDFFont;
    try {
      let stdFont = StandardFonts.Helvetica;

      if (name === "Times Roman") {
        if (isBold && isItalic) stdFont = StandardFonts.TimesRomanBoldItalic;
        else if (isBold) stdFont = StandardFonts.TimesRomanBold;
        else if (isItalic) stdFont = StandardFonts.TimesRomanItalic;
        else stdFont = StandardFonts.TimesRoman;
      } else if (name === "Courier") {
        if (isBold && isItalic) stdFont = StandardFonts.CourierBoldOblique;
        else if (isBold) stdFont = StandardFonts.CourierBold;
        else if (isItalic) stdFont = StandardFonts.CourierOblique;
        else stdFont = StandardFonts.Courier;
      } else {
        // Helvetica (Default)
        if (isBold && isItalic) stdFont = StandardFonts.HelveticaBoldOblique;
        else if (isBold) stdFont = StandardFonts.HelveticaBold;
        else if (isItalic) stdFont = StandardFonts.HelveticaOblique;
        else stdFont = StandardFonts.Helvetica;
      }
      font = await newDoc.embedFont(stdFont);
    } catch (e) {
      console.warn("Font embed failed, falling back to Helvetica", e);
      font = helveticaFont;
    }
    fontMap.set(cacheKey, font);
    return font;
  };

  const zapfFont = await newDoc.embedFont(StandardFonts.ZapfDingbats);
  // --- FONT HELPER END ---

  for (const ann of annotations) {
    const page = pageMap.get(ann.pageIndex);
    if (!page) continue;

    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle % 360;
    const isSideways = rotation === 90 || rotation === 270;
    const visualWidth = isSideways ? height : width;
    const visualHeight = isSideways ? width : height;

    const x = ann.x * visualWidth;
    const y = ann.y * visualHeight;
    const w = (ann.width || 0) * visualWidth;
    const h = (ann.height || 0) * visualHeight;

    // Coordinate Transform (Visual Top-Left -> PDF Bottom-Left)
    let pdfX, pdfY, rotateDegrees;
    if (rotation === 0) { pdfX = x; pdfY = height - y - h; rotateDegrees = 0; }
    else if (rotation === 90) { pdfX = y; pdfY = visualWidth - x - w; rotateDegrees = -90; }
    else if (rotation === 180) { pdfX = width - x - w; pdfY = y; rotateDegrees = -180; }
    else if (rotation === 270) { pdfX = height - y - h; pdfY = x; rotateDegrees = -270; }
    else { pdfX = x; pdfY = height - y - h; rotateDegrees = 0; }

    const op = ann.opacity ?? 1;

    // =========================================================
    // TYPE: TEXT / TEXT_EDIT
    // =========================================================
    if (ann.type === "text" || ann.type === "text_edit") {
      // [NEW] BURN WATERMARK AS IMAGE
      // This rasterizes the text into a PNG so it cannot be edited later.
      if (ann.subtype === "watermark") {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const scaleMult = 3; // 3x resolution for sharpness
            const fontSize = (ann.size || 16);
            const fontName = ann.font || "Helvetica";

            // Construct font string matching the editor's look
            const fontStr = `${ann.isBold ? "bold " : ""}${ann.isItalic ? "italic " : ""}${fontSize * scaleMult}px ${fontName}`;

            ctx.font = fontStr;
            const textMetrics = ctx.measureText(ann.content || "");
            const textW = textMetrics.width;
            const textH = fontSize * scaleMult * 1.2; // Approx line height

            // Resize canvas to fit text
            canvas.width = textW;
            canvas.height = textH;

            // Re-apply settings after resize (canvas resets context on resize)
            ctx.font = fontStr;
            ctx.fillStyle = ann.color || "#000000";
            ctx.textBaseline = "middle";
            ctx.fillText(ann.content || "", 0, canvas.height / 2);

            // Convert to PNG and Embed
            const dataUrl = canvas.toDataURL("image/png");
            const res = await fetch(dataUrl);
            const pngBytes = await res.arrayBuffer();
            const embeddedImage = await newDoc.embedPng(pngBytes);

            // Calculate Dimensions & Rotation
            const finalW = textW / scaleMult;
            const finalH = textH / scaleMult;

            const netRotation = rotateDegrees - (ann.rotation || 0);
            const rad = (netRotation * Math.PI) / 180;

            // Calculate Pivot Point (Center of the visual box)
            const centerX = pdfX + (rotation % 180 === 0 ? w : h) / 2;
            const centerY = pdfY + (rotation % 180 === 0 ? h : w) / 2;

            // Calculate Insertion Point (Bottom-Left)
            // This math ensures the image rotates around its own center
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const insertX = centerX - ((finalW / 2) * cos - (finalH / 2) * sin);
            const insertY = centerY - ((finalW / 2) * sin + (finalH / 2) * cos);

            page.drawImage(embeddedImage, {
              x: insertX,
              y: insertY,
              width: finalW,
              height: finalH,
              opacity: op,
              rotate: degrees(netRotation)
            });
            continue;
          }
        } catch (e) {
          console.warn("Watermark burn failed, falling back to text", e);
        }
      }
      // A. Draw "Eraser Patch" with BLEED Fix (Background color)
      if (ann.type === "text_edit" && ann.originalBounds) {
        const patchX = ann.originalBounds.x * visualWidth;
        const patchY = ann.originalBounds.y * visualHeight;
        const patchW = ann.originalBounds.width * visualWidth;
        const patchH = ann.originalBounds.height * visualHeight;

        // Transform for rotation (Assuming 0 deg for patches usually)
        const pX = patchX;
        const pY = height - patchY - patchH;

        const patchColor = ann.backgroundColor ? safeHexToRgb01(ann.backgroundColor) : rgb(1, 1, 1);

        const PATCH_BLEED = 0.5;

        page.drawRectangle({
          x: pX - PATCH_BLEED,
          y: pY - PATCH_BLEED,
          width: patchW + (PATCH_BLEED * 2),
          height: patchH + (PATCH_BLEED * 2),
          color: patchColor,
          opacity: 1,
          borderWidth: 0,
        });

        // If the text box itself has a background color (e.g. highlighted text)
        if (ann.backgroundColor && ann.subtype !== "editor") {
          const bgC = safeHexToRgb01(ann.backgroundColor);
          let rectW = w, rectH = h;
          if (rotation === 90 || rotation === 270) { rectW = h; rectH = w; }

          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: rectW,
            height: rectH,
            color: bgC,
            opacity: ann.opacity ?? 1,
            borderWidth: 0,
          });
        }
      }

      // B. Draw Text Content
      if (ann.content) {
        const fontSize = ann.size ?? 16;
        const baseFont = await getFontForAnn(ann.font, false);
        const boldFont = await getFontForAnn(ann.font, true);
        const localFontMap = new Map<string, PDFFont>();
        localFontMap.set(ann.font || "Helvetica", baseFont);
        localFontMap.set(`${ann.font || "Helvetica"}_bold`, boldFont);

        const isHtml = /<[a-z][\s\S]*>/i.test(ann.content) || ann.content.includes("style=");
        let linesOfRuns: TextRun[][] = [];
        const boxWidth = isSideways ? h : w;

        if (isHtml) {
          const hasExplicitBoldTags = /<b\b|<strong\b|font-weight:\s*(bold|700|800|900)/i.test(ann.content);
          const effectiveBaseBold = hasExplicitBoldTags ? false : !!ann.isBold;

          const flatRuns = parseRichText(ann.content, {
            color: ann.color || "#000000",
            isBold: effectiveBaseBold,
            isItalic: false,
            isUnderline: !!ann.isUnderline,
            font: ann.font || "Helvetica",
            size: fontSize
          });
          linesOfRuns = wrapRichText(flatRuns, boxWidth, localFontMap, ann.font || "Helvetica");
        } else {
          const plainLines = breakTextIntoLines(ann.content, fontSize, baseFont, boxWidth);
          linesOfRuns = plainLines.map(txt => [{
            text: txt, isBold: !!ann.isBold, color: ann.color || "#000000", font: ann.font || "Helvetica", size: fontSize, isItalic: !!ann.isItalic, isUnderline: !!ann.isUnderline
          }]);
        }

        const centerX = pdfX + (rotation % 180 === 0 ? w : h) / 2;
        const centerY = pdfY + (rotation % 180 === 0 ? h : w) / 2;
        const netRotation = rotateDegrees - (ann.rotation || 0);
        const rad = (netRotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const lineHeight = fontSize * (ann.lineHeight ?? 1.2);

        for (let i = 0; i < linesOfRuns.length; i++) {
          const runLine = linesOfRuns[i];
          let currentLineXOffset = -w / 2;
          const yOffset = (h / 2) - ((i + 1) * lineHeight) + (fontSize * 0.25);

          for (const run of runLine) {
            // Handle Symbols with ZapfDingbats (Checkmarks/Crosses)
            if (["✓", "✔"].includes(run.text.trim())) {
              const checkChar = "\u2713";
              const runWidth = zapfFont.widthOfTextAtSize(checkChar, run.size);
              const rotatedX = currentLineXOffset * cos - yOffset * sin;
              const rotatedY = currentLineXOffset * sin + yOffset * cos;
              const finalX = centerX + rotatedX;
              const finalY = centerY + rotatedY;

              page.drawText(checkChar, {
                x: finalX,
                y: finalY,
                size: run.size,
                font: zapfFont,
                color: safeHexToRgb01(run.color),
                opacity: op,
                rotate: degrees(netRotation)
              });
              currentLineXOffset += runWidth;
              continue;
            }

            if (["✕", "✖", "✗"].includes(run.text.trim())) {
              const crossChar = "\u2715";
              const runWidth = zapfFont.widthOfTextAtSize(crossChar, run.size);
              const rotatedX = currentLineXOffset * cos - yOffset * sin;
              const rotatedY = currentLineXOffset * sin + yOffset * cos;
              const finalX = centerX + rotatedX;
              const finalY = centerY + rotatedY;

              page.drawText(crossChar, {
                x: finalX,
                y: finalY,
                size: run.size,
                font: zapfFont,
                color: safeHexToRgb01(run.color),
                opacity: op,
                rotate: degrees(netRotation)
              });
              currentLineXOffset += runWidth;
              continue;
            }

            // Standard Text Rendering
            const runWidth = getRunWidth(run, localFontMap, ann.font || "Helvetica");
            const rotatedX = currentLineXOffset * cos - yOffset * sin;
            const rotatedY = currentLineXOffset * sin + yOffset * cos;
            const finalX = centerX + rotatedX;
            const finalY = centerY + rotatedY;

            let renderFontName = ann.font || "Helvetica";
            const runFont = await getFontForAnn(renderFontName, run.isBold, run.isItalic);
            const runColor = safeHexToRgb01(run.color);

            page.drawText(run.text, {
              x: finalX,
              y: finalY,
              size: run.size,
              font: runFont,
              color: runColor,
              opacity: op,
              rotate: degrees(netRotation)
            });

            // Underline Logic
            if (run.isUnderline) {
              const underlineThickness = run.size / 15;
              const underlineOffset = run.size / 4;

              const startRelX = currentLineXOffset * cos - (yOffset - underlineOffset) * sin;
              const startRelY = currentLineXOffset * sin + (yOffset - underlineOffset) * cos;

              const endRelX = (currentLineXOffset + runWidth) * cos - (yOffset - underlineOffset) * sin;
              const endRelY = (currentLineXOffset + runWidth) * sin + (yOffset - underlineOffset) * cos;

              page.drawLine({
                start: { x: centerX + startRelX, y: centerY + startRelY },
                end: { x: centerX + endRelX, y: centerY + endRelY },
                thickness: underlineThickness,
                color: runColor,
                opacity: op,
              });
            }
            currentLineXOffset += runWidth;
          }
        }
      }
    }

    // =========================================================
    // TYPE: RECT / REDACT
    // =========================================================
    else if (ann.type === "rect" || ann.type === "redact") {
      let rectW = w, rectH = h;
      if (rotation === 90 || rotation === 270) { rectW = h; rectH = w; }

      const rectOpts: any = { x: pdfX, y: pdfY, width: rectW, height: rectH, opacity: op };

      let colorToUse;
      if (ann.type === "redact") {
        if (!ann.color || (ann.color === "#000000" && ann.opacity === 1)) {
          if (ann.groupId) colorToUse = rgb(1, 1, 1);
          else colorToUse = ann.color ? safeHexToRgb01(ann.color) : rgb(1, 1, 1);
        } else {
          colorToUse = safeHexToRgb01(ann.color);
        }
      } else {
        colorToUse = safeHexToRgb01(ann.color);
      }

      if (ann.isFill) {
        rectOpts.color = colorToUse;
        rectOpts.borderWidth = 0;

        // Inflate ALL OPAQUE filled boxes to avoid hairlines
        const isOpaque = op >= 0.99;
        if (isOpaque) {
          const INFLATION = 0.5;
          rectOpts.x -= INFLATION;
          rectOpts.y -= INFLATION;
          rectOpts.width += (INFLATION * 2);
          rectOpts.height += (INFLATION * 2);
        }
      } else {
        rectOpts.borderColor = colorToUse;
        rectOpts.borderWidth = 3;
      }
      page.drawRectangle(rectOpts);
    }

    // =========================================================
    // TYPE: CIRCLE
    // =========================================================
    else if (ann.type === "circle") {
      let centerX = pdfX + (rotation % 180 === 0 ? w : h) / 2;
      let centerY = pdfY + (rotation % 180 === 0 ? h : w) / 2;
      let radX = (rotation % 180 === 0 ? w : h) / 2;
      let radY = (rotation % 180 === 0 ? h : w) / 2;

      page.drawEllipse({
        x: centerX,
        y: centerY,
        xScale: radX,
        yScale: radY,
        borderColor: safeHexToRgb01(ann.color),
        borderWidth: 3,
        opacity: op
      });

      if (ann.isFill) {
        page.drawEllipse({
          x: centerX,
          y: centerY,
          xScale: radX,
          yScale: radY,
          color: safeHexToRgb01(ann.backgroundColor || ann.color),
          opacity: op
        });
      }
    }

    // =========================================================
    // TYPE: IMAGE
    // =========================================================
    else if (ann.type === "image" && ann.content) {
      try {
        const imgBytes = await fetch(ann.content).then(r => r.arrayBuffer());
        const header = new Uint8Array(imgBytes);
        let img;

        if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
          img = await newDoc.embedPng(imgBytes);
        } else {
          img = await newDoc.embedJpg(imgBytes);
        }
        let imgW = w;
        let imgH = h;
        if (rotation === 90 || rotation === 270) {
          imgW = h;
          imgH = w;
        }
        page.drawImage(img, {
          x: pdfX,
          y: pdfY,
          width: imgW,  // Use the context-aware width
          height: imgH, // Use the context-aware height
          opacity: op,
          rotate: degrees(rotateDegrees)
        });
      } catch (e) { console.error("Img error", e); }
    }

    // =========================================================
    // TYPE: LINE / ARROW / PATH
    // =========================================================
    else if ((ann.type === "path" || ann.type === "arrow") && ann.paths && ann.paths.length > 0) {
      const txAbs = (nx: number, ny: number) => {
        const vx = nx * visualWidth;
        const vy = ny * visualHeight;
        if (rotation === 0) return { x: vx, y: height - vy };
        if (rotation === 90) return { x: vy, y: visualWidth - vx };
        if (rotation === 180) return { x: width - vx, y: vy };
        if (rotation === 270) return { x: height - vy, y: vx };
        return { x: 0, y: 0 };
      };

      const color = safeHexToRgb01(ann.color);

      if (ann.type === "path") {
        for (let i = 0; i < ann.paths.length - 1; i++) {
          const p1 = txAbs(ann.paths[i].x, ann.paths[i].y);
          const p2 = txAbs(ann.paths[i + 1].x, ann.paths[i + 1].y);
          page.drawLine({ start: p1, end: p2, thickness: ann.size ?? 2, color: color, opacity: op });
        }
      } else {
        // Arrow Drawing
        const p1 = txAbs(ann.paths[0].x, ann.paths[0].y);
        const p2 = txAbs(ann.paths[ann.paths.length - 1].x, ann.paths[ann.paths.length - 1].y);

        // 1. Draw the main line
        page.drawLine({ start: p1, end: p2, thickness: ann.size ?? 3, color: color, opacity: op });

        // 2. Calculate rotation angle
        const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const angleDeg = angleRad * (180 / Math.PI);

        // 3. Draw Arrow Head (SVG Path)
        page.drawSvgPath('M 0 0 L -12 5 L -12 -5 Z', {
          x: p2.x,
          y: p2.y,
          color: color,
          borderColor: undefined, // No outline
          borderWidth: 0,
          opacity: op,
          rotate: degrees(angleDeg),
          scale: 1 + ((ann.size ?? 3) / 10) // Scale slightly with line thickness
        });
      }
    }
  }

  const pdfLibBytes = await newDoc.save();
  return pdfLibBytes;
}

export async function getPdfMetadata(fileBuffer: ArrayBuffer) {
  const doc = await PDFDocument.load(fileBuffer, { updateMetadata: false });
  return {
    title: doc.getTitle() || "",
    author: doc.getAuthor() || "",
    subject: doc.getSubject() || "",
    keywords: doc.getKeywords() || "",
    creator: doc.getCreator() || "",
    producer: doc.getProducer() || "",
    creationDate: doc.getCreationDate(),
    modificationDate: doc.getModificationDate(),
    pageCount: doc.getPageCount(),
  };
}
