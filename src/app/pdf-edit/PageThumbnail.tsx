import React, { useEffect, useState } from "react";
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
  if (pageIndex === -1) {
    return (
      <div className="w-full h-full bg-white shadow-sm flex items-center justify-center">
        <span className="text-slate-300 text-xs uppercase tracking-widest font-semibold select-none">
          Blank Page
        </span>
      </div>
    );
  }

  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const scale = 0.5;
        const res = await renderPageWithMuPDF(fileBuffer, pageIndex, scale);

        if (!isMounted) return;

        const canvas = document.createElement('canvas');
        canvas.width = res.width;
        canvas.height = res.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(res.imageData, 0, 0);
          setImgUrl(canvas.toDataURL());
        }
      } catch (e) { console.error(e); }
    };
    load();
    return () => { isMounted = false; };
  }, [fileBuffer, pageIndex]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      {imgUrl ? (
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