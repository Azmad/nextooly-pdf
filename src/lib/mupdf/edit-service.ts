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
  PDFName, PDFDict, PDFArray, PDFRef, beginText, endText, pushGraphicsState,
  popGraphicsState, setFillingColor, setFontAndSize, setCharacterSpacing,
  rotateAndSkewTextDegreesAndTranslate, showText, setGraphicsState
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

export type TextStyleRun = {
  text: string;
  color?: string | null;
  fontName?: string;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
};

function normalizePdfFontName(fontName?: string | null) {
  if (!fontName) return "Helvetica";
  const lower = fontName.toLowerCase();
  if (lower.includes("times") || lower.includes("serif")) return "Times Roman";
  if (lower.includes("courier") || lower.includes("mono")) return "Courier";
  return "Helvetica";
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function countCharacters(text: string) {
  return Array.from(text).length;
}

function getDensityLetterSpacingEm(fontDensity: number = 100) {
  return (100 - fontDensity) / 500;
}

function getCharacterSpacingForDensity(fontSize: number, fontDensity: number = 100) {
  return fontSize * getDensityLetterSpacingEm(fontDensity);
}

function getFontCacheKey(fontName?: string, isBold?: boolean, isItalic?: boolean) {
  return `${fontName || "Helvetica"}_${isBold ? "b" : ""}_${isItalic ? "i" : ""}`;
}

function trimTrailingWhitespaceFromRuns(runs: TextStyleRun[]) {
  const trimmed = runs.map((run) => ({ ...run }));
  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    const nextText = last.text.replace(/\s+$/, "");
    if (nextText.length > 0) {
      last.text = nextText;
      break;
    }
    trimmed.pop();
  }
  return trimmed.filter((run) => run.text.length > 0);
}

function buildRichTextHtml(
  runs: TextStyleRun[],
  baseStyle: { color?: string | null; fontSize: number; isBold: boolean; isItalic: boolean }
) {
  const baseColor = baseStyle.color?.toLowerCase() || "";

  return runs
    .map((run) => {
      const styles: string[] = [];
      const runColor = run.color?.toLowerCase() || "";

      if (runColor && runColor !== baseColor) styles.push(`color: ${run.color}`);
      if (!!run.isBold !== baseStyle.isBold) styles.push(`font-weight: ${run.isBold ? "700" : "400"}`);
      if (!!run.isItalic !== baseStyle.isItalic) styles.push(`font-style: ${run.isItalic ? "italic" : "normal"}`);

      const runFontSize = run.fontSize ?? baseStyle.fontSize;
      if (baseStyle.fontSize > 0 && Math.abs(runFontSize - baseStyle.fontSize) > 0.05) {
        styles.push(`font-size: ${(runFontSize / baseStyle.fontSize).toFixed(4)}em`);
      }

      const text = escapeHtml(run.text);
      return styles.length > 0 ? `<span style="${styles.join("; ")}">${text}</span>` : text;
    })
    .join("");
}

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
      if (el.style.fontFamily) {
        newStyle.font = normalizePdfFontName(el.style.fontFamily);
      }
      const fSize = el.style.fontSize;
      if (fSize) {
        if (fSize.endsWith("em")) {
          newStyle.size *= parseFloat(fSize);
        } else if (fSize.endsWith("%")) {
          newStyle.size *= (parseFloat(fSize) / 100);
        } else if (fSize.endsWith("px")) {
          newStyle.size = parseFloat(fSize);
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
  baseFontName: string,
  fontDensity: number = 100
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
      const fontKey = getFontCacheKey(run.font || baseFontName, run.isBold, run.isItalic);
      const fallbackKey = getFontCacheKey(baseFontName, run.isBold, run.isItalic);
      const font = fontMap.get(fontKey) || fontMap.get(fallbackKey) || fontMap.get(getFontCacheKey(baseFontName));
      let wordWidth = 0;
      try {
        const charSpacing = getCharacterSpacingForDensity(run.size, fontDensity);
        wordWidth = font ? font.widthOfTextAtSize(word, run.size) + (Math.max(0, countCharacters(word) - 1) * charSpacing) : 0;
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
        lastRun.isItalic === run.isItalic &&
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
function getRunWidth(run: TextRun, fontMap: Map<string, PDFFont>, baseFontName: string, fontDensity: number = 100): number {
  const fontKey = getFontCacheKey(run.font || baseFontName, run.isBold, run.isItalic);
  const fallbackKey = getFontCacheKey(baseFontName, run.isBold, run.isItalic);
  const font = fontMap.get(fontKey) || fontMap.get(fallbackKey) || fontMap.get(getFontCacheKey(baseFontName));
  if (!font) return 0;

  try {
    const charSpacing = getCharacterSpacingForDensity(run.size, fontDensity);
    return font.widthOfTextAtSize(run.text, run.size) + (Math.max(0, countCharacters(run.text) - 1) * charSpacing);
  } catch (e) { return 0; }
}

export type TextItem = {
  text: string;
  html?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
  color?: string | null;
  isBold?: boolean;
  isItalic?: boolean;
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
  let page: any = null;
  let structuredText: any = null;

  try {
    page = doc.loadPage(pageIndex);
    const bounds = page.getBounds();
    const pageWidth = bounds[2] - bounds[0];
    const pageHeight = bounds[3] - bounds[1];

    structuredText = page.toStructuredText();

    // Normalise raw PDF coords into [0,1] page-relative space
    const normX = (v: number) => (v - bounds[0]) / pageWidth;
    const normY = (v: number) => (v - bounds[1]) / pageHeight;
    const normW = (v: number) => v / pageWidth;
    const normH = (v: number) => v / pageHeight;

    type ExtractedLine = {
      text: string;
      html: string;
      bb: { x: number; y: number; w: number; h: number };
      fontSize: number;
      fontName: string;
      color: string | null;
      isBold: boolean;
      isItalic: boolean;
    };

    type WorkingLine = {
      bb: { x: number; y: number; w: number; h: number };
      runs: TextStyleRun[];
    };

    const pickTop = (counts: Record<string, number>) =>
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

    const buildExtractedLine = (line: WorkingLine | null): ExtractedLine | null => {
      if (!line) return null;

      const trimmedRuns = trimTrailingWhitespaceFromRuns(line.runs);
      const text = trimmedRuns.map((run) => run.text).join("");
      if (!text.trim() || line.bb.w <= 0) return null;

      const fontNameCount: Record<string, number> = {};
      const fontSizeCount: Record<string, number> = {};
      const colorCount: Record<string, number> = {};
      const boldCount: Record<string, number> = { true: 0, false: 0 };
      const italicCount: Record<string, number> = { true: 0, false: 0 };

      for (const run of trimmedRuns) {
        const weight = Math.max(1, countCharacters(run.text));
        const fontName = run.fontName || "Helvetica";
        const fontSize = run.fontSize ?? 12;

        fontNameCount[fontName] = (fontNameCount[fontName] || 0) + weight;
        fontSizeCount[String(fontSize)] = (fontSizeCount[String(fontSize)] || 0) + weight;
        if (run.color) colorCount[run.color] = (colorCount[run.color] || 0) + weight;
        boldCount[String(!!run.isBold)] += weight;
        italicCount[String(!!run.isItalic)] += weight;
      }

      const dominantFontName = pickTop(fontNameCount) || "Helvetica";
      const dominantFontSize = parseFloat(pickTop(fontSizeCount)) || 12;
      const dominantColor = pickTop(colorCount) || null;
      const isBold = (pickTop(boldCount) || "false") === "true";
      const isItalic = (pickTop(italicCount) || "false") === "true";

      return {
        text,
        html: buildRichTextHtml(trimmedRuns, {
          color: dominantColor,
          fontSize: dominantFontSize,
          isBold,
          isItalic,
        }),
        bb: line.bb,
        fontSize: dominantFontSize,
        fontName: dominantFontName,
        color: dominantColor,
        isBold,
        isItalic,
      };
    };

    const textBlocks: ExtractedLine[][] = [];
    let currentBlock: ExtractedLine[] | null = null;
    let currentLine: WorkingLine | null = null;

    structuredText.walk({
      beginTextBlock: () => {
        currentBlock = [];
      },
      beginLine: (bbox: [number, number, number, number]) => {
        currentLine = {
          bb: { x: bbox[0], y: bbox[1], w: bbox[2] - bbox[0], h: bbox[3] - bbox[1] },
          runs: [],
        };
      },
      onChar: (c: string, _origin: unknown, font: any, size: number, _quad: unknown, color: any) => {
        if (!currentLine || !c || c === "\r") return;

        const fontName = font?.getName?.() ?? "Helvetica";
        const runColor = toHexColor(color);
        const isBold = font?.isBold?.() ?? /bold|black/i.test(fontName);
        const isItalic = font?.isItalic?.() ?? /italic|oblique/i.test(fontName);
        const lastRun = currentLine.runs[currentLine.runs.length - 1];

        if (
          lastRun &&
          lastRun.color === runColor &&
          lastRun.fontName === fontName &&
          Math.abs((lastRun.fontSize ?? size) - size) < 0.05 &&
          !!lastRun.isBold === isBold &&
          !!lastRun.isItalic === isItalic
        ) {
          lastRun.text += c;
        } else {
          currentLine.runs.push({
            text: c,
            color: runColor,
            fontName,
            fontSize: size,
            isBold,
            isItalic,
          });
        }
      },
      endLine: () => {
        const extractedLine = buildExtractedLine(currentLine);
        if (extractedLine) {
          if (!currentBlock) currentBlock = [];
          currentBlock.push(extractedLine);
        }
        currentLine = null;
      },
      endTextBlock: () => {
        if (currentBlock && currentBlock.length > 0) {
          textBlocks.push(currentBlock);
        }
        currentBlock = null;
      },
    });

    const trailingBlock = currentBlock as ExtractedLine[] | null;
    if (trailingBlock && trailingBlock.length > 0) {
      textBlocks.push(trailingBlock);
    }

    const emitLineItem = (line: ExtractedLine): TextItem => {
      const fontSize = line.fontSize || 12;
      const tightH = fontSize * 1.45;
      const verticalCorrection = fontSize * 0.15;
      const originalCenterY = line.bb.y + (line.bb.h / 2);
      const tightY = originalCenterY - (tightH / 2) + verticalCorrection;

      return {
        text: line.text,
        html: line.html,
        x: normX(line.bb.x),
        y: normY(tightY),
        width: normW(line.bb.w),
        height: normH(tightH),
        fontSize,
        fontName: line.fontName,
        color: line.color,
        isBold: line.isBold,
        isItalic: line.isItalic,
        lineHeight: 1.15,
      };
    };

    if (mode === "line") {
      return textBlocks.flatMap((block) => block.map(emitLineItem));
    }

    const extractedTextItems: TextItem[] = [];

    for (const block of textBlocks) {
      if (block.length === 0) continue;

      const GAP_FACTOR = 0.8;
      const groups: ExtractedLine[][] = [];
      let currentGroup: ExtractedLine[] = [block[0]];

      for (let i = 1; i < block.length; i++) {
        const prev = block[i - 1];
        const curr = block[i];
        const prevBottom = prev.bb.y + prev.bb.h;
        const gap = curr.bb.y - prevBottom;
        if (gap > prev.fontSize * GAP_FACTOR) {
          groups.push(currentGroup);
          currentGroup = [];
        }
        currentGroup.push(curr);
      }
      groups.push(currentGroup);

      for (const group of groups) {
        let fullText = "";
        let fullHtml = "";
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let firstLineCY: number | null = null;
        let lastLineCY: number | null = null;
        const fontNameCount: Record<string, number> = {};
        const fontSizeCount: Record<string, number> = {};
        const colorCount: Record<string, number> = {};
        const boldCount: Record<string, number> = { true: 0, false: 0 };
        const italicCount: Record<string, number> = { true: 0, false: 0 };

        for (const line of group) {
          const weight = Math.max(1, countCharacters(line.text));
          fullText += (fullText ? "\n" : "") + line.text;
          fullHtml += (fullHtml ? "<br/>" : "") + line.html;
          minX = Math.min(minX, line.bb.x);
          minY = Math.min(minY, line.bb.y);
          maxX = Math.max(maxX, line.bb.x + line.bb.w);
          maxY = Math.max(maxY, line.bb.y + line.bb.h);
          const cy = line.bb.y + (line.bb.h / 2);
          if (firstLineCY === null) firstLineCY = cy;
          lastLineCY = cy;
          fontNameCount[line.fontName] = (fontNameCount[line.fontName] || 0) + weight;
          fontSizeCount[String(line.fontSize)] = (fontSizeCount[String(line.fontSize)] || 0) + weight;
          if (line.color) colorCount[line.color] = (colorCount[line.color] || 0) + weight;
          boldCount[String(!!line.isBold)] += weight;
          italicCount[String(!!line.isItalic)] += weight;
        }

        if (!fullText.trim() || minX === Infinity) continue;

        const dominantFontName = pickTop(fontNameCount) || "Helvetica";
        const dominantFontSize = parseFloat(pickTop(fontSizeCount)) || 12;
        const dominantColor = pickTop(colorCount) || null;
        const isBold = (pickTop(boldCount) || "false") === "true";
        const isItalic = (pickTop(italicCount) || "false") === "true";

        let calculatedLineHeight = 1.2;
        if (dominantFontSize > 0 && group.length > 1 && firstLineCY !== null && lastLineCY !== null) {
          const avgSpacing = Math.abs(lastLineCY - firstLineCY) / (group.length - 1);
          calculatedLineHeight = Math.max(1.0, Math.min(3.0, avgSpacing / dominantFontSize));
        }

        extractedTextItems.push({
          text: fullText,
          html: fullHtml,
          x: normX(minX),
          y: normY(minY),
          width: normW(maxX - minX),
          height: normH(maxY - minY),
          fontSize: dominantFontSize,
          fontName: dominantFontName,
          color: dominantColor,
          isBold,
          isItalic,
          lineHeight: calculatedLineHeight,
        });
      }
    }

    return extractedTextItems;

    const data: any = { blocks: [] };
    const getBbox = (_obj: any): { x: number; y: number; w: number; h: number } => ({ x: 0, y: 0, w: 0, h: 0 });
    const textItems: TextItem[] = [];

    for (const block of data.blocks) {
      if (!Array.isArray(block.lines) || block.lines.length === 0) continue;

      if (mode === "line") {
        // ── LINE MODE: one TextItem per MuPDF line ──
        for (const line of block.lines) {
          const lineText: string = line.text ?? "";
          if (!lineText.trim()) continue;

          const bb = getBbox(line);
          if (!bb || bb.w <= 0) continue;

          const fontSize: number = line.font?.size ?? 12;
          // Restore the older line-mode box geometry that behaved better for
          // live editing. It gives the line box a consistent amount of headroom
          // and descender space instead of trimming too aggressively.
          const tightH = fontSize * 1.45;
          const verticalCorrection = fontSize * 0.15;
          const originalCenterY = bb.y + (bb.h / 2);
          const tightY = originalCenterY - (tightH / 2) + verticalCorrection;
          const fontName: string = line.font?.name ?? "Helvetica";
          const isBold = fontName.toLowerCase().includes("bold") || fontName.toLowerCase().includes("black");
          const color = toHexColor(line.color);

          textItems.push({
            text: lineText.trimEnd(),
            x: normX(bb.x),
            y: normY(tightY),
            width: normW(bb.w),
            height: normH(tightH),
            fontSize,
            fontName,
            color,
            isBold,
            lineHeight: 1.15,
          });
        }
      } else {
        // ── BLOCK MODE: split MuPDF block on large vertical gaps ──
        // Collect valid lines with their bboxes first
        interface LineData {
          text: string; bb: { x: number; y: number; w: number; h: number };
          fontSize: number; fontName: string; color: string;
        }
        const validLines: LineData[] = [];
        for (const line of block.lines) {
          const lineText: string = line.text ?? "";
          if (!lineText.trim()) continue;
          const bb = getBbox(line);
          if (!bb) continue;
          validLines.push({
            text: lineText,
            bb,
            fontSize: line.font?.size ?? 12,
            fontName: line.font?.name ?? "Helvetica",
            color: line.color != null ? (toHexColor(line.color) || "") : "",
          });
        }
        if (validLines.length === 0) continue;

        // Split into sub-groups wherever the gap between consecutive lines
        // exceeds GAP_FACTOR × fontSize (indicates a visual paragraph break).
        const GAP_FACTOR = 0.8;
        const groups: LineData[][] = [];
        let cur: LineData[] = [validLines[0]];
        for (let i = 1; i < validLines.length; i++) {
          const prev = validLines[i - 1];
          const curr = validLines[i];
          const prevBottom = prev.bb.y + prev.bb.h;
          const gap = curr.bb.y - prevBottom;
          if (gap > prev.fontSize * GAP_FACTOR) {
            groups.push(cur);
            cur = [];
          }
          cur.push(curr);
        }
        groups.push(cur);

        // Emit one TextItem per group
        for (const grp of groups) {
          let fullText = "";
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          let firstLineCY = 0;
          let lastLineCY = 0;
          // Majority vote: count lines per fontName/fontSize/color
          const fontNameCount: Record<string, number> = {};
          const fontSizeCount: Record<string, number> = {};
          const colorCount: Record<string, number> = {};

          for (const ld of grp) {
            fullText += (fullText ? "\n" : "") + ld.text;
            minX = Math.min(minX, ld.bb.x);
            minY = Math.min(minY, ld.bb.y);
            maxX = Math.max(maxX, ld.bb.x + ld.bb.w);
            maxY = Math.max(maxY, ld.bb.y + ld.bb.h);
            const cy = ld.bb.y + ld.bb.h / 2;
            if (firstLineCY === null) firstLineCY = cy;
            lastLineCY = cy;
            fontNameCount[ld.fontName] = (fontNameCount[ld.fontName] || 0) + 1;
            fontSizeCount[String(ld.fontSize)] = (fontSizeCount[String(ld.fontSize)] || 0) + 1;
            if (ld.color) colorCount[ld.color] = (colorCount[ld.color] || 0) + 1;
          }

          if (!fullText.trim() || minX === Infinity) continue;

          // Pick majority font name, size, color
          const pickTop = (counts: Record<string, number>) =>
            Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
          const dominantFontName = pickTop(fontNameCount) || "Helvetica";
          const dominantFontSize = parseFloat(pickTop(fontSizeCount)) || 12;
          const dominantColor = pickTop(colorCount) || null;
          const isBold = dominantFontName.toLowerCase().includes("bold") || dominantFontName.toLowerCase().includes("black");

          let calculatedLineHeight = 1.2;
          if (dominantFontSize > 0 && grp.length > 1 && firstLineCY !== null && lastLineCY !== null) {
            const avgSpacing = Math.abs(lastLineCY - firstLineCY) / (grp.length - 1);
            calculatedLineHeight = Math.max(1.0, Math.min(3.0, avgSpacing / dominantFontSize));
          }

          textItems.push({
            text: fullText,
            x: normX(minX),
            y: normY(minY),
            width: normW(maxX - minX),
            height: normH(maxY - minY),
            fontSize: dominantFontSize,
            fontName: dominantFontName,
            color: dominantColor,
            isBold,
            lineHeight: calculatedLineHeight,
          });
        }
      }
    }

    return textItems;
  } catch (e) {
    console.error("Text extraction failed:", e);
    return [];
  } finally {
    structuredText?.destroy?.();
    page?.destroy?.();
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

function breakTextIntoLines(text: string, size: number, font: PDFFont, maxWidth: number, fontDensity: number = 100) {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  const charSpacing = getCharacterSpacingForDensity(size, fontDensity);

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      try {
        const candidate = `${currentLine} ${word}`;
        const width = font.widthOfTextAtSize(candidate, size) + (Math.max(0, countCharacters(candidate) - 1) * charSpacing);
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

    const saveOptionAttempts = [
      "garbage=compact,continue-on-error",
      "continue-on-error",
      "garbage=compact",
      "garbage",
      "",
    ];

    let lastSaveError: unknown = null;

    for (const opts of saveOptionAttempts) {
      let buf: any = null;
      try {
        buf = doc.saveToBuffer(opts);
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
      } catch (e) {
        lastSaveError = e;
      } finally {
        buf?.destroy?.();
      }
    }

    throw lastSaveError instanceof Error
      ? lastSaveError
      : new Error(String(lastSaveError ?? "MuPDF save failed"));
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
  fontMap.set(getFontCacheKey("Helvetica"), helveticaFont);

  // Helper to load fonts on demand
  const getFontForAnn = async (fontName?: string, isBold?: boolean, isItalic?: boolean) => {
    const name = fontName || "Helvetica";
    const cacheKey = getFontCacheKey(name, isBold, isItalic);
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
  const drawTextRunWithSpacing = async (
    page: any,
    text: string,
    font: PDFFont,
    color: any,
    size: number,
    x: number,
    y: number,
    rotationDegrees: number,
    opacity: number,
    charSpacing: number
  ) => {
    if (!text) return;

    const pageAny = page as any;
    page.setFont(font);
    const fontKey = pageAny.fontKey;
    const graphicsStateKey = pageAny.maybeEmbedGraphicsState?.({
      opacity,
      blendMode: undefined,
    });

    page.pushOperators(
      pushGraphicsState(),
      ...(graphicsStateKey ? [setGraphicsState(graphicsStateKey)] : []),
      beginText(),
      setFillingColor(color),
      setFontAndSize(fontKey, size),
      setCharacterSpacing(charSpacing),
      rotateAndSkewTextDegreesAndTranslate(rotationDegrees, 0, 0, x, y),
      showText(font.encodeText(text)),
      endText(),
      popGraphicsState(),
    );
  };
  // --- FONT HELPER END ---

  const orderedAnnotations = annotations
    .map((ann, index) => ({ ann, index }))
    .sort((a, b) => {
      const layerA = a.ann.type === "redact" && a.ann.groupId ? 0 : 1;
      const layerB = b.ann.type === "redact" && b.ann.groupId ? 0 : 1;
      return layerA - layerB || a.index - b.index;
    })
    .map(({ ann }) => ann);

  for (const ann of orderedAnnotations) {
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
        const localFontMap = new Map<string, PDFFont>();
        const ensureRunFont = async (fontName?: string, isBold?: boolean, isItalic?: boolean) => {
          const resolvedFontName = fontName || ann.font || "Helvetica";
          const cacheKey = getFontCacheKey(resolvedFontName, isBold, isItalic);
          if (!localFontMap.has(cacheKey)) {
            localFontMap.set(cacheKey, await getFontForAnn(resolvedFontName, isBold, isItalic));
          }
          return localFontMap.get(cacheKey)!;
        };
        const baseFont = await ensureRunFont(ann.font, !!ann.isBold, !!ann.isItalic);

        const isHtml = /<[a-z][\s\S]*>/i.test(ann.content) || ann.content.includes("style=");
        let linesOfRuns: TextRun[][] = [];
        const boxWidth = isSideways ? h : w;
        const fontDensity = ann.fontDensity ?? 100;

        if (isHtml) {
          const hasExplicitBoldTags = /<b\b|<strong\b|font-weight:\s*(bold|700|800|900)/i.test(ann.content);
          const effectiveBaseBold = hasExplicitBoldTags ? false : !!ann.isBold;

          const flatRuns = parseRichText(ann.content, {
            color: ann.color || "#000000",
            isBold: effectiveBaseBold,
            isItalic: !!ann.isItalic,
            isUnderline: !!ann.isUnderline,
            font: ann.font || "Helvetica",
            size: fontSize
          });
          for (const run of flatRuns) {
            await ensureRunFont(run.font, run.isBold, run.isItalic);
          }
          linesOfRuns = wrapRichText(flatRuns, boxWidth, localFontMap, ann.font || "Helvetica", fontDensity);
        } else {
          const plainLines = breakTextIntoLines(ann.content, fontSize, baseFont, boxWidth, fontDensity);
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
            const runWidth = getRunWidth(run, localFontMap, ann.font || "Helvetica", fontDensity);
            const rotatedX = currentLineXOffset * cos - yOffset * sin;
            const rotatedY = currentLineXOffset * sin + yOffset * cos;
            const finalX = centerX + rotatedX;
            const finalY = centerY + rotatedY;

            const renderFontName = run.font || ann.font || "Helvetica";
            const runFont =
              localFontMap.get(getFontCacheKey(renderFontName, run.isBold, run.isItalic)) ||
              await ensureRunFont(renderFontName, run.isBold, run.isItalic);
            const runColor = safeHexToRgb01(run.color);
            const charSpacing = getCharacterSpacingForDensity(run.size, fontDensity);

            await drawTextRunWithSpacing(
              page,
              run.text,
              runFont,
              runColor,
              run.size,
              finalX,
              finalY,
              netRotation,
              op,
              charSpacing
            );

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


else if (ann.type === "image" && ann.content) {
  try {
    const imgBytes = await fetch(ann.content).then(r => r.arrayBuffer());
    let img;
    const header = new Uint8Array(imgBytes);
    // Embed image
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      img = await newDoc.embedPng(imgBytes);
    } else {
      img = await newDoc.embedJpg(imgBytes);
    }

    // 1. Determine the bounding box (Visual Slot)
    // If sideways (90/270 deg), we swap dimensions to match PDF axes
    const isSideways = rotation === 90 || rotation === 270;
    const boxWidth = isSideways ? h : w;
    const boxHeight = isSideways ? w : h;

    // 2. Calculate "object-fit: contain" dimensions
    const imgRatio = img.width / img.height;
    const boxRatio = boxWidth / boxHeight;

    let drawWidth = boxWidth;
    let drawHeight = boxHeight;

    // If image is "wider" than the box, constrain by width
    if (imgRatio > boxRatio) {
      drawHeight = boxWidth / imgRatio;
    } 
    // If image is "taller" than the box, constrain by height
    else {
      drawWidth = boxHeight * imgRatio;
    }

    // 3. Center the image within the bounding box
    const xOffset = (boxWidth - drawWidth) / 2;
    const yOffset = (boxHeight - drawHeight) / 2;

    // 4. Draw with corrected aspect ratio
    page.drawImage(img, { 
      x: pdfX + xOffset,
      y: pdfY + yOffset,
      width: drawWidth,
      height: drawHeight,
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
