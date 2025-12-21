import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compress PDF Online – Reduce PDF File Size Free | Nextooly",
  description:
    "Compress PDF files online for free. Reduce PDF size without losing quality. 100% secure, browser-based PDF compressor by Nextooly.",
  alternates: {
    canonical: "https://pdf.nextooly.com/compress",
  },
};

import React from "react";
import PdfCompressorTool from "@/components/tools/PdfCompressorTool";
import { MoreToolsSection } from "@/components/tools/StaticContent";
import JsonLdSchema from "@/components/tools/JsonLdSchema";
import NextoolyToolPageShell from "@/components/tools/NextoolyToolPageShell";
import { HowToGridSection, FaqListSection } from "@/components/tools/NextoolyContentBlocks";

export default function CompressPage() {
  return (
    <NextoolyToolPageShell
      schema={<JsonLdSchema />}
      breadcrumbLabel="Compress PDF"
      title="Compress PDF"
      description="Reduce PDF file size while keeping text sharp and selectable."
      tool={<PdfCompressorTool />}
      belowTool={
        <>
          <HowToGridSection
            heading="How to compress a PDF file online"
            steps={[
              { step: "1", title: "Upload your PDF", desc: "Click the Select PDF button or drag and drop your file into the box." },
              { step: "2", title: "Choose a compression level", desc: "Select the level you want based on size reduction versus image quality." },
              { step: "3", title: "Compress", desc: "Click Compress PDF. Your browser will optimize the file locally." },
              { step: "4", title: "Download", desc: "Save the compressed PDF immediately to your device." },
            ]}
          />

          <FaqListSection
            heading="Frequently asked questions"
            faqs={[
              {
                q: "Does this PDF compressor upload my file to any server?",
                a: "No. All compression happens locally in your browser using WebAssembly (WASM). Your file never leaves your device, ensuring 100% privacy.",
              },
              {
                q: "How does this tool compress a PDF?",
                a: "We use the MuPDF engine to intelligently reduce the resolution of heavy images and remove unnecessary metadata, while keeping your text sharp and selectable.",
              },
              {
                q: "What do the compression levels mean?",
                a: "Recommended = Balanced quality & size. High = Smallest size (lower image quality). Lossless = Cleans metadata without affecting visual quality.",
              },
              {
                q: "Why is the compression so fast?",
                a: "Unlike standard JavaScript tools, we use compiled WebAssembly. This allows your browser to run heavy compression tasks at near-native speed.",
              },
              {
                q: "Why does compression sometimes fail?",
                a: "Common reasons include password-protected files, corrupted PDFs, or files that are already fully optimized.",
              },
              {
                q: "Does the compressor change my file name?",
                a: "Yes, the output is saved as 'compressed.pdf' (or similar) to prevent overwriting your original file by mistake.",
              },
            ]}
          />

          <MoreToolsSection />
        </>
      }
    />
  );
}
