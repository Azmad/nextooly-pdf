import React from 'react';

interface EditTextContextBarProps {
  mode: "block" | "line";
  setMode: (mode: "block" | "line") => void;
  /** Set to true once the user has clicked their first text block */
  hasInteracted: boolean;
}

export const EditTextContextBar: React.FC<EditTextContextBarProps> = ({ mode, setMode, hasInteracted }) => {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Select by:</span>
      <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
        <button
          className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
            mode === "line"
              ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setMode("line")}
          title="Select individual lines of text"
        >
          Line
        </button>
        <button
          className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
            mode === "block"
              ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setMode("block")}
          title="Select whole paragraphs at once"
        >
          Paragraph
        </button>
      </div>
      {/* Instruction hint — fades out after first interaction */}
      {!hasInteracted && (
        <span className="text-xs text-blue-400 ml-1 animate-pulse font-medium select-none">
          Click on text to edit it
        </span>
      )}
    </div>
  );
};
