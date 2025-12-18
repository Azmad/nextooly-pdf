"use client";

import React, {
  useReducer,
  useRef,
  useEffect
} from "react";

// --- Types ---
type CompressionLevel = "lossless" | "balanced" | "strong";

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
  | { type: "COMPLETE"; payload: { url: string; size: number } }
  | { type: "ERROR"; payload: string }
  | { type: "CANCEL" };

type State = {
  status: "idle" | "processing" | "success" | "error";
  file: File | null;
  level: CompressionLevel;
  progress: ProgressState | null;
  outputUrl: string | null;
  outputSize: number | null;
  error: string | null;
};

// --- Constants ---
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME = "application/pdf";
const MAGIC_BYTES = "%PDF-";

// --- Icons ---
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
  )
};

// --- Styles ---
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
  .dropzone {
    border: 2px dashed #e5e7eb;
    border-radius: 1rem;
    padding: 3rem 2rem;
    text-align: center;
    transition: all 0.2s ease;
    background: #f9fafb;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #9ca3af;
    margin: 1.5rem;
  }
  .dropzone:hover:not(.disabled) {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #2563eb;
  }
  .dropzone.disabled { opacity: 0.5; cursor: not-allowed; }
  .drop-icon { transition: transform 0.2s; }
  .dropzone:hover .drop-icon { transform: translateY(-4px); }
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

// --- Utils ---
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

  // Magic Bytes Check (First 5 bytes for %PDF-)
  try {
    const slice = file.slice(0, 5);
    const text = await slice.text();
    if (!text.startsWith(MAGIC_BYTES)) {
      return "Invalid PDF file structure (missing magic bytes).";
    }
  } catch (e) {
    return "Failed to read file.";
  }
  return null;
};

// --- Reducer ---
const initialState: State = {
  status: "idle",
  file: null,
  level: "balanced",
  progress: null,
  outputUrl: null,
  outputSize: null,
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
      return { ...state, status: "processing", error: null, progress: { status: "Initializing...", percent: 0 } };
    case "UPDATE_PROGRESS":
      return { ...state, progress: action.payload };
    case "COMPLETE":
      return { ...state, status: "success", outputUrl: action.payload.url, outputSize: action.payload.size, progress: null };
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
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup effect for Object URLs
  useEffect(() => {
    return () => {
      if (state.outputUrl) {
        URL.revokeObjectURL(state.outputUrl);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [state.outputUrl]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // Validate
    const error = await validateFile(file);
    if (error) {
      dispatch({ type: "ERROR", payload: error });
      return;
    }

    dispatch({ type: "SET_FILE", payload: file });
    // Reset file input value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCompress = async () => {
    if (!state.file) return;

    // cleanup previous operations
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    dispatch({ type: "START_PROCESSING" });

    try {
      // --- Dynamic Imports ---
      // We import strictly when needed to keep bundle small
      const { PDFDocument } = await import("pdf-lib");
      
      if (signal.aborted) throw new Error("Aborted");

      const arrayBuffer = await state.file.arrayBuffer();
      if (signal.aborted) throw new Error("Aborted");

      dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Loading PDF...", percent: 10 } });

      let resultBytes: Uint8Array;

      // --- LOGIC BRANCHING ---

      if (state.level === "lossless") {
        // --- Strategy 1: Repack with Object Streams (Lossless) ---
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Optimizing streams...", percent: 50 } });
        
        // Saving with useObjectStreams=true often reduces size for PDFs that didn't use it before
        resultBytes = await pdfDoc.save({ useObjectStreams: true });

      } else {
        // --- Strategy 2: Rasterization (Lossy - Balanced/Strong) ---
        
        // 🟢 FIX START: Webpack Asset Module Pattern (Derived from PdfToImagesTool)
        // 1. Import from 'pdfjs-dist/build/pdf' explicitly
        const pdfjsModule = await import("pdfjs-dist/build/pdf.mjs");
        const pdfjs = (pdfjsModule.default || pdfjsModule) as any;

        // 2. Configure Worker using 'new URL' + 'import.meta.url' + '.js' extension
        // This forces Webpack to bundle the worker file locally.
       pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

        // 🟢 FIX END

        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          disableRange: true,
          disableStream: true,
        });

        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        const newPdf = await PDFDocument.create();

        // Canvas for rendering
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        
        if (!ctx) throw new Error("Canvas context unavailable");

        // Scale/Quality Settings
        // Balanced: 1.0 scale, 0.7 quality
        // Strong: 0.6 scale, 0.5 quality
        const scale = state.level === "balanced" ? 1.0 : 0.6;
        const quality = state.level === "balanced" ? 0.7 : 0.5;

        for (let i = 1; i <= totalPages; i++) {
          if (signal.aborted) throw new Error("Aborted");

          dispatch({ 
            type: "UPDATE_PROGRESS", 
            payload: { 
              status: `Processing page ${i} of ${totalPages}...`, 
              percent: 20 + Math.floor((i / totalPages) * 60) 
            } 
          });

          // Yield to main thread to allow UI updates and abortion
          await new Promise(resolve => setTimeout(resolve, 0));

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear memory

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;

          // Convert to JPEG
          const blob = await new Promise<Blob | null>((resolve) => 
            canvas.toBlob(resolve, "image/jpeg", quality)
          );

          if (!blob) throw new Error(`Failed to process page ${i}`);

          const imgBuffer = await blob.arrayBuffer();
          const jpgImage = await newPdf.embedJpg(imgBuffer);
          
          const newPage = newPdf.addPage([jpgImage.width, jpgImage.height]);
          newPage.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: jpgImage.width,
            height: jpgImage.height,
          });

          // Cleanup PDF.js page
          page.cleanup();
        }
        
        // Cleanup PDF.js doc
        loadingTask.destroy();
        canvas.width = 0;
        canvas.height = 0;

        dispatch({ type: "UPDATE_PROGRESS", payload: { status: "Finalizing...", percent: 90 } });
        resultBytes = await newPdf.save({ useObjectStreams: true });
      }

      if (signal.aborted) throw new Error("Aborted");

      // --- Result Handling ---
      // const blob = new Blob([resultBytes], { type: ALLOWED_MIME });
      const blob = new Blob([resultBytes as any], {
        type: ALLOWED_MIME,
      });
      const url = URL.createObjectURL(blob);

      dispatch({ type: "COMPLETE", payload: { url, size: blob.size } });

    } catch (err: any) {
      if (signal.aborted || err.message === "Aborted") {
        console.log("Processing cancelled");
      } else {
        console.error(err);
        
        let msg = err.message || "Failed to compress PDF.";
        if (msg.includes("fake worker") || msg.includes("Cannot load script")) {
            msg = "Rasterization failed due to browser environment restrictions. Please try 'Lossless' mode.";
        }
        
        dispatch({ type: "ERROR", payload: msg });
      }
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    dispatch({ type: "CANCEL" });
  };

  const reset = () => {
    handleCancel();
    dispatch({ type: "RESET" });
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="tool-container">
        
        {state.error && (
          <div className="error-box">
            <Icons.Alert /> {state.error}
            <button 
              onClick={() => dispatch({ type: "ERROR", payload: null } as any)} // Type hack for clearing error
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <Icons.X />
            </button>
          </div>
        )}

        {/* --- STATE: IDLE (Upload) --- */}
        {!state.file && (
          <div 
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelect(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="visually-hidden"
            />
            <div className="drop-icon" style={{ color: '#3b82f6' }}>
              <Icons.Upload />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                Select PDF file to compress
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Max 100MB. 100% Client-side processing.</p>
            </div>
          </div>
        )}

        {/* --- STATE: FILE SELECTED (Settings) --- */}
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
               <div className="success-card">
                 <h3 style={{ margin: "0 0 0.5rem 0" }}>Compression Complete!</h3>
                 <p style={{ margin: 0, fontSize: "0.9rem" }}>
                   New size: <strong>{formatSize(state.outputSize || 0)}</strong>
                   {state.outputSize && state.file.size && (
                     <span style={{ marginLeft: "0.5rem", opacity: 0.8 }}>
                       (-{Math.max(0, ((state.file.size - state.outputSize) / state.file.size * 100)).toFixed(0)}%)
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
                    <option value="lossless">Lossless (Optimize Structures)</option>
                    <option value="balanced">Recommended (Smaller size, text becomes image)</option>
                    <option value="strong">Max Compression (Best for sharing, text not selectable)</option>
                  </select>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    {state.level === "lossless" 
                      ? "Best quality. Removes unused metadata. Might not reduce size of already optimized files."
                      : "Converts pages to images. Significant size reduction but text becomes non-selectable."}
                  </p>
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

        {/* --- STATE: PROCESSING OVERLAY --- */}
        {state.status === "processing" && state.progress && (
          <div className="overlay">
            <div className="status-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Compressing...
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

              <button 
                className="btn btn-danger"
                style={{ width: 'auto', display: 'inline-flex', padding: '0.5rem 1rem' }}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}