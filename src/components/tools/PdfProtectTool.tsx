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

import React, { useMemo, useState } from "react";
import FileDropzone from "./FileDropzone";
import { protectWithMuPDF, validatePdfForProtectMuPDF } from "@/lib/mupdf/service";

type EncryptAlgo = "aes-256" | "aes-128" | "rc4-128" | "rc4-40";

export default function PdfProtectTool() {
  const [step, setStep] = useState<"upload" | "settings" | "processing" | "download">("upload");
  const [file, setFile] = useState<File | null>(null);

  const [userPassword, setUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // New State
  const [algo, setAlgo] = useState<EncryptAlgo>("aes-256");

  const [outBytes, setOutBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validation logic: Passwords must match and not be empty
  const canProtect = useMemo(() => {
    return (
      !!file && 
      userPassword.length > 0 && 
      userPassword === confirmPassword && 
      step !== "processing"
    );
  }, [file, userPassword, confirmPassword, step]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setUserPassword("");
    setConfirmPassword("");
    setAlgo("aes-256");
    setOutBytes(null);
    setError(null);
  };

  const handleFileSelect = async (f: File) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a valid PDF file.");
      setStep("upload");
      return;
    }

    setError(null);
    setOutBytes(null);
    setUserPassword("");
    setConfirmPassword("");
    setFile(null);
    setStep("processing");

    try {
      const res = await validatePdfForProtectMuPDF(f);
      if (!res.ok) {
        setStep("upload");
        if (res.reason === "encrypted") {
          setError("This PDF is already password protected. Please unlock it first.");
        } else {
          setError("This PDF appears to be corrupted or unsupported.");
        }
        return;
      }
      setFile(f);
      setStep("settings");
    } catch (e: any) {
      setStep("upload");
      setError(e?.message ?? "Failed to read PDF.");
    }
  };

  const handleProtect = async () => {
    if (!file) return;
    setStep("processing");
    setError(null);

    try {
      const bytes = await protectWithMuPDF(file, {
        userPassword,
        ownerPassword: undefined,
        algorithm: algo,
      });
      setOutBytes(bytes);
      setStep("download");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to protect PDF.");
      setStep("settings");
    }
  };

  const handleDownload = () => {
    if (!outBytes || !file) return;
    const safeBytes = new Uint8Array(outBytes);
    const blob = new Blob([safeBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `protected_${file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center justify-center gap-2">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-sm underline">Dismiss</button>
        </div>
      )}

      {step === "upload" && (
        <FileDropzone
          onFileSelect={handleFileSelect}
          title="Select PDF to Protect"
          footerText="Add a password securely. All processing happens in your browser."
        />
      )}

      {step === "settings" && file && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm max-w-xl mx-auto text-left">
          <div className="mb-6 text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔐</div>
            <h3 className="text-xl font-bold text-gray-900">{file.name}</h3>
            <p className="text-gray-500 text-sm mt-1 text-center">Set a strong password to secure your file.</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Set Password</label>
              <input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password..."
                className={`w-full p-3 border rounded-xl outline-none transition-all ${
                  confirmPassword && userPassword !== confirmPassword 
                  ? "border-red-400 focus:ring-red-500" 
                  : "border-gray-300 focus:ring-blue-500"
                }`}
              />
              {confirmPassword && userPassword !== confirmPassword && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Encryption Level</label>
              <select
                value={algo}
                onChange={(e) => setAlgo(e.target.value as EncryptAlgo)}
                className="w-full p-3 border border-gray-300 rounded-xl bg-white"
              >
                <option value="aes-256">AES-256 (Highest Security)</option>
                <option value="aes-128">AES-128 (Standard)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={reset} className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Cancel</button>
              <button 
                onClick={handleProtect} 
                disabled={!canProtect} 
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Protect PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING & DOWNLOAD Steps remain the same... */}
      {step === "processing" && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm max-w-md mx-auto">
          <div className="w-full py-3 bg-gray-100 rounded-xl flex items-center justify-center gap-2 text-gray-500 font-medium animate-pulse">
            Processing...
          </div>
        </div>
      )}

      {step === "download" && file && (
        <div className="bg-white p-8 rounded-2xl border border-green-200 shadow-sm max-w-md mx-auto">
          <div className="mb-6 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✅</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Protected!</h3>
            <p className="text-gray-500">Your PDF is now password protected.</p>
          </div>
          <button onClick={handleDownload} className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700 shadow-lg mb-4">Download PDF</button>
          <button onClick={reset} className="text-gray-500 hover:text-gray-700 text-sm font-medium underline">Protect another file</button>
        </div>
      )}
    </div>
  );
}