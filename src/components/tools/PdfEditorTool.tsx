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
"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { detectColors } from "@/app/pdf-edit/edit-text-utils";
import { EditTextOverlay } from "@/app/pdf-edit/EditTextOverlay";
import { EditTextContextBar } from "@/app/pdf-edit/EditTextContextBar";
import { EditorState, Annotation, ToolType, HistorySnapshot, DragHandleType } from "@/app/pdf-edit/types";
import { RichTextEditor } from "@/app/pdf-edit/RichTextEditor";
import { PageThumbnail } from "@/app/pdf-edit/PageThumbnail";
import { INITIAL_STATE } from "@/app/pdf-edit/constants";
import { getFontClass, getPathBounds } from "@/app/pdf-edit/utils";
import { SignatureModal, QrModal, StampModal, MetadataModal } from "@/app/pdf-edit/EditorModals";
import "@/app/pdf-edit/pdf-editor.css";
import { Icons } from "@/app/pdf-edit/EditorIcons";
import { renderPageWithMuPDF, getPdfFormFields, type PdfFormField, saveEditedPdf, getPdfPageCount, AVAILABLE_FONTS, getPdfMetadata, getPageText, type TextItem } from "@/lib/mupdf/edit-service";

const TOOLBAR_CONFIG = [
  { id: "cursor", icon: Icons.Cursor, title: "Select", className: "nav-btn-icon-only" },
  { id: "text", icon: Icons.Type, label: "Add Text", color: "#000000" },
  { id: "edit_text", icon: Icons.Edit, label: "Edit Text (Lite)", title: "Click text on the page to edit it" },
  { id: "redact", icon: Icons.Redact, label: "Redact", color: "#ffffff" },
];

const SHAPE_TOOLS = [
  { id: "draw", icon: Icons.Brush, color: "#000000", opacity: 1, brushSize: 3, title: "Free Draw" },
  { id: "rect", icon: Icons.Square, color: "#000000", opacity: 1, title: "Rectangle" },
  { id: "circle", icon: Icons.Circle, color: "#ff0000", opacity: 1, title: "Circle" },
  { id: "line", icon: Icons.Minus, color: "#000000", opacity: 1, title: "Line" },
  { id: "arrow", icon: Icons.Arrow, color: "#000000", opacity: 1, title: "Arrow" },
];

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'u', 'span', 'div', 'br', 'strong', 'em', 'p'],
  ALLOWED_ATTR: ['style', 'class', 'color'],
};

// Helper to create new annotation objects cleanly
const createNewAnnotation = (
  tool: string,
  id: string,
  pageIndex: number,
  x: number,
  y: number,
  opts: { color: string; opacity: number; fontSize?: number; font?: string; brushSize?: number }
): Annotation | null => {
  const base = { id, pageIndex, opacity: opts.opacity, color: opts.color };

  switch (tool) {
    case "text":
      return { ...base, type: "text", x, y, width: 0.18, height: 0.025, content: "Type here", size: opts.fontSize, font: opts.font };
    case "rect":
      return { ...base, type: "rect", x, y, width: 0.2, height: 0.05, isFill: opts.opacity < 1 || (opts.color === "#ffffff" && opts.opacity === 1) };
    case "redact":
      return { ...base, type: "redact", x, y, width: 0.2, height: 0.05, opacity: 1, isFill: true };
    case "circle":
      return { ...base, type: "circle", x, y, width: 0.15, height: 0.15, size: 3 };
    case "arrow":
      return { ...base, type: "arrow", x: 0, y: 0, paths: [{ x, y }, { x, y }], size: 2 };
    case "draw":
    case "line":
      return {
        ...base,
        type: "path",
        subtype: tool === "draw" ? "freehand" : "line",
        x: 0, y: 0,
        paths: [{ x, y }, { x, y }],
        size: tool === "line" ? 2 : opts.brushSize
      };
    default:
      return null;
  }
};

/** ---------------- Component ---------------- */
export default function PdfEditorTool() {
  const [state, setState] = useState<EditorState & { pdfFormFields: PdfFormField[] }>({
    ...INITIAL_STATE,
    pdfFormFields: [] // Initialize empty array
  });
  const [activeDropdown, setActiveDropdown] = useState<"shapes" | "insert" | null>(null);
  const [isBottomBarExpanded, setBottomBarExpanded] = useState(true);
  const [textSelectMode, setTextSelectMode] = useState<"block" | "line">("line");
  // const [defaultLineHeight, setDefaultLineHeight] = useState(1.15);
  // const [eraserPadding, setEraserPadding] = useState(0);
  const [eraserPaddingX, setEraserPaddingX] = useState(0);  // Horizontal (Default 2%)
  const [eraserPaddingY, setEraserPaddingY] = useState(0);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  // Logic Refs
  const isDrawing = useRef(false);
  const drawingAnnId = useRef<string | null>(null);
  const dragMode = useRef<null | "move" | "resize">(null);
  const dragHandle = useRef<DragHandleType>(null);
  const dragStart = useRef<{
    x: number; y: number; annX: number; annY: number; annW: number; annH: number;
    id: string; subtype?: string; groupId?: string;
    paths?: { x: number; y: number }[]
  } | null>(null);
  const hasMoved = useRef(false);
  const loadRequestId = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAnn = useMemo(() => state.annotations.find(a => a.id === state.selectedId), [state.annotations, state.selectedId]);
  const applyRelativeFontSize = (factor: number) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const span = document.createElement("span");
    span.style.fontSize = `${factor}em`;
    const range = selection.getRangeAt(0);
    span.appendChild(range.extractContents());
    range.insertNode(span);
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);
    const activeEl = document.querySelector('[contenteditable="true"]:focus');
    const editor = span.closest('[contenteditable="true"]');
    if (editor) {
      updateProperty("content", editor.innerHTML);
    }
  };

  const handleEditAnnotation = (ann: Annotation) => {
    setState(s => ({ ...s, editingId: ann.id }));
    if (ann.subtype === "qr") {
      setState(s => ({
        ...s,
        editingId: ann.id,
        showQrModal: true,
        qrText: ann.meta?.text || "",
        savedQr: ann.content || null
      }));
    }
    else if (ann.subtype === "stamp") {
      setState(s => ({
        ...s,
        editingId: ann.id,
        showStampModal: true,
        savedStamp: ann.content || null
      }));
    }
    else if (ann.subtype === "signature") {
      setState(s => ({
        ...s,
        editingId: ann.id,
        showSignatureModal: true
      }));
    }
  };

  const handleSelectionPointChange = (delta: number) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    let node = selection.anchorNode;
    const element = (node?.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement;
    if (!element) return;
    const currentPx = parseFloat(window.getComputedStyle(element).fontSize);
    const currentPdfPoints = currentPx / state.scale;
    if (!currentPdfPoints || currentPdfPoints <= 0) return;
    const newPdfPoints = Math.round((currentPdfPoints + delta) * 10) / 10;
    if (newPdfPoints < 1) return;
    const ratio = newPdfPoints / currentPdfPoints;
    applyRelativeFontSize(ratio);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const savedSig = localStorage.getItem("nextooly_signature");
    const savedName = localStorage.getItem("nextooly_name");
    const savedStamp = localStorage.getItem("nextooly_stamp");
    const savedQr = localStorage.getItem("nextooly_qr");
    setState(s => ({ ...s, savedSignature: savedSig, savedName: savedName, savedStamp: savedStamp, savedQr: savedQr }));
  }, []);

  // ---------- History ----------
  const pushHistory = useCallback((next: Partial<HistorySnapshot> = {}) => {
    setState((prev) => {
      const currentSnapshot: HistorySnapshot = {
        annotations: prev.annotations,
        deletedPages: Array.from(prev.deletedPages),
        pageRotations: prev.pageRotations,
        pageOrder: prev.pageOrder,
        meta: prev.metadata
      };
      const newSnapshot: HistorySnapshot = {
        annotations: next.annotations ?? currentSnapshot.annotations,
        deletedPages: next.deletedPages ?? currentSnapshot.deletedPages,
        pageRotations: next.pageRotations ?? currentSnapshot.pageRotations,
        pageOrder: next.pageOrder ?? currentSnapshot.pageOrder,
        meta: next.meta ?? currentSnapshot.meta
      };
      const trimmed = prev.history.slice(0, prev.historyStep + 1);
      const newHistory = [...trimmed, newSnapshot].slice(-50);
      return {
        ...prev,
        annotations: newSnapshot.annotations,
        deletedPages: new Set(newSnapshot.deletedPages),
        pageRotations: newSnapshot.pageRotations,
        pageOrder: newSnapshot.pageOrder,
        metadata: { ...prev.metadata, ...newSnapshot.meta },
        history: newHistory,
        historyStep: newHistory.length - 1,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.historyStep === 0) return prev;
      const step = prev.historyStep - 1;
      const snap = prev.history[step];
      return {
        ...prev,
        historyStep: step,
        annotations: snap.annotations,
        deletedPages: new Set(snap.deletedPages),
        pageRotations: snap.pageRotations,
        pageOrder: snap.pageOrder,
        metadata: { ...prev.metadata, ...(snap.meta || {}) },
        selectedId: null
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      if (prev.historyStep >= prev.history.length - 1) return prev;
      const step = prev.historyStep + 1;
      const snap = prev.history[step];
      return {
        ...prev,
        historyStep: step,
        annotations: snap.annotations,
        deletedPages: new Set(snap.deletedPages),
        pageRotations: snap.pageRotations,
        pageOrder: snap.pageOrder,
        metadata: { ...prev.metadata, ...(snap.meta || {}) },
        selectedId: null
      };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const tagName = (e.target as HTMLElement).tagName.toUpperCase();
        if (tagName === "INPUT" || tagName === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
        if (state.selectedId) {
          e.preventDefault();
          const current = state.annotations.find(a => a.id === state.selectedId);
          const groupId = current?.groupId;

          const next = state.annotations.filter(a => {
            if (a.id === state.selectedId) return false;
            if (groupId && a.groupId === groupId && a.type === "redact") return false;
            return true;
          });

          pushHistory({ annotations: next });
          setState(s => ({ ...s, selectedId: null }));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, state.selectedId, state.annotations, pushHistory]);

  const updateProperty = (key: keyof Annotation, value: any, skipHistory: boolean = false) => {
    setState(prev => {
      const extra: Partial<EditorState> = {};
      if (key === "color") extra.color = value;
      if (key === "opacity") extra.opacity = value;
      if (key === "size" && state.tool === "text") extra.fontSize = value;
      if (key === "font") extra.font = value;
      return { ...prev, ...extra };
    });

    if (state.selectedId) {
      const currentItem = state.annotations.find(a => a.id === state.selectedId);
      if (!currentItem) return;

      const next = state.annotations.map(a => {
        const isMatch = a.id === state.selectedId;
        const isGroupMatch = currentItem.groupId && a.groupId === currentItem.groupId;

        if (isMatch || isGroupMatch) {
          if (currentItem.subtype === "editor") {
            if (key === "color" && a.type === "text") return { ...a, color: value };
            if (key === "backgroundColor" && a.type === "redact") return { ...a, color: value };
            if ((key === "size" || key === "font" || key === "isBold" || key === "isItalic" || key === "isUnderline" || key === "lineHeight") && a.type === "text") {
              return { ...a, [key]: value };
            }
            if (a.type === "redact" && (key === "color" || key === "size" || key === "font")) return a;
            return a;
          }
          return { ...a, [key]: value };
        }
        return a;
      });
      if (skipHistory) {
        setState(prev => ({ ...prev, annotations: next }));
      } else {
        pushHistory({ annotations: next });
      }
    }
  };

  const executeRichTextCommand = (command: string) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const isInsideEditor = selection.anchorNode?.parentElement?.closest('[contenteditable="true"]');
      if (isInsideEditor) {
        document.execCommand(command, false);

        if (isInsideEditor instanceof HTMLElement) {
          // updateProperty("content", isInsideEditor.innerHTML);
          const cleanHtml = DOMPurify.sanitize(isInsideEditor.innerHTML, SANITIZE_CONFIG);
          updateProperty("content", cleanHtml);
        }
        return true;
      }
    }
    return false;
  };

  const toggleBold = () => {
    if (!state.selectedId) return;
    if (!executeRichTextCommand("bold")) {
      const current = state.annotations.find(a => a.id === state.selectedId);
      if (current && (current.type === "text" || current.type === "text_edit")) {
        updateProperty("isBold", !current.isBold);
      }
    }
  };

  const toggleItalic = () => {
    if (!state.selectedId) return;
    if (!executeRichTextCommand("italic")) {
      const current = state.annotations.find(a => a.id === state.selectedId);
      if (current && (current.type === "text" || current.type === "text_edit")) {
        updateProperty("isItalic", !current.isItalic);
      }
    }
  };

  const toggleUnderline = () => {
    if (!state.selectedId) return;
    if (!executeRichTextCommand("underline")) {
      const current = state.annotations.find(a => a.id === state.selectedId);
      if (current && (current.type === "text" || current.type === "text_edit")) {
        updateProperty("isUnderline", !current.isUnderline);
      }
    }
  };

  const applyTextColor = (color: string, skipHistory: boolean = false) => {
    if (!state.selectedId) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const isInsideEditor = selection.anchorNode?.parentElement?.closest('[contenteditable="true"]');
      if (isInsideEditor) {
        document.execCommand("foreColor", false, color);
        if (isInsideEditor instanceof HTMLElement) {
          updateProperty("content", isInsideEditor.innerHTML, skipHistory);
        }
        return;
      }
    }
    updateProperty("color", color, skipHistory);
  };

  // ---------- Render Loop ----------
  useEffect(() => {
    if (!state.fileBuffer || state.status !== "ready") return;
    if (!canvasRef.current) return;

    const actualPageIndex = state.pageOrder[state.currentPage];
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // A. Handle Deleted Page
    if (state.deletedPages.has(actualPageIndex)) {
      const w = state.pageSize.width || 595; // fallback width
      const h = state.pageSize.height || 842;
      canvasRef.current.width = w;
      canvasRef.current.height = h;

      ctx.fillStyle = "#f1f5f9"; // Slate-100
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#94a3b8"; // Slate-400
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAGE DELETED", w / 2, h / 2);
      return;
    }

    if (actualPageIndex === -1) {
      const dpr = window.devicePixelRatio || 1;
      const w = 595 * state.scale;
      const h = 842 * state.scale;
      if (Math.abs(state.pageSize.width - w) > 1 || Math.abs(state.pageSize.height - h) > 1) {
        setState(s => ({ ...s, pageSize: { width: w, height: h } }));
      }

      canvasRef.current.width = w * dpr;
      canvasRef.current.height = h * dpr;
      canvasRef.current.style.width = `${w}px`;
      canvasRef.current.style.height = `${h}px`;

      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      return;
    }

    // C. Render Actual PDF Page
    let isMounted = true;
    const renderImg = async () => {
      try {
        const dpr = window.devicePixelRatio || 1;
        const res = await renderPageWithMuPDF(state.fileBuffer!, actualPageIndex, state.scale * dpr);

        if (!isMounted) return;

        // Convert raw pixels back to CSS pixels for layout
        const cssW = res.width / dpr;
        const cssH = res.height / dpr;

        setState(s => {
          if (s.pageSize.width === cssW && s.pageSize.height === cssH) return s;
          return { ...s, pageSize: { width: cssW, height: cssH } };
        });

        const canvas = canvasRef.current!;
        canvas.width = res.width;
        canvas.height = res.height;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        // Put exact pixel data
        const renderCtx = canvas.getContext("2d");
        if (renderCtx) {
          renderCtx.putImageData(res.imageData, 0, 0);
        }
      } catch (e) { console.error("Render failed:", e); }
    };

    renderImg();
    return () => { isMounted = false; };
  }, [state.fileBuffer, state.currentPage, state.pageOrder, state.scale, state.pageRotations, state.status, state.deletedPages]);


  useEffect(() => {
    if (!state.fileBuffer || state.status !== "ready") return;
    setState(s => ({ ...s, extractedBlocks: [] })); // Was extractedLines: []

    const actualPageIndex = state.pageOrder[state.currentPage];
    if (state.deletedPages.has(actualPageIndex) || actualPageIndex === -1) return;

    let isMounted = true;
    const extractText = async () => {
      try {
        const blocks = await getPageText(state.fileBuffer!, actualPageIndex, textSelectMode);

        if (isMounted) {
          setState(s => ({ ...s, extractedBlocks: blocks })); // Was extractedLines: lines
        }
      } catch (e) {
        console.error("[Text Extract] Failed:", e);
      }
    };

    extractText();
    return () => { isMounted = false; };
  }, [state.fileBuffer, state.currentPage, state.pageOrder, state.status, state.deletedPages, textSelectMode]);

  const guessFont = (fontName?: string) => {
    if (!fontName) return "Helvetica";
    const lower = fontName.toLowerCase();
    if (lower.includes("times") || lower.includes("serif")) return "Times Roman";
    if (lower.includes("courier") || lower.includes("mono")) return "Courier";
    return "Helvetica";
  };

  const handleTextBlockClick = (block: TextItem) => {
    const id = Date.now().toString();
    const redactId = `redact-${id}`;
    const groupId = `group-${id}`;

    const shrinkX = block.width * (eraserPaddingX / 100);
    const shrinkY = block.height * (eraserPaddingY / 100);

    const { bg, palette: scannedPalette, bgPalette } = detectColors(block, canvasRef.current);
    const exactTextColor = block.color || scannedPalette[0] || "#000000";
    const distinctColors = new Set<string>();
    if (block.color) distinctColors.add(block.color);
    scannedPalette.forEach(c => distinctColors.add(c));
    const finalPalette = Array.from(distinctColors).slice(0, 5);

    // 4. Create "Eraser" Patch
    const patchAnn: Annotation = {
      id: redactId,
      type: "redact",
      groupId: groupId,
      pageIndex: state.currentPage,

      // Apply margins
      x: block.x + (shrinkX / 2),
      y: block.y + (shrinkY / 2),
      width: block.width - shrinkX,
      height: block.height - shrinkY,

      color: bg,
      opacity: 1,
      isFill: true,
      originalBounds: { x: block.x, y: block.y, width: block.width, height: block.height }
    };

    // 5. Create Editable Text
    const textAnn: Annotation = {
      id: id,
      type: "text_edit",
      subtype: "editor",
      groupId: groupId,
      pageIndex: state.currentPage,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      content: block.text.replace(/\n/g, "<br/>"),
      color: exactTextColor,
      isBold: block.isBold || false,
      size: block.fontSize,
      font: guessFont(block.fontName),
      opacity: 1,
    };

    pushHistory({
      annotations: [...state.annotations, patchAnn, textAnn]
    });

    setState(s => ({
      ...s,
      tool: "cursor",
      selectedId: id,
      activePalette: finalPalette,
      activeBgPalette: bgPalette // <--- Save the background palette to state
    }));
  };

  const getRelCoords = (e: React.MouseEvent | MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 1. Validation & Coordinates
    if (state.deletedPages.has(state.pageOrder[state.currentPage])) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const id = Date.now().toString();

    // 2. Cursor / Selection Logic (Optimized: No Array Copying)
    if (state.tool === "cursor") {
      let hitId: string | null = null;
      // Loop backwards to find the topmost item (visually on top)
      for (let i = state.annotations.length - 1; i >= 0; i--) {
        const a = state.annotations[i];
        if (a.pageIndex === state.currentPage &&
          a.type !== "path" && a.type !== "arrow" &&
          x >= a.x && x <= a.x + (a.width || 0.2) &&
          y >= a.y && y <= a.y + (a.height || 0.05) &&
          !(a.type === "redact" && a.groupId)) {
          hitId = a.id;
          break; // Stop immediately upon finding the top item
        }
      }
      setState(s => ({ ...s, selectedId: hitId }));
      return;
    }

    // 3. Helper for Complex "Drop" Tools (Signature, Stamp, QR)
    const handleImageDrop = (source: string, subtype: "signature" | "stamp" | "qr", wFactor: number, hFactorBase: number) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.height / img.width;
        const pageRatio = canvasRef.current ? (canvasRef.current.width / canvasRef.current.height) : 1;
        pushHistory({
          annotations: [...state.annotations, {
            id, type: "image", subtype, pageIndex: state.currentPage,
            x: x - (wFactor / 2),
            y: y - ((wFactor * aspect * pageRatio) / 2),
            width: wFactor,
            height: wFactor * aspect * pageRatio,
            content: source, opacity: 1, meta: { imgAspect: aspect }
          }]
        });
        setState(s => ({ ...s, tool: "cursor", selectedId: id }));
      };
      img.src = source;
    };

    if (state.tool === "signature_drop" && state.savedSignature) {
      return handleImageDrop(state.savedSignature, "signature", 0.2, 0.1);
    }
    else if (state.tool === "stamp_drop" && state.savedStamp) {
      return handleImageDrop(state.savedStamp, "stamp", 0.2, 0.1);
    }
    else if (state.tool === "qr_drop" && state.savedQr) {
      return handleImageDrop(state.savedQr, "qr", 0.15, 0.075);
    }

    // 4. Standard Tools (Optimized via Helper)
    const newAnn = createNewAnnotation(state.tool, id, state.currentPage, x, y, {
      color: state.color,
      opacity: state.opacity,
      fontSize: state.fontSize,
      font: state.font,
      brushSize: state.brushSize
    });

    // 5. Commit Standard Annotation
    if (newAnn) {
      if (["draw", "line", "arrow"].includes(state.tool)) {
        isDrawing.current = true;
        drawingAnnId.current = id;
        hasMoved.current = false;
        setState(s => ({ ...s, annotations: [...s.annotations, newAnn!] }));
      } else {
        pushHistory({ annotations: [...state.annotations, newAnn] });
        setState(s => ({ ...s, tool: "cursor", selectedId: id }));
      }
    }
  };

  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    if (dragMode.current && dragStart.current) {
      e.preventDefault();
      hasMoved.current = true;
      const { x, y } = getRelCoords(e);
      const ds = dragStart.current;
      const dx = x - ds.x;
      const dy = y - ds.y;
      const activeId = ds.id;

      setState(prev => {
        // Optimization: We removed the .find() call here entirely
        return {
          ...prev,
          annotations: prev.annotations.map(a => {
            const isMatch = a.id === activeId;
            const isGroupMatch = ds.groupId && a.groupId === ds.groupId;

            // Optimization: Read subtype directly from Ref
            if (ds.subtype === "editor" && a.type === "redact" && isGroupMatch) {
              return a;
            }
            if (!isMatch && !isGroupMatch) return a;

            if (dragMode.current === "move") {
              if ((a.type === "path" || a.type === "arrow") && ds.paths) {
                return { ...a, paths: ds.paths.map(p => ({ x: p.x + dx, y: p.y + dy })) };
              }
              const originX = isMatch ? ds.annX : a.x;
              const originY = isMatch ? ds.annY : a.y;
              return { ...a, x: originX + dx, y: originY + dy };
            }
            return { ...a, width: Math.max(0.01, ds.annW + dx), height: Math.max(0.01, ds.annH + dy) };
          })
        };
      });
    }
  }, []);

  const handleWindowMouseUp = useCallback(() => {
    if (dragMode.current) {
      if (hasMoved.current) {
        pushHistory({});
      }
      dragMode.current = null;
      hasMoved.current = false;
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    }
  }, [pushHistory, handleWindowMouseMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [handleWindowMouseMove, handleWindowMouseUp]);

  const handleDrawMove = (e: React.MouseEvent) => {
    if (isDrawing.current && drawingAnnId.current) {
      const { x, y } = getRelCoords(e);
      hasMoved.current = true;
      setState(prev => ({
        ...prev,
        annotations: prev.annotations.map(a => {
          if (a.id !== drawingAnnId.current) return a;
          if (prev.tool === "line" || prev.tool === "arrow") {
            return { ...a, paths: [a.paths![0], { x, y }] };
          }
          return { ...a, paths: [...(a.paths || []), { x, y }] };
        })
      }));
    }
  };

  const handleDrawUp = () => {
    if (isDrawing.current) {
      const newlyCreatedId = drawingAnnId.current;
      pushHistory({});
      isDrawing.current = false;
      drawingAnnId.current = null;
      if (state.tool === "draw" || state.tool === "line" || state.tool === "arrow") {
        setState(s => ({
          ...s,
          tool: "cursor",
          selectedId: newlyCreatedId // Optional: Select the new item immediately
        }));
      }
    }
  };

  const beginDrag = (e: React.MouseEvent, type: "move" | "resize", handle: DragHandleType, ann: Annotation) => {
    e.preventDefault();
    e.stopPropagation();
    dragMode.current = type;
    dragHandle.current = handle;
    hasMoved.current = false;
    const { x, y } = getRelCoords(e);

    dragStart.current = {
      x, y,
      annX: ann.x, annY: ann.y,
      annW: ann.width || 0, annH: ann.height || 0,
      id: ann.id,
      subtype: ann.subtype, // Added
      groupId: ann.groupId, // Added
      paths: ann.paths ? JSON.parse(JSON.stringify(ann.paths)) : undefined
    };

    setState(s => ({ ...s, selectedId: ann.id }));
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
  };

  // =========================================================================
  // 1. HELPER: Safe File Reading
  // Fixes "f.arrayBuffer is not a function" error on older browsers/Safari
  // =========================================================================
  const readFileToBuffer = (file: File): Promise<ArrayBuffer> => {
    if (typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert file to ArrayBuffer"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFile = async (f: File) => {
    if (!f) return;
    // 1. Increment ID to track this specific request
    const reqId = ++loadRequestId.current;
    try {
      setState(s => ({ ...s, status: "processing" }));
      const buf = await readFileToBuffer(f);
      let count = 0;
      try {
        count = await getPdfPageCount(buf);
      } catch (e) {
        console.error("Failed to get page count", e);
        alert("Could not parse PDF. Please try another file.");
        setState(s => ({ ...s, status: "idle" }));
        return;
      }

      const [meta, formFields] = await Promise.all([
        getPdfMetadata(buf),
        getPdfFormFields(buf)
      ]);

      const initialOrder = Array.from({ length: count }, (_, i) => i);
      const initialMetadata = {
        title: meta.title,
        author: meta.author,
        subject: meta.subject,
        keywords: meta.keywords,
        creator: meta.creator,
        producer: meta.producer,
        creationDate: meta.creationDate,
        modificationDate: meta.modificationDate
      };

      const initialSnapshot: HistorySnapshot = {
        annotations: [],
        deletedPages: [],
        pageRotations: {},
        pageOrder: [...initialOrder], // Clone array to be safe
        meta: initialMetadata
      };

      // 2. Fix: Check if a newer file load has started since we began
      if (reqId !== loadRequestId.current) return;

      setState({
        ...INITIAL_STATE,
        status: "ready",
        file: f,
        fileBuffer: buf,
        numPages: count,
        pageOrder: initialOrder,
        scale: 1.5,

        pdfFormFields: formFields,
        metadata: initialMetadata,
        history: [initialSnapshot],
        historyStep: 0,

        // Restore User Preferences from LocalStorage
        savedSignature: localStorage.getItem("nextooly_signature"),
        savedName: localStorage.getItem("nextooly_name"),
        savedStamp: localStorage.getItem("nextooly_stamp"),
        savedQr: localStorage.getItem("nextooly_qr")
      });

    } catch (err: any) {
      // 3. Fix: Check here too
      if (reqId !== loadRequestId.current) return;
      console.error("Error loading file:", err);
      // Check for password/encryption errors in the outer scope too
      const isPasswordError = err.message?.toLowerCase().includes("password") ||
        err.message?.toLowerCase().includes("encrypt") ||
        // Fallback: If it's a "Format Error" or generic load fail, it's often a password issue
        true;
      if (isPasswordError) {
        setState(s => ({ ...s, status: "idle", showPasswordModal: true }));
      } else {
        setState(s => ({ ...s, status: "error" }));
      }
    }
  };

  const updateFormField = (name: string, newValue: string | boolean) => {
    setState(prev => ({
      ...prev,
      pdfFormFields: prev.pdfFormFields.map(f =>
        f.name === name ? { ...f, value: newValue } : f
      )
    }));
  };

  const handleSave = async () => {
    if (!state.fileBuffer) return;
    setState(s => ({ ...s, status: "processing" }));

    try {
      const hasRedactions = state.annotations.some(a =>
        a.type === "redact" ||
        (a.type === "rect" && a.color === "#ffffff" && (a.isFill || a.opacity === 1))
      );

      const formValues: Record<string, string | boolean> = {};
      state.pdfFormFields.forEach(f => {
        if (f.value !== undefined) {
          formValues[f.name] = f.value as string | boolean;
        }
      });

      const pdfBytes = await saveEditedPdf(
        state.fileBuffer,
        state.annotations,
        state.deletedPages,
        state.pageRotations,
        state.pageOrder,
        state.metadata,
        {
          flatten: state.flattenOnSave,
          redact: hasRedactions || state.flattenOnSave
        },
        formValues
      );

      const originalName = state.file?.name.replace(/\.pdf$/i, "") || "document";
      const defaultName = `${originalName}-edited-${Date.now()}.pdf`;

      // 4. Save File (FileSystem Access API)
      // @ts-ignore - window.showSaveFilePicker is a newer API
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultName,
            types: [{
              description: 'PDF Document',
              accept: { 'application/pdf': ['.pdf'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(pdfBytes);
          await writable.close();
          setState(s => ({ ...s, status: "ready" }));
          return; // Success! Exit function.
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setState(s => ({ ...s, status: "ready" }));
            return;
          }
          console.warn("Save As dialog failed, falling back to standard download.", err);
        }
      }

      //Fallback: Standard Download (for browsers without File System API)
      // const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const blob = new Blob([pdfBytes as any], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = defaultName;
      document.body.appendChild(link); // Append to DOM to ensure click works in all browsers
      link.click();
      document.body.removeChild(link); // Clean up
      URL.revokeObjectURL(url); // Free memory

      setState(s => ({ ...s, status: "ready" }));

    } catch (e) {
      console.error(e);
      setState(s => ({ ...s, status: "error", error: "Save failed" }));
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      localStorage.setItem("nextooly_qr", result);
      setState(s => ({ ...s, savedQr: result, tool: "qr_drop" }));
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const adjustFontSize = (delta: number) => {
    if (!state.selectedId) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const isInsideEditor = selection.anchorNode?.parentElement?.closest('[contenteditable="true"]');
      if (isInsideEditor) {
        handleSelectionPointChange(delta);
        return;
      }
    }

    const master = state.annotations.find(a => a.id === state.selectedId);
    if (!master) return;
    const next = state.annotations.map(a => {
      const isMatch = a.id === state.selectedId;
      const isGroupMatch = master.groupId && a.groupId === master.groupId;
      if (isMatch || isGroupMatch) {
        // FIX: Round to 1 decimal place
        const newSize = Math.max(1, Math.round(((a.size || 16) + delta) * 10) / 10);
        return { ...a, size: newSize };
      }
      return a;
    });
    pushHistory({ annotations: next });
  };

  const rotatePage = (index: number) => {
    const originalIdx = state.pageOrder[index];
    if (originalIdx === -1) return;
    setState(prev => {
      const newRots = { ...prev.pageRotations };
      newRots[originalIdx] = (newRots[originalIdx] || 0) + 90;
      return { ...prev, pageRotations: newRots };
    });
  };

  const deletePage = (index: number) => {
    const originalIdx = state.pageOrder[index];
    if (originalIdx === -1) {
      const newOrder = state.pageOrder.filter((_, i) => i !== index);
      pushHistory({ pageOrder: newOrder });
      return;
    }
    const newDeleted = new Set(state.deletedPages);
    newDeleted.add(originalIdx);
    pushHistory({ deletedPages: Array.from(newDeleted) });
  };

  const restorePage = (index: number) => {
    const originalIdx = state.pageOrder[index];
    const newDeleted = new Set(state.deletedPages);
    newDeleted.delete(originalIdx);
    pushHistory({ deletedPages: Array.from(newDeleted) });
  };

  const movePage = (fromVisualIndex: number, direction: 'left' | 'right') => {
    const newOrder = [...state.pageOrder];
    let visibleCount = -1;
    let realFromIndex = -1;
    for (let i = 0; i < newOrder.length; i++) {
      if (!state.deletedPages.has(newOrder[i])) {
        visibleCount++;
      }
      if (visibleCount === fromVisualIndex) {
        realFromIndex = i;
        break;
      }
    }

    if (realFromIndex === -1) return;
    let targetIndex = realFromIndex;
    if (direction === 'left') {
      targetIndex--;
      while (targetIndex >= 0 && state.deletedPages.has(newOrder[targetIndex])) {
        targetIndex--;
      }
    } else {
      targetIndex++;
      while (targetIndex < newOrder.length && state.deletedPages.has(newOrder[targetIndex])) {
        targetIndex++;
      }
    }

    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      const temp = newOrder[realFromIndex];
      newOrder[realFromIndex] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      pushHistory({ pageOrder: newOrder });
    }
  };

  const addBlankPage = () => {
    const newOrder = [...state.pageOrder, -1];
    pushHistory({ pageOrder: newOrder });
  };

  return (
    <>
      <div className="tool-container">
        {state.status === "idle" && (
          <div className="w-full flex items-center justify-center p-10 bg-slate-50 flex-1">
            <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
              <div className="text-blue-500 mx-auto w-12 h-12 mb-4"><Icons.Upload /></div>
              <h3 className="text-xl font-bold text-gray-800">Upload PDF to Edit</h3>
              <p className="text-gray-500 mt-2 font-medium">Secure, browser-based editing</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }} />
            </div>
          </div>
        )}

        {state.status !== "idle" && (
          <>
            {/* --- TOP TOOLBAR --- */}
            <div className="top-nav" ref={dropdownRef}>
              <div className="nav-brand">PDF Editor</div>
              {/* 1. Main Tools Loop (Optimized) */}
              {TOOLBAR_CONFIG.map(item => (
                <button
                  key={item.id}
                  className={`nav-btn ${item.className || ""} ${state.tool === item.id ? "active" : ""}`}
                  onClick={() => setState(s => ({ ...s, tool: item.id as any, ...(item.color ? { color: item.color } : {}) }))}
                  title={item.title || item.label}
                >
                  <item.icon /> {item.label && ` ${item.label}`}
                </button>
              ))}

              {/* Info Button (Kept Separate) */}
              <button
                className="nav-btn"
                onClick={() => setState(s => ({ ...s, showMetadataModal: true }))}
              >
                <Icons.Info /> Info
              </button>

              <div className="nav-divider" />

              {/* 2. Shapes Dropdown Loop (Optimized) */}
              <div className="nav-dropdown-container">
                <button
                  className={`nav-btn ${["rect", "circle", "line", "arrow", "draw"].includes(state.tool) ? "active" : ""}`}
                  onClick={() => setActiveDropdown(activeDropdown === "shapes" ? null : "shapes")}
                >
                  <Icons.Shapes /> Shapes <Icons.ChevronDown />
                </button>

                {activeDropdown === "shapes" && (
                  <div className="nav-dropdown-menu" style={{ width: 'auto', minWidth: '180px', padding: '8px' }}>
                    <div className="grid grid-cols-4 gap-2">
                      {SHAPE_TOOLS.map((shape: any) => (
                        <div
                          key={shape.id}
                          className={`flex items-center justify-center p-2 rounded hover:bg-slate-100 cursor-pointer text-slate-600 hover:text-blue-600 transition-colors ${state.tool === shape.id ? "bg-blue-50 text-blue-600" : ""}`}
                          onClick={() => {
                            setState(s => ({
                              ...s,
                              tool: shape.id,
                              opacity: shape.opacity,
                              color: shape.color,
                              ...(shape.brushSize ? { brushSize: shape.brushSize } : {})
                            }));
                            setActiveDropdown(null);
                          }}
                          title={shape.title}
                        >
                          <shape.icon />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Insert Dropdown */}
              <div className="nav-dropdown-container">
                <button
                  className={`nav-btn ${["image", "stamp_drop", "qr_drop"].includes(state.tool) ? "active" : ""}`}
                  onClick={() => setActiveDropdown(activeDropdown === "insert" ? null : "insert")}
                >
                  <Icons.Insert /> Insert <Icons.ChevronDown />
                </button>
                {activeDropdown === "insert" && (
                  <div className="nav-dropdown-menu" style={{ width: '220px' }}> {/* Slightly wider for the icon */}

                    {/* 1. Image (Standard) */}
                    <div className="dropdown-item" onClick={() => { imageInputRef.current?.click(); setActiveDropdown(null); }}>
                      <Icons.Image /> Image
                    </div>

                    {/* 2. Stamp (Smart Logic + Settings) */}
                    <div className="dropdown-item justify-between group"> {/* Add justify-between */}
                      {/* A. Main Click: Drops Saved Item */}
                      <div
                        className="flex items-center gap-2 flex-1 h-full"
                        onClick={() => {
                          setActiveDropdown(null);
                          if (state.savedStamp) {
                            setState(s => ({ ...s, tool: "stamp_drop", editingId: null }));
                          } else {
                            setState(s => ({ ...s, showStampModal: true, editingId: null }));
                          }
                        }}
                      >
                        <Icons.Stamp /> Stamp
                      </div>

                      {/* B. Settings Icon: Force Open Modal */}
                      <div
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                        title="Configure new stamp"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent main click
                          setActiveDropdown(null);
                          setState(s => ({ ...s, showStampModal: true, editingId: null })); // Force open modal
                        }}
                      >
                        <Icons.Settings />
                      </div>
                    </div>

                    {/* 3. QR Code (Smart Logic + Settings) */}
                    <div className="dropdown-item justify-between group">
                      {/* A. Main Click: Drops Saved Item */}
                      <div
                        className="flex items-center gap-2 flex-1 h-full"
                        onClick={() => {
                          setActiveDropdown(null);
                          if (state.savedQr) {
                            setState(s => ({ ...s, tool: "qr_drop", editingId: null }));
                          } else {
                            setState(s => ({ ...s, showQrModal: true, editingId: null, qrText: "" }));
                          }
                        }}
                      >
                        <Icons.QrCode /> QR Code
                      </div>

                      {/* B. Settings Icon: Force Open Modal */}
                      <div
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                        title="Configure new QR code"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(null);
                          setState(s => ({ ...s, showQrModal: true, editingId: null })); // Force open modal
                        }}
                      >
                        <Icons.Settings />
                      </div>
                    </div>
                  </div>
                )}
                {/* Hidden Inputs */}
                <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const content = evt.target?.result as string;
                      const id = Date.now().toString();
                      const img = new Image();
                      img.onload = () => {
                        const aspect = img.height / img.width;
                        const pageW = state.pageSize.width || 1;
                        const pageH = state.pageSize.height || 1;
                        const pageRatio = pageW / pageH;
                        pushHistory({
                          annotations: [...state.annotations, {
                            id,
                            type: "image",
                            pageIndex: state.currentPage,
                            x: 0.2,
                            y: 0.2,
                            width: 0.2,
                            height: 0.2 * aspect * pageRatio,
                            content: content,
                            meta: { imgAspect: aspect } // Added for consistency
                          }]
                        });
                      };
                      img.src = content;
                    };
                    reader.readAsDataURL(f);
                  }
                  e.target.value = "";
                }} />
                <input ref={qrFileRef} type="file" accept="image/*" hidden onChange={handleQrUpload} />
              </div>

              {/* Sign Button */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                marginLeft: '8px',
                border: '1px solid rgba(255,255,255,0.1)' // Subtle border for definition
              }}>

                {/* PART 1: MAIN ACTION (Sign) */}
                <button
                  className="nav-btn"
                  style={{
                    margin: 0,
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    borderRight: '1px solid rgba(255, 255, 255, 0.2)', // Separator line
                    paddingRight: '10px',
                    background: state.tool === "signature_drop" ? "rgba(59, 130, 246, 0.3)" : "transparent",
                    color: state.tool === "signature_drop" ? "#bfdbfe" : "inherit"
                  }}
                  onClick={() => {
                    if (state.savedSignature) {
                      setState(s => ({ ...s, tool: "signature_drop", editingId: null }));
                    } else {
                      setState(s => ({ ...s, showSignatureModal: true, editingId: null }));
                    }
                  }}
                  title={state.savedSignature ? "Click to place saved signature" : "Click to create signature"}
                >
                  <Icons.Signature /> Sign
                </button>

                {/* PART 2: EDIT ICON (Always Visible) */}
                <button
                  className="nav-btn"
                  style={{
                    margin: 0,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    paddingLeft: '6px',
                    paddingRight: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setState(s => ({ ...s, showSignatureModal: true, editingId: null }));
                  }}
                  title="Configure / Change Signature"
                >
                  {/* Using the Edit Pencil icon similar to your screenshot */}
                  <div style={{ transform: 'scale(0.85)' }}><Icons.Edit /></div>
                </button>
              </div>

              <div className="ml-auto">
                <button
                  className="nav-btn nav-btn-primary"
                  onClick={handleSave}
                  disabled={state.status === "processing"}
                >
                  <Icons.Download /> {state.status === "processing" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* --- WORKSPACE --- */}
            <div className="editor-workspace">
              {/* Context Toolbar (Properties) */}
              <div className="context-toolbar">
                {selectedAnn ? (
                  <>
                    {(selectedAnn.type === "text" || selectedAnn.type === "text_edit") && (
                      <>
                        <select className="toolbar-select" value={selectedAnn.font || "Helvetica"} onChange={(e) => updateProperty("font", e.target.value)}>
                          {AVAILABLE_FONTS.map((f) => (<option key={f.value} value={f.value}>{f.name}</option>))}
                        </select>

                        {/* Font Size */}
                        <div className="flex items-center border border-slate-300 rounded overflow-hidden bg-white shrink-0">
                          <button className="px-1 py-1 hover:bg-slate-100 border-r border-slate-300" onClick={() => adjustFontSize(-0.1)}><Icons.Minus /></button>
                          <span className="w-8 text-xs font-medium text-center">{selectedAnn.size}</span>
                          <button className="px-1 py-1 hover:bg-slate-100 border-l border-slate-300" onClick={() => adjustFontSize(0.1)}><Icons.Plus /></button>
                        </div>

                        {/* Bold / Italic / Underline */}
                        <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
                          <button className={`toolbar-btn ${selectedAnn.isBold ? "active" : ""}`} onClick={toggleBold} title="Bold"><Icons.Bold /></button>
                          <button
                            className={`toolbar-btn ${selectedAnn.isItalic ? "active" : ""}`}
                            onClick={toggleItalic}
                            title="Italic"
                          >
                            <Icons.Italic />
                          </button>
                          <button className={`toolbar-btn ${selectedAnn.isUnderline ? "active" : ""}`} onClick={toggleUnderline} title="Underline"><Icons.Underline /></button>
                        </div>
                        {/* --- 1. TEXT COLOR (Updated with Detected Colors) --- */}
                        <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-2">
                          <span className="text-xs text-slate-500 font-medium">Color:</span>
                          {/* Standard Picker */}
                          <input
                            type="color"
                            className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0 bg-white"
                            value={selectedAnn.color}
                            // CHANGE: Use applyTextColor instead of updateProperty
                            onChange={(e) => applyTextColor(e.target.value, true)}
                            onBlur={() => pushHistory()}
                          />

                          {/* DETECTED TEXT COLORS */}
                          {state.activePalette && state.activePalette.length > 0 && (
                            <div className="flex items-center gap-1 ml-1">
                              {state.activePalette.map((c, i) => (
                                <button
                                  key={i}
                                  className="w-4 h-4 rounded-full border border-slate-300 shadow-sm hover:scale-125 transition-transform"
                                  style={{ backgroundColor: c }}
                                  // CHANGE: Use applyTextColor (using onMouseDown prevents focus loss)
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Keep selection active
                                    applyTextColor(c, false); // Apply & Save
                                  }}
                                  title={`Detected text color: ${c}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* --- 2. BACKGROUND COLOR (Updated with Detected Colors) --- */}
                        {selectedAnn.subtype === "editor" && (
                          <div className="flex items-center gap-2 border-l border-slate-200 pl-2 ml-2">
                            <span className="text-xs text-slate-500 font-medium">Bg:</span>
                            {/* Standard Picker */}
                            <input
                              type="color"
                              className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0 bg-white"
                              value={state.annotations.find(a => a.groupId === selectedAnn.groupId && a.type === "redact")?.color || "#ffffff"}
                              onChange={(e) => updateProperty("backgroundColor", e.target.value, true)}
                              onBlur={() => pushHistory()}
                              title="Background Color (Eraser)"
                            />

                            {/* DETECTED BACKGROUND COLORS */}
                            {state.activeBgPalette && state.activeBgPalette.length > 0 && (
                              <div className="flex items-center gap-1 ml-1">
                                {state.activeBgPalette.map((c, i) => (
                                  <button
                                    key={i}
                                    className="w-4 h-4 rounded border border-slate-300 shadow-sm hover:scale-125 transition-transform"
                                    style={{ backgroundColor: c }}
                                    onClick={() => updateProperty("backgroundColor", c, true)}
                                    title={`Detected background: ${c}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* --- 3. LINE HEIGHT (Restored) --- */}
                        <div className="flex items-center gap-2 border-l border-slate-200 pl-2 ml-2">
                          <span className="text-xs text-slate-500 font-medium">Line Ht:</span>
                          <input
                            type="range"
                            min="0.8" max="2.5" step="0.1"
                            className="w-16 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            value={selectedAnn.lineHeight ?? 1.15}
                            onChange={(e) => updateProperty("lineHeight", parseFloat(e.target.value))}
                            title={`Line Height: ${selectedAnn.lineHeight ?? 1.15}`}
                          />
                          <span className="text-[10px] w-6 text-center text-slate-600">{selectedAnn.lineHeight ?? 1.15}</span>
                        </div>
                      </>
                    )}

                    {/* --- 2. SHAPE / LINE / ARROW PROPERTIES (RESTORED) --- */}
                    {(selectedAnn.type === "rect" || selectedAnn.type === "circle" || selectedAnn.subtype === "line" || selectedAnn.type === "arrow" || selectedAnn.type === "path") && (
                      <>
                        {/* Color Picker - ALWAYS SHOW */}
                        <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
                          <span className="text-xs font-semibold text-slate-500">Color:</span>
                          <input
                            type="color"
                            className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                            value={selectedAnn.color || "#000000"}
                            onChange={(e) => updateProperty("color", e.target.value)}
                          />
                        </div>

                        {/* HIDE OTHER PROPERTIES FOR FREEHAND */}
                        <>
                          {/* Stroke Width / Size */}
                          <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
                            <span className="text-xs font-semibold text-slate-500">Thickness:</span>
                            <input
                              type="range"
                              min="1" max="20"
                              className="w-20 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              value={selectedAnn.size || 3}
                              onChange={(e) => updateProperty("size", parseInt(e.target.value))}
                            />
                            <span className="text-xs w-4 text-center">{selectedAnn.size}</span>
                          </div>

                          {/* Opacity */}
                          <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
                            <span className="text-xs font-semibold text-slate-500">Opacity:</span>
                            <input
                              type="range"
                              min="0.1" max="1" step="0.1"
                              className="w-20 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              value={selectedAnn.opacity ?? 1}
                              onChange={(e) => updateProperty("opacity", parseFloat(e.target.value))}
                            />
                          </div>

                          {/* Fill Toggle (Still restricted to Rect/Circle automatically via this check) */}
                          {(selectedAnn.type === "rect" || selectedAnn.type === "circle") && (
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!selectedAnn.isFill}
                                  onChange={(e) => updateProperty("isFill", e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Fill Shape
                              </label>
                            </div>
                          )}
                        </>
                      </>
                    )}

                    {/* --- 3. REDACT PROPERTIES (RESTORED) --- */}
                    {selectedAnn.type === "redact" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">Redaction Color:</span>
                        <input
                          type="color"
                          className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                          value={selectedAnn.color || "#000000"}
                          onChange={(e) => updateProperty("color", e.target.value)}
                        />
                      </div>
                    )}

                    {/* --- 4. IMAGE PROPERTIES (RESTORED) --- */}
                    {selectedAnn.type === "image" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">Opacity:</span>
                        <input
                          type="range"
                          min="0.1" max="1" step="0.1"
                          className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          value={selectedAnn.opacity ?? 1}
                          onChange={(e) => updateProperty("opacity", parseFloat(e.target.value))}
                        />
                        <span className="text-xs text-slate-600">{Math.round((selectedAnn.opacity ?? 1) * 100)}%</span>
                      </div>
                    )}

                    {/* GLOBAL DELETE BUTTON - NOW VISIBLE FOR EVERYTHING (Including Freehand) */}
                    <>
                      <div className="context-divider" />
                      <button className="toolbar-btn danger" onClick={() => {
                        const current = state.annotations.find(a => a.id === state.selectedId);
                        const groupId = current?.groupId;
                        const next = state.annotations.filter(a => {
                          if (a.id === state.selectedId) return false;
                          if (groupId && a.groupId === groupId && a.type === "redact") return false;
                          return true;
                        });
                        pushHistory({ annotations: next });
                        setState(s => ({ ...s, selectedId: null }));
                      }} title="Delete"><Icons.Trash /></button>
                    </>
                    {!(selectedAnn.type === "path" && selectedAnn.color === "#ffffff") && selectedAnn.subtype !== "editor" && (
                      <button
                        className="toolbar-btn"
                        title="Duplicate"
                        onClick={() => {
                          const id = Date.now().toString();
                          // Create a shallow copy first
                          let newAnn = { ...selectedAnn, id };

                          const offset = 0.02; // Shift copy slightly (2% of page)

                          if (newAnn.paths) {
                            newAnn.paths = newAnn.paths.map(p => ({
                              x: p.x + offset,
                              y: p.y + offset
                            }));
                          } else {
                            newAnn.x = (newAnn.x || 0) + offset;
                            newAnn.y = (newAnn.y || 0) + offset;
                          }

                          pushHistory({ annotations: [...state.annotations, newAnn] });
                          setState(s => ({ ...s, selectedId: id }));
                        }}
                      >
                        <Icons.Copy />
                      </button>
                    )}

                    {/* --- NEW: QUICK ACTIONS (Date, Name, Marks, Duplicate) --- */}
                    {selectedAnn.type === "text" && selectedAnn.subtype !== "editor" && (
                      <>
                        <div className="context-divider" />

                        <div className="flex items-center gap-1">
                          {/* 1. Date Insert */}
                          <button
                            className="toolbar-btn"
                            onClick={() => {
                              const dateStr = new Date().toLocaleDateString();
                              const next = state.annotations.map(a => a.id === selectedAnn.id ? { ...a, content: dateStr } : a);
                              pushHistory({ annotations: next });
                              setState(s => ({ ...s, annotations: next, selectedId: null }));
                            }}
                            title="Insert Current Date"
                          >
                            <Icons.Calendar />
                          </button>

                          {/* 2. NAME WIDGET (Split Button: Insert | Edit) */}
                          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "4px", marginRight: "4px", backgroundColor: "#fff" }}>
                            {/* Left Side: INSERT Name */}
                            <button
                              className="hover:bg-slate-100 text-slate-600 transition-colors"
                              style={{ padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderRadius: "4px 0 0 4px", display: "flex" }}
                              onClick={() => {
                                let name = localStorage.getItem("nextooly_name");
                                if (!name) {
                                  name = prompt("Enter your name for quick use:");
                                  if (name) {
                                    localStorage.setItem("nextooly_name", name);
                                    setState(s => ({ ...s, savedName: name }));
                                  } else return;
                                }
                                // Apply & Deselect
                                const next = state.annotations.map(a => a.id === selectedAnn.id ? { ...a, content: name! } : a);
                                pushHistory({ annotations: next });
                                setState(s => ({ ...s, annotations: next, selectedId: null }));
                              }}
                              title={state.savedName ? `Insert "${state.savedName}"` : "Insert Name"}
                            >
                              <Icons.User />
                            </button>

                            {/* Right Side: EDIT Name Settings */}
                            <button
                              className="hover:bg-slate-100 text-slate-500 transition-colors"
                              style={{ padding: "6px 4px", borderRadius: "0 4px 4px 0", display: "flex" }}
                              onClick={() => {
                                const current = localStorage.getItem("nextooly_name") || "";
                                const newName = prompt("Change your saved name:", current);
                                if (newName) {
                                  localStorage.setItem("nextooly_name", newName);
                                  setState(s => ({ ...s, savedName: newName }));
                                }
                              }}
                              title="Update Saved Name"
                            >
                              <div style={{ transform: "scale(0.8)" }}><Icons.Edit /></div>
                            </button>
                          </div>

                          {/* 3. Checkmark */}
                          <button
                            className="toolbar-btn"
                            onClick={() => {
                              const next = state.annotations.map(a => a.id === selectedAnn.id ? { ...a, content: "✓" } : a);
                              pushHistory({ annotations: next });
                              setState(s => ({ ...s, annotations: next, selectedId: null }));
                            }}
                            title="Insert Checkmark"
                          >
                            <Icons.Check />
                          </button>

                          {/* 4. Cross / False */}
                          <button
                            className="toolbar-btn"
                            onClick={() => {
                              // Update Text AND Deselect (hides the delete/close handle)
                              const next = state.annotations.map(a => a.id === selectedAnn.id ? { ...a, content: "✕" } : a);
                              pushHistory({ annotations: next });
                              setState(s => ({ ...s, annotations: next, selectedId: null }));
                            }}
                            title="Insert X"
                          >
                            <Icons.X />
                          </button>
                        </div>

                        {/* Divider for Duplicate */}
                        <div className="context-divider" />

                        {/* 5. Duplicate Button (Keeps selection on new item) */}
                        {(selectedAnn as any).subtype !== "editor" && (
                          <button
                            className="toolbar-btn"
                            onClick={() => {
                              const id = Date.now().toString();
                              const newAnn = {
                                ...selectedAnn,
                                id,
                                x: selectedAnn.x + 0.01,
                                y: selectedAnn.y + 0.01
                              };
                              pushHistory({ annotations: [...state.annotations, newAnn] });
                              setState(s => ({ ...s, selectedId: id }));
                            }}
                            title="Duplicate"
                          >
                            <Icons.Copy />
                          </button>)}
                      </>
                    )}
                  </>
                ) : (
                  state.tool === "edit_text" ? (
                    <div className="flex items-center gap-3">
                      <EditTextContextBar mode={textSelectMode} setMode={setTextSelectMode} />
                      <div className="w-px h-5 bg-slate-300 mx-2" />
                      <div className="flex items-center gap-1" title="Horizontal Shrink (Left/Right)">
                        <span className="text-xs font-bold text-slate-400">↔</span>
                        <input
                          type="range" min="0" max="30" step="1"
                          className="w-12 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          value={eraserPaddingX}
                          onChange={(e) => setEraserPaddingX(parseInt(e.target.value))}
                        />
                        <span className="text-[10px] text-slate-600 w-4 font-mono">{eraserPaddingX}%</span>
                      </div>

                      {/* Vertical (Y) */}
                      <div className="flex items-center gap-1" title="Vertical Shrink (Top/Bottom)">
                        <span className="text-xs font-bold text-slate-400">↕</span>
                        <input
                          type="range" min="0" max="40" step="2"
                          className="w-12 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          value={eraserPaddingY}
                          onChange={(e) => setEraserPaddingY(parseInt(e.target.value))}
                        />
                        <span className="text-[10px] text-slate-600 w-4 font-mono">{eraserPaddingY}%</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">Select an item to edit properties</span>
                  )
                )}

                {/* --- UNDO/REDO (Always Visible) --- */}
                <div className="ml-auto flex items-center gap-1 pl-4 border-l border-slate-200">
                  <button className="top-action-btn" onClick={undo} disabled={state.historyStep === 0}><Icons.Undo /></button>
                  <button className="top-action-btn" onClick={redo} disabled={state.historyStep >= state.history.length - 1}><Icons.Redo /></button>
                  <button
                    className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded ml-2 transition-colors hover:bg-red-100"
                    onClick={() => {
                      if (confirm("Are you sure you want to reset? All unsaved changes will be lost.")) {
                        window.location.reload();
                      }
                    }}
                    title="Reset Document"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Scrollable Canvas */}
              <div
                ref={scrollAreaRef}
                className="workspace-scroll-area"
                onMouseMove={handleDrawMove}
                onMouseUp={handleDrawUp}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setState(s => ({ ...s, selectedId: null }));
                }}
              >
                {/* Bottom Bar Controls */}
                <div
                  className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl rounded-full z-50 transition-all duration-300 ease-in-out overflow-hidden ${isBottomBarExpanded ? "px-6 py-3 w-auto" : "px-0 py-0 w-12 h-12 cursor-pointer hover:scale-110"
                    }`}
                  onClick={() => !isBottomBarExpanded && setBottomBarExpanded(true)}
                >
                  {isBottomBarExpanded ? (
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30" disabled={state.currentPage === 0} onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, tool: "cursor", selectedId: null, currentPage: Math.max(0, s.currentPage - 1) })); }}><Icons.ChevronLeft /></button>
                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[80px] text-center select-none">Page {state.currentPage + 1} / {state.pageOrder.length}</span>
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30" disabled={state.currentPage >= state.pageOrder.length - 1} onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, tool: "cursor", selectedId: null, currentPage: Math.min(state.pageOrder.length - 1, s.currentPage + 1) })); }}><Icons.ChevronRight /></button>
                      </div>
                      <div className="w-px h-6 bg-gray-300" />
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600" onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, scale: Math.max(0.5, s.scale - 0.2) })); }}><Icons.ZoomOut /></button>
                        <span className="text-sm font-bold text-blue-600 w-12 text-center select-none">{Math.round(state.scale * 100)}%</span>
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600" onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, scale: Math.min(3, s.scale + 0.2) })); }}><Icons.ZoomIn /></button>
                      </div>
                      <div className="w-px h-6 bg-gray-300" />
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                        title="Organize Pages"
                        onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, showPageManager: true })); }}
                      >
                        <Icons.Grid />
                      </button>
                      <button className="ml-2 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full" onClick={(e) => { e.stopPropagation(); setBottomBarExpanded(false); }}><Icons.ChevronDown /></button>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white font-bold text-xs select-none">{state.currentPage + 1}</div>
                  )}
                </div>

                {/* Page Render */}
                <div
                  style={{
                    width: (state.pageRotations[state.pageOrder[state.currentPage]] || 0) % 180 !== 0 ? state.pageSize.height : state.pageSize.width,
                    height: (state.pageRotations[state.pageOrder[state.currentPage]] || 0) % 180 !== 0 ? state.pageSize.width : state.pageSize.height,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto', transition: 'all 0.3s ease', minWidth: 'fit-content', minHeight: 'fit-content'
                  }}
                >
                  <div
                    ref={containerRef}
                    className="page-container"
                    onMouseDown={handleMouseDown}
                    style={{
                      width: state.pageSize.width,
                      height: state.pageSize.height,
                      opacity: state.deletedPages.has(state.pageOrder[state.currentPage]) ? 0.3 : 1,
                      transform: `rotate(${state.pageRotations[state.pageOrder[state.currentPage]] || 0}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.3s ease',
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
                    }}
                  >
                    <canvas ref={canvasRef} className="block" />
                    {state.pdfFormFields.map(field => {
                      const actualCurrentPage = state.pageOrder[state.currentPage];
                      if (field.pageIndex !== actualCurrentPage) return null;

                      // Common styles for absolute positioning
                      const style: React.CSSProperties = {
                        position: "absolute",
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.width * 100}%`,
                        height: `${field.height * 100}%`,
                        zIndex: 50,
                        cursor: "text", // Changed from pointer to text for inputs
                      };

                      // A. Text Fields
                      if (field.type === "text") {
                        return (
                          <input
                            key={field.id}
                            type="text"
                            style={{
                              ...style,
                              background: "rgba(218, 234, 255, 0.4)", // Make slightly transparent to see underlying lines
                              border: "1px solid #2563eb", // Add visible active border color
                              color: "#000000",
                              fontSize: `${Math.max(10, 12 * state.scale)}px`, // Ensure min font size
                              padding: "2px",
                              boxSizing: "border-box" // FIX: Ensure padding doesn't overflow container
                            }}
                            value={field.value as string || ""}
                            onChange={(e) => updateFormField(field.name, e.target.value)}
                            // FIX: Prevent canvas selection logic from stealing focus
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            title={field.name}
                          />
                        );
                      }

                      // B. Checkboxes
                      if (field.type === "checkbox") {
                        return (
                          <input
                            key={field.id}
                            type="checkbox"
                            style={{ ...style, cursor: "pointer", margin: 0 }}
                            checked={!!field.value}
                            onChange={(e) => updateFormField(field.name, e.target.checked)}
                            title={field.name}
                          />
                        );
                      }

                      // C. Dropdowns (Select)
                      if (field.type === "dropdown") {
                        return (
                          <select
                            key={field.id}
                            style={{ ...style, background: "#daeaff", border: "1px solid #000000", fontSize: `${11 * state.scale}px` }}
                            value={field.value as string || ""}
                            onChange={(e) => updateFormField(field.name, e.target.value)}
                          >
                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        );
                      }

                      // D. Radio Buttons
                      if (field.type === "radio") {
                        const isSelected = field.value === field.options?.[0];
                        return (
                          <input
                            key={field.id}
                            type="radio"
                            style={{ ...style, margin: 0 }}
                            checked={isSelected}
                            onChange={() => updateFormField(field.name, field.options?.[0] || "")}
                          />
                        );
                      }

                      return null;
                    })}
                    {state.tool === "edit_text" && (
                      <EditTextOverlay
                        blocks={state.extractedBlocks}
                        annotations={state.annotations.filter(a => a.pageIndex === state.currentPage)}
                        onBlockClick={handleTextBlockClick}
                      />
                    )}
                    {/* Annotations Overlay */}
                    {state.annotations.map(ann => {
                      if (ann.pageIndex !== state.currentPage) return null;
                      const isSel = ann.id === state.selectedId;
                      const isPathLike = ann.type === "path" || ann.type === "arrow";

                      if (isPathLike) {
                        const b = getPathBounds(ann.paths || []);
                        return (
                          <div
                            key={ann.id}
                            className="group"
                            style={{
                              position: "absolute",
                              left: 0, top: 0, width: "100%", height: "100%",
                              pointerEvents: "none",
                              zIndex: isSel ? 100 : 10,
                            }}
                          >
                            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                              <defs>
                                <marker id={`arrowhead-${ann.id}`} markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                                  <path d="M0,0 L8,4 L0,8" fill={ann.color} />
                                </marker>
                              </defs>

                              <g
                                style={{
                                  pointerEvents: "stroke",
                                  cursor: (state.tool === "cursor" && ann.subtype !== "freehand") ? "move" : "default"
                                }}
                                onMouseDown={(e) => {
                                  // CHANGE 2: Logic to handle selection and dragging
                                  if (!isSel) {
                                    e.stopPropagation();
                                    setState(s => ({ ...s, selectedId: ann.id }));
                                  }
                                  else {
                                    if (ann.subtype !== "freehand") {
                                      beginDrag(e, "move", "move", ann);
                                    }
                                  }
                                }}>

                                {/* CHANGE 3: We MUST render the invisible paths here so the mouse has something to hit! */}
                                {ann.type === "path" && (
                                  <path
                                    d={ann.paths?.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 1000} ${p.y * 1000}`).join(" ")}
                                    stroke="transparent"
                                    fill="none"
                                    strokeWidth={20} // Thick hit area (easier to grab)
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {ann.type === "arrow" && ann.paths && ann.paths.length > 1 && (
                                  <line
                                    x1={ann.paths[0].x * 1000}
                                    y1={ann.paths[0].y * 1000}
                                    x2={ann.paths[ann.paths.length - 1].x * 1000}
                                    y2={ann.paths[ann.paths.length - 1].y * 1000}
                                    stroke="transparent"
                                    strokeWidth={20} // Thick hit area
                                    markerEnd={`url(#arrowhead-hit-${ann.id})`}
                                  />
                                )}
                              </g>

                              {/* VISIBLE LINE */}
                              <g style={{ pointerEvents: "none" }}>
                                {ann.type === "path" && <path d={ann.paths?.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 1000} ${p.y * 1000}`).join(" ")} stroke={ann.color} fill="none" strokeWidth={ann.size} strokeLinecap="round" strokeLinejoin="round" opacity={ann.opacity} />}
                                {ann.type === "arrow" && ann.paths && ann.paths.length > 1 && <line x1={ann.paths[0].x * 1000} y1={ann.paths[0].y * 1000} x2={ann.paths[ann.paths.length - 1].x * 1000} y2={ann.paths[ann.paths.length - 1].y * 1000} stroke={ann.color} strokeWidth={ann.size} markerEnd={`url(#arrowhead-${ann.id})`} opacity={ann.opacity} />}
                              </g>
                            </svg>
                          </div>
                        );
                      }

                      // --- 1. RENDER TEXT EDIT (Special Dual-Layer Logic) ---
                      if (ann.type === "text_edit") {
                        return (
                          <React.Fragment key={ann.id}>
                            <div
                              style={{
                                position: "absolute",
                                left: `${ann.originalBounds!.x * 100}%`,
                                top: `${ann.originalBounds!.y * 100}%`,
                                width: `${ann.originalBounds!.width * 100}%`,
                                height: `${ann.originalBounds!.height * 100}%`,
                                backgroundColor: ann.backgroundColor || "#ffffff",
                                zIndex: 5, // Below the active text layer
                                pointerEvents: "none", // Let clicks pass through to canvas if needed
                              }}
                            />

                            {/* B. EDITABLE TEXT (Movable) */}
                            <div
                              style={{
                                position: "absolute",
                                left: `${ann.x * 100}%`,
                                top: `${ann.y * 100}%`,
                                width: `${(ann.width || 0) * 100}%`,
                                height: `${(ann.height || 0) * 100}%`,
                                zIndex: isSel ? 100 : 10,
                                transform: ann.rotation ? `rotate(${ann.rotation}deg)` : "none",
                              }}
                              className={isSel ? "selected-outline" : ""}
                              onMouseDown={(e) => {
                                if ((e.target as HTMLElement).closest(".move-handle, .resize-handle, .delete-handle")) return;

                                // 1. Text: Select Only (Existing Logic)
                                if (ann.type === "text" && !e.ctrlKey && !e.metaKey) {
                                  e.stopPropagation();
                                  setState(s => ({ ...s, selectedId: ann.id }));
                                  return;
                                }

                                // 2. Freehand: Select Only (New Logic - NO MOVEMENT)
                                if (ann.subtype === "freehand") {
                                  e.stopPropagation();
                                  setState(s => ({ ...s, selectedId: ann.id }));
                                  return;
                                }

                                // 3. Others (Rect, Circle, Line, Arrow): Enable Move
                                beginDrag(e, "move", "move", ann);
                              }}
                            >
                              <RichTextEditor
                                htmlContent={ann.content || ""}
                                className={getFontClass(ann.font)}
                                onChange={(newHtml) => {
                                  setState(s => ({
                                    ...s,
                                    annotations: s.annotations.map(a =>
                                      a.id === ann.id ? { ...a, content: newHtml } : a
                                    )
                                  }));
                                }}
                                isSelected={isSel}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  background: "transparent", // Background handled by patch
                                  color: ann.color,
                                  fontSize: `${(ann.size || 12) * state.scale}px`,
                                  lineHeight: ann.lineHeight ?? 1.15,
                                  boxSizing: "border-box",
                                  display: "block",
                                  border: "none",
                                  padding: "0",
                                  margin: "0",
                                  overflow: "visible",
                                  whiteSpace: "nowrap",
                                  fontWeight: ann.isBold ? 'bold' : 'normal',
                                  fontStyle: ann.isItalic ? 'italic' : 'normal',
                                  textDecoration: ann.isUnderline ? 'underline' : 'none',
                                  opacity: ann.opacity ?? 1,
                                }}
                              />
                              {isSel && (
                                <>
                                  <div className="move-handle" onMouseDown={(e) => beginDrag(e, "move", "move", ann)}><Icons.Move /></div>
                                  <div className="delete-handle" onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const n = state.annotations.filter(x => x.id !== ann.id);
                                    pushHistory({ annotations: n });
                                    setState(s => ({ ...s, selectedId: null }));
                                  }}><Icons.X /></div>
                                  {/* <div className="resize-handle handle-se" onMouseDown={(e) => beginDrag(e, "resize", "se", ann)} /> */}
                                  {(ann.subtype === "qr" || ann.subtype === "stamp" || ann.subtype === "signature") && (
                                    <div
                                      className="absolute -top-[24px] left-[52px] bg-slate-700 text-white p-1 rounded cursor-pointer z-50 shadow-sm flex items-center justify-center hover:bg-slate-800"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleEditAnnotation(ann);
                                      }}
                                      title="Edit Configuration"
                                    >
                                      <Icons.Edit />
                                    </div>
                                  )}
                                  {!isPathLike && <div className="resize-handle handle-se" onMouseDown={(e) => beginDrag(e, "resize", "se", ann)} />}
                                </>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      }

                      const isMark = ann.type === "text" && (ann.content === "✓" || ann.content === "✕");
                      const style: React.CSSProperties = {
                        position: "absolute",
                        left: isPathLike ? 0 : `${ann.x * 100}%`,
                        top: isPathLike ? 0 : `${ann.y * 100}%`,
                        width: isPathLike ? "100%" : `${(ann.width || 0) * 100}%`,
                        height: isPathLike ? "100%" : `${(ann.height || 0) * 100}%`,
                        zIndex: isSel ? 100 : 10,
                        transform: ann.rotation ? `rotate(${ann.rotation}deg)` : "none",
                        pointerEvents: (ann.type === "redact" && ann.groupId) ? "none" : "auto",
                        // CHANGE A: Force "move" cursor for Marks so user knows they can drag it
                        cursor: isMark ? "move" : "default"
                      };

                      return (
                        <div
                          key={ann.id}
                          style={style}
                          className={isSel && !isPathLike ? "selected-outline" : ""}
                          onMouseDown={(e) => {
                            if ((e.target as HTMLElement).closest(".move-handle, .resize-handle, .delete-handle")) return;
                            if (isMark) {
                              beginDrag(e, "move", "move", ann);
                              return;
                            }
                            if (ann.type === "text" && !e.ctrlKey && !e.metaKey) {
                              e.stopPropagation();
                              setState(s => ({ ...s, selectedId: ann.id }));
                              return;
                            }
                            beginDrag(e, "move", "move", ann);
                          }}
                        >
                          {ann.type === "text" && (
                            <RichTextEditor
                              htmlContent={ann.content || ""}
                              className={getFontClass(ann.font)}
                              onChange={(newHtml) => {
                                setState(s => ({
                                  ...s,
                                  annotations: s.annotations.map(a =>
                                    a.id === ann.id ? { ...a, content: newHtml } : a
                                  )
                                }));
                              }}
                              isSelected={isSel}
                              style={{
                                width: "100%",
                                height: "100%",
                                background: ann.backgroundColor || "transparent",
                                color: ann.color,
                                fontSize: `${(ann.size || 12) * state.scale}px`,
                                lineHeight: ann.lineHeight ?? 1.35,
                                border: ann.backgroundColor ? "1px solid #e5e5e5" : "none",
                                padding: ann.backgroundColor ? "4px" : "0",
                                borderRadius: ann.backgroundColor ? "4px" : "0",
                                overflow: "hidden",
                                whiteSpace: "pre-wrap",
                                fontWeight: ann.isBold ? 'bold' : 'normal',
                                fontStyle: ann.isItalic ? 'italic' : 'normal',
                                textDecoration: ann.isUnderline ? 'underline' : 'none',
                                opacity: ann.opacity ?? 1,
                                pointerEvents: isMark ? "none" : "auto"
                              }}
                            />
                          )}

                          {ann.type === "rect" && (<div style={{ width: "100%", height: "100%", border: ann.isFill ? "none" : `${ann.size || 3}px solid ${ann.color}`, backgroundColor: ann.isFill ? ann.color : "transparent", opacity: ann.opacity }} />)}
                          {ann.type === "redact" && <div style={{ width: "100%", height: "100%", backgroundColor: ann.color }} />}
                          {ann.type === "circle" && (<div style={{ width: "100%", height: "100%", border: ann.isFill ? "none" : `${ann.size || 3}px solid ${ann.color}`, borderRadius: "50%", backgroundColor: ann.isFill ? ann.color : "transparent", opacity: ann.opacity }} />)}
                          {ann.type === "image" && <img src={ann.content} style={{ width: "100%", height: "100%", objectFit: "contain", opacity: ann.opacity ?? 1 }} draggable={false} alt="annotation" />}
                          {isPathLike && (<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}> {ann.type === "path" && <path d={ann.paths?.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 1000} ${p.y * 1000}`).join(" ")} stroke={ann.color} fill="none" strokeWidth={ann.size} strokeLinecap="round" strokeLinejoin="round" opacity={ann.opacity} />}
                            {ann.type === "arrow" && ann.paths && ann.paths.length > 1 && (
                              <>
                                <defs>
                                  <marker
                                    id={`arrowhead-hit-${ann.id}`}
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="8"
                                    refY="4"
                                    orient="auto"
                                  >
                                    <path d="M0,0 L8,4 L0,8" fill="none" />
                                  </marker>

                                  <marker
                                    id={`arrowhead-vis-${ann.id}`}
                                    markerWidth="10"
                                    markerHeight="7"
                                    refX="5"
                                    refY="3.5"
                                    orient="auto"
                                  >
                                    <polygon points="0 0, 10 3.5, 0 7" fill={ann.color} />
                                  </marker>
                                </defs>
                                <line x1={ann.paths[0].x * 1000} y1={ann.paths[0].y * 1000} x2={ann.paths[ann.paths.length - 1].x * 1000}
                                  y2={ann.paths[ann.paths.length - 1].y * 1000} stroke={ann.color} strokeWidth={ann.size}
                                  markerEnd={`url(#arrowhead-vis-${ann.id})`} opacity={ann.opacity} /> </>)} </svg>)}

                          {isSel && (
                            <>
                              {ann.type === "text" && !isMark && (
                                <>
                                  <div
                                    className="move-handle"
                                    onMouseDown={(e) => beginDrag(e, "move", "move", ann)}
                                    title="Move Text"
                                  >
                                    <Icons.Move />
                                  </div>

                                  <div
                                    className="absolute -top-9 left-8 bg-white border border-slate-300 rounded shadow-sm flex items-center px-1 h-7 z-50 gap-1"
                                    onMouseDown={(e) => e.stopPropagation()} // Prevent dragging/deselection
                                  >
                                    <button
                                      className="w-6 h-full flex items-center justify-center hover:bg-slate-100 rounded text-[10px] font-bold text-slate-700"
                                      onMouseDown={(e) => { e.preventDefault(); adjustFontSize(-0.1); }} // preventDefault keeps text selected
                                      title="Decrease Size (Selected Text)"
                                    >
                                      A-
                                    </button>
                                    <div className="w-px h-3 bg-slate-200"></div>
                                    <button
                                      className="w-6 h-full flex items-center justify-center hover:bg-slate-100 rounded text-[10px] font-bold text-slate-700"
                                      onMouseDown={(e) => { e.preventDefault(); adjustFontSize(0.1); }}
                                      title="Increase Size (Selected Text)"
                                    >
                                      A+
                                    </button>
                                  </div>
                                </>
                              )}

                              {!isPathLike && (
                                <div
                                  className="resize-handle handle-se"
                                  onMouseDown={(e) => beginDrag(e, "resize", "se", ann)}
                                />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            {state.showPageManager && (
              <div className="page-grid-overlay">
                <div className="page-grid-header">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Organize Pages</h2>
                    <p className="text-slate-500 mt-1">Drag, rotate, or delete pages to reorder your document.</p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-400 transition-all flex items-center gap-2 shadow-sm"
                      onClick={addBlankPage}
                    >
                      <Icons.Plus /> Add Blank Page
                    </button>
                    <button
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all transform active:scale-95"
                      onClick={() => setState(s => ({ ...s, showPageManager: false }))}
                    >
                      Done Editing
                    </button>
                  </div>
                </div>

                <div className="page-grid-content">
                  {state.pageOrder
                    .map((originalPageNum, realIndex) => ({ originalPageNum, realIndex }))
                    .map((item, visualIndex, array) => {
                      const isDeleted = state.deletedPages.has(item.originalPageNum);
                      return (
                        <div
                          key={item.originalPageNum !== -1 ? `p-${item.originalPageNum}` : `b-${item.realIndex}`}
                          className={`page-card ${isDeleted ? "ring-2 ring-red-100 border-red-200" : ""}`}
                        >
                          <div
                            className="page-card-preview"
                            onClick={() => !isDeleted && setState(s => ({ ...s, currentPage: visualIndex, showPageManager: false }))}
                            style={{ opacity: isDeleted ? 0.8 : 1 }}
                          >
                            <div className={isDeleted ? "opacity-25 grayscale filter transition-all" : ""}>
                              <PageThumbnail
                                fileBuffer={state.fileBuffer!}
                                pageIndex={item.originalPageNum}
                                rotation={state.pageRotations[item.originalPageNum] || 0}
                              />
                            </div>

                            {isDeleted && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/10 backdrop-blur-[1px] z-10">
                                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 shadow-sm border border-red-100">
                                  Deleted
                                </div>
                                <button
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-md flex items-center gap-2 transition-transform active:scale-95"
                                  onClick={(e) => { e.stopPropagation(); restorePage(item.realIndex); }}
                                >
                                  <Icons.Undo /> Restore
                                </button>
                              </div>
                            )}
                          </div>

                          <div className={`page-card-footer ${isDeleted ? "bg-slate-50" : ""}`}>

                            <div className="footer-row">
                              <span className={`font-mono ${isDeleted ? "text-slate-300 line-through" : "text-slate-500"}`}>
                                #{visualIndex + 1}
                              </span>

                              {!isDeleted && (
                                <div className="flex items-center gap-1">
                                  <button
                                    className="move-btn"
                                    disabled={visualIndex === 0}
                                    onClick={(e) => { e.stopPropagation(); movePage(visualIndex, 'left'); }}
                                    title="Move Backward"
                                  >
                                    <Icons.ChevronLeft />
                                  </button>
                                  <button
                                    className="move-btn"
                                    disabled={visualIndex === array.length - 1}
                                    onClick={(e) => { e.stopPropagation(); movePage(visualIndex, 'right'); }}
                                    title="Move Forward"
                                  >
                                    <Icons.ChevronRight />
                                  </button>
                                </div>
                              )}
                            </div>

                            {!isDeleted && (
                              <div className="footer-row">
                                <button
                                  className="footer-btn"
                                  onClick={(e) => { e.stopPropagation(); rotatePage(item.realIndex); }}
                                >
                                  <Icons.RotateRight />
                                </button>
                                <button
                                  className="footer-btn danger"
                                  onClick={(e) => { e.stopPropagation(); deletePage(item.realIndex); }}
                                >
                                  <Icons.Trash />
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Metadata Modal */}
            {state.showMetadataModal && (
              <MetadataModal
                metadata={state.metadata}
                onClose={() => setState(s => ({ ...s, showMetadataModal: false }))}
                onSave={(newMeta) => {
                  pushHistory({ meta: newMeta });
                  setState(s => ({ ...s, metadata: newMeta, showMetadataModal: false }));
                }}
              />
            )}

            {/* Signature Modal */}
            {state.showSignatureModal && (
              <SignatureModal
                onClose={() => setState(s => ({ ...s, showSignatureModal: false }))}
                onSave={(url) => {
                  localStorage.setItem("nextooly_signature", url);
                  if (state.editingId) {
                    const next = state.annotations.map(a => a.id === state.editingId ? { ...a, content: url } : a);
                    pushHistory({ annotations: next });
                    setState(s => ({ ...s, showSignatureModal: false, savedSignature: url, editingId: null, selectedId: s.editingId }));
                  } else {
                    setState(s => ({ ...s, showSignatureModal: false, savedSignature: url, tool: "signature_drop" }));
                  }
                }}
              />
            )}

            {/* QR Modal */}
            {state.showQrModal && (
              <QrModal
                editingId={state.editingId}
                initialText={state.qrText}
                savedQr={state.savedQr}
                onClose={() => setState(s => ({ ...s, showQrModal: false }))}
                onSave={(url, text) => {
                  localStorage.setItem("nextooly_qr", url);
                  if (state.editingId) {
                    const next = state.annotations.map(a => a.id === state.editingId ? {
                      ...a,
                      content: url,
                      meta: { ...a.meta, text }
                    } : a);
                    pushHistory({ annotations: next });
                    setState(s => ({ ...s, showQrModal: false, savedQr: url, editingId: null, selectedId: s.editingId }));
                  } else {
                    setState(s => ({ ...s, showQrModal: false, savedQr: url, tool: "qr_drop" }));
                  }
                }}
              />
            )}

            {/* Stamp Modal */}
            {state.showStampModal && (
              <StampModal
                editingId={state.editingId}
                savedStamp={state.savedStamp}
                onClose={() => setState(s => ({ ...s, showStampModal: false }))}
                onSave={(url) => {
                  localStorage.setItem("nextooly_stamp", url);
                  if (state.editingId) {
                    const next = state.annotations.map(a => a.id === state.editingId ? { ...a, content: url } : a);
                    pushHistory({ annotations: next });
                    setState(s => ({ ...s, showStampModal: false, savedStamp: url, editingId: null, selectedId: s.editingId }));
                  } else {
                    setState(s => ({ ...s, showStampModal: false, savedStamp: url, tool: "stamp_drop" }));
                  }
                }}
              />
            )}
          </>
        )}

        {state.showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Password Protected</h3>
                <p className="text-slate-600 mb-6">
                  This PDF file is encrypted. Please remove the password protection and upload the unlocked file to edit it.
                </p>
                <button
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  onClick={() => setState(s => ({ ...s, showPasswordModal: false }))}
                >
                  Okay, I understand
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}