import React from "react";

type ExternalBreadcrumbProps = {
  currentLabel?: string;
  homeHref?: string;
  categoryLabel?: string;
  categoryHref?: string;
};

export default function ExternalBreadcrumb({
  currentLabel = "PDF Compressor",
  homeHref = "https://nextooly.com/",
  categoryLabel = "File Conversion",
  categoryHref = "https://nextooly.com/category/file-conversion",
}: ExternalBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px]">
      <a href={homeHref} className="text-[rgb(37,99,235)] font-medium hover:underline">
        Home
      </a>

      <span className="text-slate-400">/</span>

      <a href={categoryHref} className="text-[rgb(37,99,235)] font-medium hover:underline">
        {categoryLabel}
      </a>

      <span className="text-slate-400">/</span>

      <span className="text-[#0f172a] font-semibold">{currentLabel}</span>
    </nav>
  );
}
