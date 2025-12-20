"use client";

import React, { useState, useRef } from "react";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  title?: string; // e.g., "Select PDF file to compress"
  footerText?: React.ReactNode; // e.g., "Max 100MB..."
  disabled?: boolean;
}

export default function FileDropzone({
  onFileSelect,
  title = "Select PDF file",
  footerText,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Drag Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        onFileSelect(file);
      } else {
        alert("Please upload a PDF file.");
      }
    }
  };

  // Handle Click Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={() => !disabled && fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full max-w-xl mx-auto h-64 
        border-2 border-dashed rounded-xl 
        flex flex-col items-center justify-center 
        transition-all cursor-pointer select-none
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-500 hover:bg-blue-50/50"}
        ${isDragging ? "border-blue-500 bg-blue-50" : "border-blue-200 bg-white"}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf"
        className="hidden"
        disabled={disabled}
      />

      {/* Icon */}
      <div className="mb-4 p-4 rounded-full bg-blue-50 text-blue-600">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </div>

      {/* Text */}
      <h3 className="text-xl font-medium text-gray-900 mb-2">
        {title}
      </h3>
      
      {/* Footer / Subtext */}
      {footerText && (
        <p className="text-sm text-gray-500 text-center px-4">
          {footerText}
        </p>
      )}
    </div>
  );
}