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

import React, { useState } from "react";
import { unlockWithMuPDF, pdfNeedsPasswordMuPDF } from "@/lib/mupdf/service";
import FileDropzone from "./FileDropzone";

export default function PdfUnlockTool() {
  const [step, setStep] = useState<"upload" | "password" | "processing" | "download">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [unlockedBytes, setUnlockedBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (f: File) => {
    if (!f) return;

    // Validate PDF
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a valid PDF file.");
      setFile(null);
      setUnlockedBytes(null);
      setStep("upload");
      return;
    }

    setFile(f);
    setPassword("");
    setUnlockedBytes(null);
    setError(null);

    // Use step as the processing indicator (no separate setProcessing state)
    setStep("processing");

    try {
      const needsPwd = await pdfNeedsPasswordMuPDF(f);

      if (needsPwd) {
        setStep("password");
      } else {
        setFile(null);
        setStep("upload");
        setError("This PDF is not password protected. Please upload a locked PDF.");
      }
    } catch (e: any) {
      setFile(null);
      setStep("upload");
      setError(e?.message ?? "Failed to read PDF. The file may be invalid.");
    }
  };

  const handleUnlock = async () => {
    if (!file) return;

    setStep("processing");
    setError(null);

    try {
      const result = await unlockWithMuPDF(file, password);
      setUnlockedBytes(result);
      setStep("download");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to unlock PDF.");
      setStep("password");
    }
  };

  const handleDownload = () => {
    if (!unlockedBytes || !file) return;

    // const blob = new Blob([unlockedBytes], { type: "application/pdf" });
    const blob = new Blob([unlockedBytes as any], {
        type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `unlocked_${file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setPassword("");
    setUnlockedBytes(null);
    setError(null);
    setStep("upload");
  };

  return (
    <div className="w-full max-w-4xl mx-auto text-center">
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center justify-center gap-2">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === "upload" && (
        <FileDropzone
          onFileSelect={handleFileSelect}
          title="Select PDF to Unlock"
          footerText="Remove passwords instantly. Secure client-side processing."
        />
      )}

      {/* STEP 2: PASSWORD INPUT / PROCESSING */}
      {(step === "password" || step === "processing") && file && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
              {/* Lock Icon */}
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">{file.name}</h3>
            <p className="text-gray-500 text-sm mt-1">This file is password protected.</p>
          </div>

          <div className="text-left mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter file password"
              disabled={step === "processing"}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && step !== "processing") handleUnlock();
              }}
            />
          </div>

          {step === "processing" ? (
            <div className="w-full py-3 bg-gray-100 rounded-xl flex items-center justify-center gap-2 text-gray-500 font-medium animate-pulse">
              Unlocking...
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlock}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg"
              >
                Unlock PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: DOWNLOAD */}
      {step === "download" && (
        <div className="bg-white p-8 rounded-2xl border border-green-200 shadow-sm max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              {/* Unlock Icon */}
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Unlocked!</h3>
            <p className="text-gray-500">The password has been removed.</p>
          </div>

          <button
            onClick={handleDownload}
            className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700 shadow-lg mb-4 flex items-center justify-center gap-2"
          >
            Download PDF
          </button>

          <button
            onClick={reset}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium underline"
          >
            Unlock another file
          </button>
        </div>
      )}
    </div>
  );
}
