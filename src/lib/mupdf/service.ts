/*
 * Nextooly – Online PDF Tools
 * Copyright (C) 2025 Nextooly
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
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFNumber,
  PDFString,
  PDFHexString,
} from "pdf-lib";
// import { loadMuPDF } from "./client";


// --- Custom Errors ---

export class PasswordProtectedError extends Error {
  constructor() {
    super("This PDF is password protected. Please remove the password and try again.");
    this.name = "PasswordProtectedError";
  }
}

export class PdfServiceError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PdfServiceError";
    this.code = code;
  }
}

// --- Configuration ---

export type CompressionLevel = "lossless" | "balanced" | "strong";

const CONFIG_MAP: Record<CompressionLevel, { quality: number; maxDimension: number }> = {
  lossless: { quality: 1.0, maxDimension: Infinity },
  balanced: { quality: 0.75, maxDimension: 1600 },
  strong: { quality: 0.5, maxDimension: 900 },
};

const MAX_CANVAS_PIXELS = 16777216;

// --- Helpers ---

function resolveMaybeRef(doc: PDFDocument, value: unknown): unknown {
  if (value instanceof PDFRef) return doc.context.lookup(value);
  return value;
}

function getName(doc: PDFDocument, dict: PDFDict, key: string): PDFName | undefined {
  const raw = dict.get(PDFName.of(key));
  if (!raw) return undefined;
  const resolved = resolveMaybeRef(doc, raw);
  return resolved instanceof PDFName ? resolved : undefined;
}

function getNumber(doc: PDFDocument, dict: PDFDict, key: string): number | undefined {
  const raw = dict.get(PDFName.of(key));
  if (!raw) return undefined;
  const resolved = resolveMaybeRef(doc, raw);
  return resolved instanceof PDFNumber ? resolved.asNumber() : undefined;
}

function getDecodeParms(doc: PDFDocument, dict: PDFDict): PDFDict | undefined {
  const raw = dict.get(PDFName.of("DecodeParms"));
  if (!raw) return undefined;
  const resolved = resolveMaybeRef(doc, raw);

  if (resolved instanceof PDFDict) return resolved;
  if (resolved instanceof PDFArray && resolved.size() > 0) {
    const first = resolveMaybeRef(doc, resolved.get(0));
    if (first instanceof PDFDict) return first;
  }
  return undefined;
}

// --- EXIF Stripper ---
function stripExifMetadata(jpegData: Uint8Array): Uint8Array {
  // ... (No changes to logic here, kept for brevity) ...
  if (jpegData[0] !== 0xff || jpegData[1] !== 0xd8) return jpegData;

  let offset = 2;
  const chunks: Uint8Array[] = [jpegData.slice(0, 2)];

  while (offset < jpegData.length) {
    if (jpegData[offset] !== 0xff) break;
    const marker = jpegData[offset + 1];
    if (marker === 0xff) { offset++; continue; }
    if (marker === 0xda) { chunks.push(jpegData.slice(offset)); break; }

    const len = (jpegData[offset + 2] << 8) | jpegData[offset + 3];
    const segmentLength = len + 2;

    if (marker === 0xe1) { /* Skip APP1 (EXIF) */ } 
    else { chunks.push(jpegData.slice(offset, offset + segmentLength)); }

    offset += segmentLength;
  }

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLen);
  let writePos = 0;
  for (const c of chunks) { result.set(c, writePos); writePos += c.length; }
  return result;
}

// --- Image Detection ---

type ColorSpaceInfo =
  | { type: "DeviceGray" }
  | { type: "DeviceRGB" }
  | { type: "DeviceCMYK" }
  | { type: "Indexed"; base: "DeviceRGB"; lookup: Uint8Array }
  | { type: "Unknown" };

function getColorSpaceInfo(doc: PDFDocument, dict: PDFDict): ColorSpaceInfo {
  // ... (Logic preserved) ...
  const rawCs = dict.get(PDFName.of("ColorSpace"));
  const resolved = resolveMaybeRef(doc, rawCs);

  if (resolved instanceof PDFName) {
    const name = resolved.asString();
    if (name === PDFName.of("DeviceGray").asString()) return { type: "DeviceGray" };
    if (name === PDFName.of("DeviceCMYK").asString()) return { type: "DeviceCMYK" };
    if (name === PDFName.of("DeviceRGB").asString()) return { type: "DeviceRGB" };
    return { type: "Unknown" };
  }

  if (resolved instanceof PDFArray && resolved.size() >= 4) {
    const typeName = resolveMaybeRef(doc, resolved.get(0));
    if (typeName instanceof PDFName && typeName.asString() === PDFName.of("Indexed").asString()) {
      const baseName = resolveMaybeRef(doc, resolved.get(1));
      if (baseName instanceof PDFName && baseName.asString() === PDFName.of("DeviceRGB").asString()) {
        const lookupRaw = resolveMaybeRef(doc, resolved.get(3));
        let lookupTable: Uint8Array | null = null;
        if (lookupRaw instanceof PDFRawStream) lookupTable = lookupRaw.contents;
        else if (lookupRaw instanceof PDFString || lookupRaw instanceof PDFHexString) lookupTable = lookupRaw.asBytes();

        if (lookupTable) return { type: "Indexed", base: "DeviceRGB", lookup: lookupTable };
      }
    }
  }
  return { type: "Unknown" };
}

function isCompressibleImage(doc: PDFDocument, dict: PDFDict): boolean {
  const rawFilter = dict.get(PDFName.of("Filter"));
  if (!rawFilter) return false;

  const resolved = resolveMaybeRef(doc, rawFilter);
  const filters: string[] = [];

  if (resolved instanceof PDFName) filters.push(resolved.asString());
  else if (resolved instanceof PDFArray) {
    for (let i = 0; i < resolved.size(); i++) {
      const item = resolveMaybeRef(doc, resolved.get(i));
      if (item instanceof PDFName) filters.push(item.asString());
    }
  }

  return filters.includes(PDFName.of("DCTDecode").asString()) || filters.includes(PDFName.of("FlateDecode").asString());
}

// --- Decompression & Decoding ---

async function inflateDeflate(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(new Uint8Array(bytes));
    writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  } catch (e) {
    throw new PdfServiceError("INFLATE_ERROR", "Failed to decompress image stream. The PDF structure may be damaged.");
  }
}

function pngUnfilter(data: Uint8Array, width: number, height: number, bytesPerPixel: number): Uint8Array {
  const rowSize = width * bytesPerPixel;
  const expected = height * (rowSize + 1);
  if (data.length < expected) {
    throw new PdfServiceError("STREAM_CORRUPT", "Image data stream is truncated or corrupted.");
  }

  const out = new Uint8Array(height * rowSize);
  const prevRow = new Uint8Array(rowSize);
  let srcOff = 0;
  let dstOff = 0;

  for (let y = 0; y < height; y++) {
    const filter = data[srcOff++];
    const row = data.subarray(srcOff, srcOff + rowSize);
    srcOff += rowSize;
    const curRow = out.subarray(dstOff, dstOff + rowSize);

    switch (filter) {
      case 0: // None
        curRow.set(row);
        break;
      case 1: // Sub
        for (let i = 0; i < rowSize; i++) {
          const left = i >= bytesPerPixel ? curRow[i - bytesPerPixel] : 0;
          curRow[i] = (row[i] + left) & 0xff;
        }
        break;
      case 2: // Up
        for (let i = 0; i < rowSize; i++) {
          curRow[i] = (row[i] + prevRow[i]) & 0xff;
        }
        break;
      case 3: // Average
        for (let i = 0; i < rowSize; i++) {
          const left = i >= bytesPerPixel ? curRow[i - bytesPerPixel] : 0;
          const up = prevRow[i];
          curRow[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
        }
        break;
      case 4: // Paeth
        for (let i = 0; i < rowSize; i++) {
          const a = i >= bytesPerPixel ? curRow[i - bytesPerPixel] : 0;
          const b = prevRow[i];
          const c = i >= bytesPerPixel ? prevRow[i - bytesPerPixel] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          curRow[i] = (row[i] + pr) & 0xff;
        }
        break;
      default:
        throw new PdfServiceError("PNG_FILTER_UNSUPPORTED", `Unsupported PNG filter type: ${filter}`);
    }
    prevRow.set(curRow);
    dstOff += rowSize;
  }
  return out;
}

async function decodeFlateStreamWithPredictor(
  compressed: Uint8Array,
  width: number,
  height: number,
  predictor: number | undefined,
  columns: number | undefined,
  bytesPerPixel: number
): Promise<Uint8Array> {
  const inflated = await inflateDeflate(compressed);
  const pred = predictor ?? 1;

  if (pred >= 10 && pred <= 15) {
    const cols = columns ?? width;
    if (cols !== width) {
      throw new PdfServiceError("PREDICTOR_MISMATCH", "Predictor columns mismatch. PDF may be malformed.");
    }
    return pngUnfilter(inflated, width, height, bytesPerPixel);
  }

  if (pred === 1) return inflated;

  throw new PdfServiceError("PREDICTOR_UNSUPPORTED", `Unsupported Predictor value: ${pred}`);
}

// --- Recompression ---

async function recompressImage(
  source: { type: "jpeg"; data: Uint8Array } | { type: "raw"; data: Uint8Array; cs: ColorSpaceInfo; predictor?: number; columns?: number },
  quality: number,
  maxDimension: number,
  origWidth: number,
  origHeight: number,
  hasAlpha: boolean
): Promise<{ data: Uint8Array; width: number; height: number }> {
  if (typeof window === "undefined") {
    throw new PdfServiceError("ENV_ERROR", "Image processing requires a browser environment.");
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new PdfServiceError("CANVAS_ERROR", "Browser graphics context unavailable. Your browser may be out of memory.");
  }

  let srcWidth = origWidth;
  let srcHeight = origHeight;
  let tempCanvas: HTMLCanvasElement | null = null;
  let bitmap: ImageBitmap | null = null;

  try {
    if (source.type === "jpeg") {
      const cleanData = stripExifMetadata(source.data);
      // const blob = new Blob([cleanData], { type: "image/jpeg" });
      const blob = new Blob([cleanData as any], {
        type: "application/pdf",
      });
      try {
        bitmap = await createImageBitmap(blob, { imageOrientation: "none" });
      } catch (e) {
        throw new PdfServiceError("IMAGE_DECODE_FAILED", "Failed to decode embedded JPEG image.");
      }

      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
      canvas.width = srcWidth;
      canvas.height = srcHeight;

      if (!hasAlpha) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, srcWidth, srcHeight);
      }
      ctx.drawImage(bitmap, 0, 0);
    } else {
      const pixelCount = origWidth * origHeight;
      const { cs } = source;
      
      const bytesPerPixel =
        cs.type === "DeviceGray" ? 1 :
        cs.type === "Indexed" ? 1 :
        cs.type === "DeviceRGB" ? 3 :
        cs.type === "DeviceCMYK" ? 4 : 0;

      if (!bytesPerPixel) {
        throw new PdfServiceError("COLORSPACE_UNSUPPORTED", `Unsupported color space type: ${cs.type}`);
      }

      const rawPixels = await decodeFlateStreamWithPredictor(
        source.data,
        origWidth,
        origHeight,
        source.predictor,
        source.columns,
        bytesPerPixel
      );

      const rgbaData = new Uint8ClampedArray(pixelCount * 4);

      // (Pixel mapping logic preserved exactly as is)
      if (cs.type === "DeviceGray") {
        for (let i = 0; i < pixelCount; i++) {
          const v = rawPixels[i];
          const d = i * 4;
          rgbaData[d] = v; rgbaData[d + 1] = v; rgbaData[d + 2] = v; rgbaData[d + 3] = 255;
        }
      } else if (cs.type === "DeviceRGB") {
        for (let i = 0; i < pixelCount; i++) {
          const s = i * 3; const d = i * 4;
          rgbaData[d] = rawPixels[s]; rgbaData[d + 1] = rawPixels[s + 1]; rgbaData[d + 2] = rawPixels[s + 2]; rgbaData[d + 3] = 255;
        }
      } else if (cs.type === "DeviceCMYK") {
        for (let i = 0; i < pixelCount; i++) {
          const s = i * 4; const d = i * 4;
          const c = rawPixels[s] / 255; const m = rawPixels[s + 1] / 255; const y = rawPixels[s + 2] / 255; const k = rawPixels[s + 3] / 255;
          rgbaData[d] = 255 * (1 - Math.min(1, c * (1 - k) + k));
          rgbaData[d + 1] = 255 * (1 - Math.min(1, m * (1 - k) + k));
          rgbaData[d + 2] = 255 * (1 - Math.min(1, y * (1 - k) + k));
          rgbaData[d + 3] = 255;
        }
      } else if (cs.type === "Indexed") {
        for (let i = 0; i < pixelCount; i++) {
          const idx = rawPixels[i]; const lut = idx * 3; const d = i * 4;
          if (lut + 2 >= cs.lookup.length) {
            rgbaData[d] = 0; rgbaData[d + 1] = 0; rgbaData[d + 2] = 0; rgbaData[d + 3] = 255;
          } else {
            rgbaData[d] = cs.lookup[lut]; rgbaData[d + 1] = cs.lookup[lut + 1]; rgbaData[d + 2] = cs.lookup[lut + 2]; rgbaData[d + 3] = 255;
          }
        }
      }

      const imgData = new ImageData(rgbaData, origWidth, origHeight);
      canvas.width = origWidth;
      canvas.height = origHeight;
      ctx.putImageData(imgData, 0, 0);
    }

    // Scaling Logic
    let targetWidth = srcWidth;
    let targetHeight = srcHeight;

    if (maxDimension < Infinity && (srcWidth > maxDimension || srcHeight > maxDimension)) {
      const ratio = srcWidth / srcHeight;
      if (srcWidth > srcHeight) {
        targetWidth = maxDimension; targetHeight = Math.round(maxDimension / ratio);
      } else {
        targetHeight = maxDimension; targetWidth = Math.round(maxDimension * ratio);
      }
    }

    if (targetWidth !== srcWidth || targetHeight !== srcHeight) {
      tempCanvas = document.createElement("canvas");
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new PdfServiceError("CANVAS_ALLOC_FAILED", "Failed to allocate scaling buffer.");

      if (!hasAlpha) {
        tempCtx.fillStyle = "#FFFFFF";
        tempCtx.fillRect(0, 0, targetWidth, targetHeight);
      }

      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = "high";
      tempCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((r) => tempCanvas!.toBlob(r, "image/jpeg", quality));
      if (!blob) throw new PdfServiceError("BLOB_FAILED", "Failed to generate compressed image blob.");

      return { data: new Uint8Array(await blob.arrayBuffer()), width: targetWidth, height: targetHeight };
    }

    const outBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!outBlob) throw new PdfServiceError("BLOB_FAILED", "Failed to generate compressed image blob.");

    return { data: new Uint8Array(await outBlob.arrayBuffer()), width: targetWidth, height: targetHeight };

  } catch (e: any) {
    if (e instanceof PdfServiceError) throw e;
    throw new PdfServiceError("IMG_PROC_ERR", `Image processing failed: ${e.message}`);
  } finally {
    bitmap?.close();
    canvas.remove();
    tempCanvas?.remove();
  }
}

// --- Main Service ---

export async function compressWithMuPDF(file: File, level: CompressionLevel): Promise<Uint8Array> {
  if (typeof window === "undefined") throw new PdfServiceError("CLIENT_ONLY", "This tool can only run in a browser environment.");

  let originalBytes: Uint8Array;
  try {
    originalBytes = new Uint8Array(await file.arrayBuffer());
  } catch(e) {
    throw new PdfServiceError("FILE_READ_ERR", "Could not read the input file.");
  }
  
  let phase1Bytes = originalBytes;

  if (level !== "lossless") {
    // 1. Password Detection (Manual)
    try {
      const decoder = new TextDecoder("latin1");
      const trailerStart = Math.max(0, originalBytes.length - 2048);
      const trailerText = decoder.decode(originalBytes.slice(trailerStart));
      const hasEncryptInTrailer = trailerText.includes("/Encrypt");
      const headerText = decoder.decode(originalBytes.slice(0, Math.min(1024, originalBytes.length)));
      const hasEncryptInHeader = headerText.includes("/Encrypt");
      if (hasEncryptInTrailer || hasEncryptInHeader) throw new PasswordProtectedError();
    } catch (e) {
      if (e instanceof PasswordProtectedError) throw e;
      // If detection fails, proceed and let PDFDocument.load handle it
    }

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    } catch (e) {
      // PDF-Lib failed to load. Likely corrupt or strongly encrypted.
      if (e instanceof Error && e.message.toLowerCase().includes("encrypted")) {
        throw new PasswordProtectedError();
      }
      throw new PdfServiceError("PDF_PARSE_FAILED", "Failed to parse PDF structure. The file may be corrupted.");
    }

    if (pdfDoc.isEncrypted) throw new PasswordProtectedError();

    const ctx = (pdfDoc as any).context;
    let optimized = 0;
    const { quality, maxDimension } = CONFIG_MAP[level];

    // Detect protected SMasks
    const protectedObjRefs = new Set<string>();
    try {
      for (const [, obj] of ctx.enumerateIndirectObjects()) {
        if (obj instanceof PDFDict) {
          const smaskRef = obj.get(PDFName.of("SMask"));
          if (smaskRef instanceof PDFRef) protectedObjRefs.add(smaskRef.toString());
        } else if (obj instanceof PDFRawStream) {
          const smaskRef = obj.dict.get(PDFName.of("SMask"));
          if (smaskRef instanceof PDFRef) protectedObjRefs.add(smaskRef.toString());
        }
      }
    } catch (e) {
      // Non-fatal if enumeration fails, just proceed without protection
      console.warn("Failed to enumerate objects for mask protection", e);
    }

    // Iterate Objects
    const objects = ctx.enumerateIndirectObjects();
    for (const [ref, obj] of objects) {
      if (protectedObjRefs.has(ref.toString())) continue;
      if (!(obj instanceof PDFRawStream)) continue;

      try {
        const subtype = getName(pdfDoc, obj.dict, "Subtype");
        if (!subtype || subtype.asString() !== PDFName.of("Image").asString()) continue;
        if (!isCompressibleImage(pdfDoc, obj.dict)) continue;
        if (getName(pdfDoc, obj.dict, "ImageMask")?.asString() === "true") continue;

        const oldWidth = getNumber(pdfDoc, obj.dict, "Width");
        const oldHeight = getNumber(pdfDoc, obj.dict, "Height");
        if (!oldWidth || !oldHeight || oldWidth * oldHeight > MAX_CANVAS_PIXELS) continue;

        const bpc = getNumber(pdfDoc, obj.dict, "BitsPerComponent");
        if (bpc && bpc !== 8) continue;

        const inBytes = obj.contents;
        const filter = resolveMaybeRef(pdfDoc, obj.dict.get(PDFName.of("Filter")));
        let isJpeg = false;

        if (filter instanceof PDFName && filter.asString() === PDFName.of("DCTDecode").asString()) isJpeg = true;
        else if (filter instanceof PDFArray) {
          const first = resolveMaybeRef(pdfDoc, filter.get(0));
          if (first instanceof PDFName && first.asString() === PDFName.of("DCTDecode").asString()) isJpeg = true;
        }

        const csInfo = getColorSpaceInfo(pdfDoc, obj.dict);
        if (csInfo.type === "Unknown") continue;

        const hasSMaskKey = obj.dict.has(PDFName.of("SMask"));
        const hasMaskKey = obj.dict.has(PDFName.of("Mask"));

        if (hasSMaskKey) { /* Proceed */ } 
        else if (hasMaskKey) { continue; }

        const hasAlpha = hasSMaskKey; 
        const effectiveMaxDimension = hasAlpha ? Infinity : maxDimension;

        const dp = getDecodeParms(pdfDoc, obj.dict);
        const predictor = dp ? getNumber(pdfDoc, dp, "Predictor") : undefined;
        const columns = dp ? getNumber(pdfDoc, dp, "Columns") : undefined;

        const result = await recompressImage(
          isJpeg
            ? { type: "jpeg", data: inBytes }
            : { type: "raw", data: inBytes, cs: csInfo, predictor, columns },
          quality,
          effectiveMaxDimension,
          oldWidth,
          oldHeight,
          hasAlpha
        );

        if (hasAlpha && (result.width !== oldWidth || result.height !== oldHeight)) {
          continue;
        }

        if (result.data.length < inBytes.length) {
          (obj as any).contents = result.data;
          obj.dict.set(PDFName.of("Width"), PDFNumber.of(result.width));
          obj.dict.set(PDFName.of("Height"), PDFNumber.of(result.height));
          obj.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
          obj.dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
          obj.dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));

          if (hasAlpha) {
            obj.dict.delete(PDFName.of("Mask"));
          } else {
            obj.dict.delete(PDFName.of("SMask"));
            obj.dict.delete(PDFName.of("Mask"));
          }
          obj.dict.delete(PDFName.of("Decode"));
          obj.dict.delete(PDFName.of("DecodeParms"));
          obj.dict.delete(PDFName.of("Predictor"));
          obj.dict.delete(PDFName.of("Palette"));
          optimized++;
        }
      } catch (e: any) {
        // CRITICAL:
        // We catch image-specific errors here so one bad image doesn't crash the whole PDF.
        // However, if the error implies the SYSTEM is broken (Canvas dead), we should throw.
        
        if (e instanceof PdfServiceError) {
             if (e.code === "CANVAS_ERROR" || e.code === "ENV_ERROR" || e.code === "CANVAS_ALLOC_FAILED") {
                 throw e;
             }
        }
        // For other image processing errors (corrupt stream, unsupported filter in one image),
        // we log and SKIP this image, allowing the rest of the PDF to be processed.
        console.warn("Skipping image optimization due to error:", e);
      }
    }

    if (optimized > 0) {
      try {
        phase1Bytes = await pdfDoc.save({ useObjectStreams: true });
      } catch (e) {
        throw new PdfServiceError("PDF_SAVE_FAILED", "Failed to re-serialize the PDF.");
      }
    }
  }

  // --- Phase 2: MuPDF Clean (WASM) ---
  
  let mupdf: any;
  try {
    mupdf = await import("mupdf");
  } catch (e) {
    throw new PdfServiceError("MUPDF_LOAD_FAILED", "Failed to load the MuPDF WASM module.");
  }

  const ab = phase1Bytes.buffer.slice(phase1Bytes.byteOffset, phase1Bytes.byteOffset + phase1Bytes.byteLength);
  let doc: any = null;
  let out: Uint8Array;

  try {
    // 1. CRITICAL: Try to OPEN the document.
    try {
        doc = (mupdf as any).PDFDocument.openDocument(ab, "application/pdf");
    } catch (e: any) {
        // MuPDF is strict. If it fails here, the PDF is likely structurally broken.
        throw new PdfServiceError("MUPDF_OPEN_FAILED", "MuPDF detected a corrupted PDF structure and could not open it.");
    }

    // 2. OPTIMIZE
    try {
        const buf = doc.saveToBuffer("garbage=3,compress,clean");
        out = buf.asUint8Array();
        buf.destroy?.();
    } catch (e) {
        throw new PdfServiceError("MUPDF_OPTIMIZE_FAILED", "MuPDF failed during the optimization pass.");
    }
  } finally {
    doc?.destroy?.();
  }

  return out.length < originalBytes.length ? out : originalBytes;
}

// --- PDF Unlock (MuPDF) ---

export async function unlockWithMuPDF(file: File, password: string): Promise<Uint8Array> {
  if (typeof window === "undefined") throw new Error("Client side only");

  let mupdf: any;
  try {
    mupdf = await import("mupdf");
  } catch (e: any) {
    throw new Error(`Failed to load PDF engine: ${e?.message ?? String(e)}`);
  }

  const data = await file.arrayBuffer();
  const pwd = (password ?? "").trim();

  let doc: any = null;
  let outBuf: any = null;

  const isPwdError = (msg: string) => {
    const m = msg.toLowerCase();
    return (
      m.includes("password") ||
      m.includes("encrypted") ||
      m.includes("encryption") ||
      m.includes("crypt") ||
      m.includes("needspassword")
    );
  };

  try {
    // 1) Try opening WITH password (some builds expect this)
    try {
      doc = mupdf.PDFDocument.openDocument(data, "application/pdf", pwd || undefined);
    } catch {
      // 2) Fall back to open without password
      doc = mupdf.PDFDocument.openDocument(data, "application/pdf");
    }

    // 3) If the doc still claims it needs a password, authenticate.
    //    IMPORTANT: Do NOT trust authenticatePassword() return value across builds.
    if (doc.needsPassword()) {
      if (!pwd) throw new Error("Password is required.");

      try {
        doc.authenticatePassword?.(pwd);
      } catch (e: any) {
        // Some builds throw on wrong password; treat as incorrect.
        const msg = String(e?.message ?? e);
        if (isPwdError(msg)) throw new Error("Incorrect password.");
        // Otherwise continue and let save attempt be the final arbiter.
      }
    } else {
      // Not password-protected: for Unlock tool UX, let UI decide what to show.
      // (We intentionally do NOT throw here.)
    }

    // 4) Save using decrypt (NOT clean).
    //    "clean" can preserve encryption metadata in some cases; "decrypt" is the correct intent.
    const optionAttempts = [
      "decrypt,garbage=deduplicate,continue-on-error",
      "decrypt,garbage=compact,continue-on-error",
      "decrypt,continue-on-error",
      "decrypt",
    ];

    let lastErr: any = null;

    for (const opts of optionAttempts) {
      try {
        outBuf = doc.saveToBuffer(opts);
        const bytesView = outBuf.asUint8Array();
        return new Uint8Array(bytesView); // copy out before destroy
      } catch (e: any) {
        lastErr = e;
        try {
          outBuf?.destroy?.();
        } catch {}
        outBuf = null;
      }
    }

    const msg = String(lastErr?.message ?? lastErr ?? "Unknown error");
    if (isPwdError(msg)) throw new Error("Incorrect password.");
    if (msg.toLowerCase().includes("zlib")) {
      throw new Error("Failed to unlock: PDF has malformed compressed streams (zlib header error).");
    }

    throw new Error(`Failed to unlock PDF: ${msg}`);
  } finally {
    try {
      outBuf?.destroy?.();
    } catch {}
    try {
      doc?.destroy?.();
    } catch {}
  }
}

export async function pdfNeedsPasswordMuPDF(file: File): Promise<boolean> {
  if (typeof window === "undefined") throw new Error("Client side only");

  const mupdf: any = await import("mupdf");
  const data = await file.arrayBuffer();

  let doc: any = null;
  try {
    doc = mupdf.PDFDocument.openDocument(data, "application/pdf");
    return !!doc.needsPassword();
  } finally {
    try {
      doc?.destroy?.();
    } catch {}
  }
}

// -------------------------------
// MuPDF Helpers (for Protect flow)
// -------------------------------

function withFilteredMuPdfConsole<T>(fn: () => T): T {
  const origError = console.error;
  const origWarn = console.warn;
  const origLog = console.log;

  const shouldDrop = (args: any[]) => {
    const first = args?.[0];
    const msg = typeof first === "string" ? first : "";
    return (
      msg.includes("format error: cannot recognize xref format") ||
      msg.startsWith("format error:") ||
      msg.startsWith("library error:")
    );
  };

  console.error = (...args: any[]) => { if (!shouldDrop(args)) origError(...args); };
  console.warn  = (...args: any[]) => { if (!shouldDrop(args)) origWarn(...args); };
  console.log   = (...args: any[]) => { if (!shouldDrop(args)) origLog(...args); };

  try {
    return fn();
  } finally {
    console.error = origError;
    console.warn = origWarn;
    console.log = origLog;
  }
}


export async function validatePdfForProtectMuPDF(file: File): Promise<{
  ok: boolean;
  reason?: "encrypted" | "corrupt";
}> {
  if (typeof window === "undefined") throw new Error("Client side only");

  const mupdf: any = await import("mupdf");
  const data = await file.arrayBuffer();

  let doc: any = null;
  let page: any = null;

  try {
    // Open + parse in a filtered console context to avoid dev overlay noise
    doc = withFilteredMuPdfConsole(() =>
      mupdf.PDFDocument.openDocument(data, "application/pdf")
    );

    // If it needs a password, we block Protect flow (per your policy)
    if (doc.needsPassword()) return { ok: false, reason: "encrypted" };

    // Deeper parse check: count pages + load first page
    const pageCount = doc.countPages?.() ?? 0;
    if (!pageCount || pageCount < 1) return { ok: false, reason: "corrupt" };

    page = withFilteredMuPdfConsole(() => doc.loadPage?.(0));

    return { ok: true };
  } catch {
    return { ok: false, reason: "corrupt" };
  } finally {
    try {
      page?.destroy?.();
    } catch {}
    try {
      doc?.destroy?.();
    } catch {}
  }
}

// -------------------------------
// PDF Protect (Encrypt) - MuPDF
// -------------------------------

export async function protectWithMuPDF(
  file: File,
  opts: {
    userPassword: string;
    ownerPassword?: string;
    algorithm?: "aes-256" | "aes-128" | "rc4-128" | "rc4-40";
  }
): Promise<Uint8Array> {
  if (typeof window === "undefined") throw new Error("Client side only");

  const mupdf: any = await import("mupdf");
  const data = await file.arrayBuffer();

  const userPwd = String(opts.userPassword ?? "").trim();
  const ownerPwd = String(opts.ownerPassword ?? "").trim();
  const algorithm = opts.algorithm ?? "aes-256";

  if (!userPwd) throw new Error("User password is required.");

  // MuPDF save options are comma-separated; remove commas from passwords
  const esc = (v: string) => v.replace(/,/g, "");

  let doc: any = null;
  let buf: any = null;

  try {
    // Open must succeed here; if the file is corrupt, it will throw.
    doc = mupdf.PDFDocument.openDocument(data, "application/pdf");

    // Minimal, stable encryption options
    const parts: string[] = [
      `encrypt=${algorithm}`,
      `user-password=${esc(userPwd)}`,
      "garbage=compact",
    ];

    if (ownerPwd) parts.push(`owner-password=${esc(ownerPwd)}`);

    buf = doc.saveToBuffer(parts.join(","));
    const view = buf.asUint8Array();
    return new Uint8Array(view);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    throw new Error(`Failed to protect PDF: ${msg}`);
  } finally {
    try {
      buf?.destroy?.();
    } catch {}
    try {
      doc?.destroy?.();
    } catch {}
  }
}









