import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

export const metadata: Metadata = {
  title: "Free PDF Tools Online – Compress, Protect & Unlock | Nextooly",
  description:
    "Free, fast, and secure PDF tools. Compress PDFs, protect with passwords, or unlock secured files. 100% browser-based. No uploads.",
  alternates: {
    canonical: "https://pdf.nextooly.com/",
  },
  openGraph: {
    title: "Free PDF Tools Online – Compress, Protect & Unlock | Nextooly",
    description:
      "Compress, protect, and unlock PDFs securely in your browser. No uploads, no tracking.",
    url: "https://pdf.nextooly.com/",
    siteName: "Nextooly",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free PDF Tools Online – Nextooly",
    description:
      "Privacy-first PDF tools to compress, protect, and unlock PDFs online.",
  },
};



const tiles = [
  {
    title: "Compress PDF",
    description: "Reduce PDF file size while keeping text sharp and selectable.",
    href: "/compress",
    gradient: "from-[#eef5ff] via-white to-white",
  },
  {
    title: "Protect PDF",
    description: "Add a password and encrypt your PDF using AES-256 security.",
    href: "/protect-pdf",
    gradient: "from-[#f4f7ff] via-white to-white",
  },
  {
    title: "Unlock PDF",
    description: "Remove a known password from a protected PDF safely.",
    href: "/unlock-pdf",
    gradient: "from-[#f5faff] via-white to-white",
  },
];

export default function HomePage() {
  return (
    <main className="max-w-[1200px] mx-auto px-4">
      {/* Top gap */}
      <div className="pt-5 pb-12">
        <h1 className="text-[38px] font-bold text-[#0f172a] mb-4">
          PDF Tools
        </h1>
        <p className="text-[17px] text-[#64748b] max-w-[760px]">
          Fast, secure, and privacy-first tools that run entirely in your browser.
          No uploads.
        </p>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-16">
        {tiles.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className={`relative rounded-[20px] border border-[#e5e7eb]
              bg-gradient-to-br ${t.gradient}
              p-7 min-h-[210px]
              shadow-[0_10px_30px_rgba(0,0,0,0.05)]
              transition hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)]
              hover:-translate-y-[2px]`}
          >
            {/* Title */}
            <h2 className="text-[22px] font-semibold text-[#0f172a] mb-3">
              {t.title}
            </h2>

            {/* Description */}
            <p className="text-[15px] text-[#64748b] leading-relaxed max-w-[90%]">
              {t.description}
            </p>

            {/* Footer */}
            <div className="absolute bottom-6 left-7 right-7 flex items-center justify-between">
              <span className="text-[15px] font-medium text-[#2563eb]">
                Open tool →
              </span>

              <span className="text-[13px] rounded-full px-3 py-1
                bg-[#ecfdf3] text-[#047857] border border-[#bbf7d0]">
                Free
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
