import React from 'react';

interface EditTextContextBarProps {
  mode: "block" | "line";
  setMode: (mode: "block" | "line") => void;
}

export const EditTextContextBar: React.FC<EditTextContextBarProps> = ({ mode, setMode }) => {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Scan Mode:</span>
      <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
        <button
          className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
            mode === "line"
              ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setMode("line")}
        >
          Lines
        </button>
        <button
          className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
            mode === "block"
              ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setMode("block")}
        >
          Paragraphs
        </button>
      </div>
      <span className="text-xs text-blue-400 ml-2 animate-pulse font-medium">
        Hover & Click text to edit
      </span>
    </div>
  );
};