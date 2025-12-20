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

import React, {
  useReducer,
  useRef,
  useEffect
} from "react";
import { 
  compressWithMuPDF, 
  CompressionLevel,
  PasswordProtectedError,
  PdfServiceError
} from "@/lib/mupdf/service";
import FileDropzone from "./FileDropzone";

// --- Types ---
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
  | { type: "ERROR"; payload: string }
  | { type: "CANCEL" };

type State = {
  status: "idle" | "processing" | "success" | "error";
  file: File | null;
  level: CompressionLevel;
  progress: ProgressState | null;
  outputUrl: string | null;
  outputSize: number | null;
  isAlreadyOptimized: boolean; 
  error: string | null;
};

// --- Constants ---
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME = "application/pdf";
const MAGIC_BYTES = "%PDF-";

// --- Icons (Kept intact) ---
const Icons = {
  Upload: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Pdf: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Alert: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
};

// --- Styles (Kept intact) ---
const STYLES = `
  .tool-container {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    margin: 0 auto;
    color: #374151;
    background: #ffffff;
    border-radius: 1rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
    overflow: hidden;
    border: 1px solid #f3f4f6;
    position: relative;
    max-width: 600px;
  }
  .controls-area {
    padding: 1.5rem;
    background: #ffffff;
    border-top: 1px solid #f3f4f6;
  }
  .file-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .file-info { flex: 1; overflow: hidden; }
  .file-name { font-weight: 500; color: #1f2937; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-meta { font-size: 0.875rem; color: #6b7280; }
  .settings-grid {
    display: grid;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .range-label { display: flex; justify-content: space-between; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
  .level-select {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background: white;
    font-size: 0.875rem;
  }
  .action-row { display: flex; gap: 0.75rem; margin-top: 1rem; }
  .btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 0.2s;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn-primary { background: #3b82f6; color: white; border-color: #3b82f6; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: white; border-color: #d1d5db; color: #374151; }
  .btn-secondary:hover { background: #f9fafb; border-color: #9ca3af; }
  .btn-danger { background: white; border-color: #fecaca; color: #dc2626; }
  .btn-danger:hover { background: #fef2f2; border-color: #fca5a5; }
  .overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255,255,255,0.96);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    backdrop-filter: blur(2px);
  }
  .status-card {
    text-align: center;
    padding: 2rem;
    width: 80%;
  }
  .progress-bar {
    width: 100%;
    height: 6px;
    background: #e5e7eb;
    border-radius: 99px;
    margin: 1rem 0;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.3s ease;
  }
  .success-card {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }
  .info-card {
    background: #eff6ff;
    border: 1px solid #dbeafe;
    color: #1e40af;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }
  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin: 1rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }
  .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
`;

// --- Utils (Kept intact) ---
const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const validateFile = async (file: File): Promise<string | null> => {
  if (!file) return "No file selected.";
  if (file.size > MAX_FILE_SIZE) return `File too large (Max ${MAX_FILE_SIZE / 1024 / 1024}MB).`;
  if (file.type !== ALLOWED_MIME) return "Invalid file type. Please upload a PDF.";

  // Magic Bytes Check
  try {
    const slice = file.slice(0, 5);
    const text = await slice.text();
    if (!text.startsWith(MAGIC_BYTES)) {
      return "Invalid PDF file structure.";
    }
  } catch (e) {
    return "Failed to read file.";
  }
  return null;
};

// --- Reducer (Kept intact) ---
const initialState: State = {
  status: "idle",
  file: null,
  level: "balanced",
  progress: null,
  outputUrl: null,
  outputSize: null,
  isAlreadyOptimized: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RESET":
      return initialState;
    case "SET_FILE":
      return { ...initialState, file: action.payload };
    case "SET_LEVEL":
      return { ...state, level: action.payload };
    case "START_PROCESSING":
      return { ...state, status: "processing", error: null, isAlreadyOptimized: false, progress: { status: "Initializing...", percent: 0 } };
    case "UPDATE_PROGRESS":
      return { ...state, progress: action.payload };
    case "COMPLETE":
      return { 
        ...state, 
        status: "success", 
        outputUrl: action.payload.url, 
        outputSize: action.payload.size, 
        isAlreadyOptimized: action.payload.isOptimized,
        progress: null 
      };
    case "ERROR":
      return { ...state, status: "error", error: action.payload, progress: null };
    case "CANCEL":
      return { ...state, status: "idle", progress: null, error: "Operation cancelled." };
    default:
      return state;
  }
}

// --- Main Component ---
export default function PdfCompressorTool() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (state.outputUrl) {
        URL.revokeObjectURL(state.outputUrl);
      }
    };
  }, [state.outputUrl]);

  // --- UPDATED HANDLER ---
  // Adjusted to handle both single File (from Dropzone) and FileList (from old input)
  const handleFileSelect = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    
    // Normalize to single file
    const file = files instanceof FileList ? files[0] : files[0];
    
    const error = await validateFile(file);
    if (error) {
      dispatch({ type: "ERROR", payload: error });
      return;
    }

    dispatch({ type: "SET_FILE", payload: file });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCompress = async () => {
    if (!state.file) return;
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);

    dispatch({ type: "START_PROCESSING" });

    try {
      dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Initializing engine...", percent: 10 } });
      await new Promise(resolve => setTimeout(resolve, 100));

      dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Compressing PDF (WASM)...", percent: 40 } });
      
      // CALLS THE WORKING SERVICE (Preserved)
      const resultBytes = await compressWithMuPDF(
        state.file, 
        state.level as CompressionLevel
      );

      const isOptimized = resultBytes.length < state.file.size;

      dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Preparing download...", percent: 95 } });
      
      const safeBytes = new Uint8Array(resultBytes.byteLength);
      safeBytes.set(resultBytes);

      const blob = new Blob([safeBytes], { type: ALLOWED_MIME });
      const url = URL.createObjectURL(blob);

      dispatch({ type: "COMPLETE", payload: { url, size: blob.size, isOptimized } });

    } catch (err: any) {
      console.error("Compression Error:", err);
      
      let errorMessage = "An unexpected error occurred during compression.";

      if (err instanceof PasswordProtectedError) {
        errorMessage = err.message; 
      } else if (err instanceof PdfServiceError) {
        errorMessage = err.message; 
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      dispatch({ type: "ERROR", payload: errorMessage });
    }
  };

  const reset = () => {
    dispatch({ type: "RESET" });
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="tool-container">
        
        {state.error && (
          <div className="error-box">
            <Icons.Alert /> 
            <span style={{ flex: 1 }}>{state.error}</span>
            <button 
              onClick={() => dispatch({ type: "ERROR", payload: null } as any)} 
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <Icons.X />
            </button>
          </div>
        )}

        {/* --- STATE: IDLE (REPLACED WITH NEW DROPZONE) --- */}
        {!state.file && (
          <FileDropzone 
            onFileSelect={(file) => handleFileSelect([file])} 
            title="Select PDF file to compress"
            footerText="Max 100MB. 100% Secure. Files never leave your device."
          />
        )}

        {/* --- STATE: FILE SELECTED (PRESERVED) --- */}
        {state.file && (
          <div className="controls-area">
            <div className="file-card">
              <div style={{ color: "#ef4444" }}><Icons.Pdf /></div>
              <div className="file-info">
                <div className="file-name">{state.file.name}</div>
                <div className="file-meta">
                  Original: {formatSize(state.file.size)}
                </div>
              </div>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.5rem' }} 
                onClick={reset}
                disabled={state.status === "processing"}
              >
                <Icons.X />
              </button>
            </div>

            {state.status === "success" ? (
               <div className={state.isAlreadyOptimized ? "info-card" : "success-card"}>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    {state.isAlreadyOptimized ? <Icons.Check /> : <Icons.Check />} 
                 </div>
                 
                 <h3 style={{ margin: "0 0 0.5rem 0" }}>
                    {state.isAlreadyOptimized ? "File is already optimized!" : "Compression Complete!"}
                 </h3>
                 
                 <p style={{ margin: 0, fontSize: "0.9rem" }}>
                   New size: <strong>{formatSize(state.outputSize || 0)}</strong>
                   {!state.isAlreadyOptimized && state.outputSize && state.file.size && (
                     <span style={{ marginLeft: "0.5rem", opacity: 0.8 }}>
                       (-{Math.max(0, ((state.file.size - state.outputSize) / state.file.size * 100)).toFixed(0)}%)
                     </span>
                   )}
                   {state.isAlreadyOptimized && (
                     <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.8rem', opacity: 0.8 }}>
                       We could not reduce the size further without quality loss.
                     </span>
                   )}
                 </p>
                 <div className="action-row">
                    <a 
                      href={state.outputUrl!} 
                      download={`compressed-${state.file.name}`}
                      className="btn btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      <Icons.Download /> Download PDF
                    </a>
                    <button className="btn btn-secondary" onClick={reset}>
                      <Icons.Refresh /> Start Over
                    </button>
                 </div>
               </div>
            ) : (
              <div className="settings-grid">
                <div>
                  <div className="range-label">
                    <span>Compression Mode</span>
                  </div>
                  <select 
                    className="level-select"
                    value={state.level}
                    onChange={(e) => dispatch({ type: "SET_LEVEL", payload: e.target.value as CompressionLevel })}
                    disabled={state.status === "processing"}
                  >
                    <option value="balanced">Recommended (Standard Optimization)</option>
                    <option value="lossless">Lossless (Clean Metadata Only)</option>
                    <option value="strong">Strong (Aggressive Deduplication)</option>
                  </select>
                </div>

                <div className="action-row">
                  <button 
                    className="btn btn-primary"
                    onClick={handleCompress}
                    disabled={state.status === "processing"}
                  >
                    Compress PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- STATE: PROCESSING OVERLAY (PRESERVED) --- */}
        {state.status === "processing" && state.progress && (
          <div className="overlay">
            <div className="status-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Processing...
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: 0 }}>
                {state.progress.status}
              </p>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${state.progress.percent}%` }}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}