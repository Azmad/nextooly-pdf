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
"use client";

import React, { useEffect, useReducer, useRef } from "react";
import {
  compressWithMuPDF,
  CompressionLevel,
  PasswordProtectedError,
  PdfServiceError,
} from "@/lib/mupdf/service";
import FileDropzone from "./FileDropzone";

/** ---------------- Types ---------------- */
type ProgressState = {
  status: string;
  percent: number;
  detail?: string;
};

type Action =
  | { type: "RESET" }
  | { type: "SET_FILE"; payload: File }
  | { type: "SET_LEVEL"; payload: CompressionLevel }
  | { type: "START_PROCESSING" }
  | { type: "UPDATE_PROGRESS"; payload: ProgressState }
  | { type: "COMPLETE"; payload: { url: string; size: number; isOptimized: boolean } }
  | { type: "ERROR"; payload: string | null };

type State = {
  step: "upload" | "settings" | "processing" | "done";
  file: File | null;
  level: CompressionLevel;
  progress: ProgressState;
  outputUrl: string | null;
  outputSize: number | null;
  isAlreadyOptimized: boolean;
  error: string | null;
};

const initialState: State = {
  step: "upload",
  file: null,
  level: "balanced",
  progress: { status: "Ready", percent: 0 },
  outputUrl: null,
  outputSize: null,
  isAlreadyOptimized: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RESET":
      return {
        ...initialState,
        level: state.level ?? "balanced",
      };

    case "SET_FILE":
      return {
        ...state,
        file: action.payload,
        step: "settings",
        error: null,
        outputUrl: null,
        outputSize: null,
        isAlreadyOptimized: false,
        progress: { status: "Ready", percent: 0 },
      };

    case "SET_LEVEL":
      return { ...state, level: action.payload };

    case "START_PROCESSING":
      return {
        ...state,
        step: "processing",
        error: null,
        progress: { status: "Starting...", percent: 5 },
      };

    case "UPDATE_PROGRESS":
      return { ...state, progress: action.payload };

    case "COMPLETE":
      return {
        ...state,
        step: "done",
        outputUrl: action.payload.url,
        outputSize: action.payload.size,
        isAlreadyOptimized: action.payload.isOptimized,
        progress: { status: "Done", percent: 100 },
      };

    case "ERROR":
      return {
        ...state,
        step: state.file ? "settings" : "upload",
        error: action.payload,
        progress: { status: "Error", percent: 0 },
      };

    default:
      return state;
  }
}

function formatSize(bytes: number): string {
  if (!bytes && bytes !== 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** ---------------- Icons ---------------- */
const PdfFileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-red-500 flex-shrink-0">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="currentColor" fillOpacity="0.1" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-10 h-10 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/** ---------------- Component ---------------- */
export default function PdfCompressorTool() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    };
  }, [state.outputUrl]);

  const handleFileSelect = async (files: FileList | File[] | null) => {
    if (!files) return;
    const fileList = files instanceof FileList ? Array.from(files) : files;
    if (fileList.length === 0) return;
    
    const file = fileList[0];

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      dispatch({ type: "ERROR", payload: "Please upload a valid PDF file." });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      dispatch({ type: "ERROR", payload: "File is too large. Please upload a PDF under 100MB." });
      return;
    }

    dispatch({ type: "SET_FILE", payload: file });
  };

  const handleCompress = async () => {
    if (!state.file) return;

    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    dispatch({ type: "START_PROCESSING" });

    try {
      dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Preparing engine...", percent: 10 } });
      
      // Artificial delay for better UX feel
      await new Promise(r => setTimeout(r, 600));
      
      dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Compressing images...", percent: 40 } });

      const resultBytes = await compressWithMuPDF(state.file, state.level);

      const didReduceSize = resultBytes.length < state.file.size;

      dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Finalizing...", percent: 90 } });

      // const blob = new Blob([resultBytes], { type: "application/pdf" });
      const blob = new Blob([resultBytes as any], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      dispatch({
        type: "COMPLETE",
        payload: {
          url,
          size: resultBytes.length,
          isOptimized: !didReduceSize,
        },
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;

      if (err instanceof PasswordProtectedError) {
        dispatch({ type: "ERROR", payload: "This PDF is password-protected. Please unlock it first." });
        return;
      }

      if (err instanceof PdfServiceError) {
        dispatch({ type: "ERROR", payload: err.message || "Compression failed due to an invalid PDF." });
        return;
      }

      dispatch({ type: "ERROR", payload: err?.message || "Compression failed. Please try another file." });
    }
  };

  const handleReset = () => {
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    dispatch({ type: "RESET" });
  };

  return (
    <div className="w-full px-4 md:px-0">
      {/* Error Banner */}
      {state.error && (
        <div className="w-full max-w-lg mx-auto mb-4 p-3 bg-red-50 text-red-700 border border-red-100 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span className="text-sm font-medium">{state.error}</span>
          </div>
          <button onClick={() => dispatch({ type: "ERROR", payload: null })} className="text-sm font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Upload Step */}
      {!state.file && (
        <>
          <FileDropzone 
            onFileSelect={(file) => handleFileSelect([file])} 
            title="Select PDF file to compress"
            footerText="Reduce file size while maintaining quality. Max 100MB."
          />

          {/* BRIGHTER TIP SECTION */}
          <div className="mt-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 md:p-5 flex items-start gap-4 shadow-sm">
              <div className="flex-shrink-0 bg-amber-100 text-amber-600 rounded-full w-8 h-8 flex items-center justify-center text-lg">
                💡
              </div>
              <div className="text-sm text-amber-900 leading-relaxed">
                <span className="font-bold block mb-0.5">Quick Tip</span>
                PDFs that are already compressed may not shrink much further. Re-compressing might reduce quality without saving space.
              </div>
            </div>
          </div>
        </>
      )}


      {/* 2. Settings Step (Compact) */}
      {state.step === "settings" && state.file && (
        <div className="w-full max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            
            {/* File Header - Compact Padding */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex-shrink-0 w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
                  <PdfFileIcon />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate text-sm leading-tight" title={state.file.name}>
                    {state.file.name}
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    {formatSize(state.file.size)}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleReset} 
                className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="Remove file"
              >
                 <CloseIcon />
              </button>
            </div>

            {/* Controls - Compact Padding */}
            <div className="p-5 space-y-4 bg-white">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Compression Mode</label>
                <div className="relative group">
                  <select
                    value={state.level}
                    onChange={(e) => dispatch({ type: "SET_LEVEL", payload: e.target.value as CompressionLevel })}
                    className="appearance-none w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 block p-3 pr-10 shadow-sm transition-all hover:border-gray-300 cursor-pointer font-medium"
                  >
                    <option value="balanced">Recommended (Standard Optimization)</option>
                    <option value="lossless">Lossless (Clean Metadata Only)</option>
                    <option value="strong">Strong (Max Compression)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed px-1">
                  Select <span className="font-semibold text-gray-700">"Recommended"</span> for the best balance.
                </p>
              </div>

              <button
                onClick={handleCompress}
                className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transform hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                Compress PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Processing Step */}
      {state.step === "processing" && (
        <div className="w-full max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
            <div className="mb-6 flex justify-center relative">
               <div className="w-16 h-16 border-4 border-blue-50 rounded-full"></div>
               <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-1/2 -ml-8"></div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{state.progress.status}</h3>
            <p className="text-xs text-gray-500 mb-6 font-medium">Crunching the data...</p>
            
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-1.5 bg-blue-600 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${state.progress.percent}%` }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Done Step - Compact Fit */}
      {state.step === "done" && state.file && state.outputUrl && (
        <div className="w-full max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5 md:p-6 text-center overflow-hidden relative">
            
            {/* Success Animation/Icon (Smaller) */}
            <div className="mb-3 flex justify-center">
              <div className="rounded-full bg-green-50 p-3 animate-bounce-short">
                <CheckCircleIcon />
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">
              {state.isAlreadyOptimized ? "File Already Optimized" : "Compression Complete!"}
            </h2>
            <p className="text-gray-500 text-xs mb-5 px-4">
              {state.isAlreadyOptimized 
                ? "We couldn't reduce the file size further without quality loss."
                : "Your PDF is now smaller and ready to download."
              }
            </p>
            
            {/* Stats Card (Compact) */}
            <div className="flex items-center justify-center gap-0 text-sm text-gray-600 mb-5 bg-gray-50 rounded-xl border border-gray-100 divide-x divide-gray-200 overflow-hidden">
               <div className="flex-1 py-2 px-2">
                 <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Original</span>
                 <span className="font-bold text-gray-900 text-base">{formatSize(state.file.size)}</span>
               </div>
               <div className="flex-1 py-2 px-2 bg-white">
                 <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">New Size</span>
                 <span className={`font-bold text-base ${state.isAlreadyOptimized ? "text-gray-900" : "text-green-600"}`}>
                   {formatSize(state.outputSize || 0)}
                 </span>
               </div>
            </div>

            {/* Actions - Side-by-Side */}
            <div className="flex gap-3">
              <a
                href={state.outputUrl}
                download={`compressed-${state.file.name.replace(/\.pdf$/i, "")}.pdf`}
                className="flex-1 flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transform hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                Download
              </a>
              <button
                onClick={handleReset}
                className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}