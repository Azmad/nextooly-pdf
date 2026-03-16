import React, { useEffect, useRef, useState } from "react";
import { renderPageWithMuPDF } from "@/lib/mupdf/edit-service";

interface PageThumbnailProps {
  fileBuffer: ArrayBuffer;
  pageIndex: number;
  rotation: number;
}

export const PageThumbnail = ({
  fileBuffer,
  pageIndex,
  rotation,
}: PageThumbnailProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const supportsIntersectionObserver = typeof window !== "undefined" && "IntersectionObserver" in window;
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(
    () => pageIndex !== -1 && typeof window !== "undefined" && !("IntersectionObserver" in window)
  );

  useEffect(() => {
    if (pageIndex === -1 || shouldRender) return;
    const node = hostRef.current;
    if (!node) return;
    if (!supportsIntersectionObserver) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [pageIndex, shouldRender, supportsIntersectionObserver]);

  useEffect(() => {
    if (pageIndex === -1 || !shouldRender) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await renderPageWithMuPDF(fileBuffer, pageIndex, 0.5);
        if (cancelled) return;

        const canvas = document.createElement("canvas");
        canvas.width = res.width;
        canvas.height = res.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.putImageData(res.imageData, 0, 0);
        canvas.toBlob((blob) => {
          if (cancelled || !blob) return;
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          const nextUrl = URL.createObjectURL(blob);
          objectUrlRef.current = nextUrl;
          setImgUrl(nextUrl);
        }, "image/png");
      } catch (e) {
        console.error(e);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [fileBuffer, pageIndex, shouldRender]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  return (
    <div ref={hostRef} className="w-full h-full flex items-center justify-center bg-slate-100">
      {pageIndex === -1 ? (
        <div className="w-full h-full bg-white shadow-sm flex items-center justify-center">
          <span className="text-slate-300 text-xs uppercase tracking-widest font-semibold select-none">
            Blank Page
          </span>
        </div>
      ) : imgUrl ? (
        <img
          src={imgUrl}
          alt={`Page ${pageIndex + 1}`}
          className="page-thumbnail-img"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
