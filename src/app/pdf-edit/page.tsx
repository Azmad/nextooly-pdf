import type { Metadata } from "next";
import React from "react";
import PdfEditorTool from "@/components/tools/PdfEditorTool";
import JsonLdSchema from "@/components/tools/JsonLdSchema";
import { MoreToolsSection } from "@/components/tools/StaticContent";
import { HowToGridSection, FaqListSection } from "@/components/tools/NextoolyContentBlocks";

export const metadata: Metadata = {
  title: "Free PDF Editor - Edit PDF Text & Images Online | Nextooly",
  description: "Edit PDF files directly in your browser. Add text, images, shapes and more using our advanced local editor.",
  alternates: {
    canonical: "https://pdf.nextooly.com/pdf-edit",
  },
};

export default function EditPdfPage() {
  return (
    <main className="min-h-screen bg-white">
      <JsonLdSchema />

      {/* SECTION 1: EDITOR (Full Screen Width) */}
      <div className="w-full bg-slate-50 border-b border-slate-200">
        <PdfEditorTool />
      </div>

      {/* SECTION 2: CONTENT (Standard Container Width) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <HowToGridSection
          heading="How to edit a PDF file online"
          steps={[
            { step: "1", title: "Upload PDF", desc: "Drag and drop your file into the editor or click to select from your device." },
            { step: "2", title: "Make Edits", desc: "Use the toolbar to add text, insert images, draw shapes, or redact sensitive information." },
            { step: "3", title: "Fill & Sign", desc: "Fill out PDF forms and add your signature or stamps directly to the page." },
            { step: "4", title: "Download", desc: "Click Save to download your edited PDF. All changes are processed locally for maximum privacy." },
          ]}
        />

        <FaqListSection
          heading="Frequently asked questions"
          faqs={[
            {
              q: "Is this PDF editor free to use?",
              a: "Yes, Nextooly provides a free online PDF editor. You can add text, images, and annotations without any hidden costs or watermarks.",
            },
            {
              q: "Do you upload my files to a server?",
              a: "No. For your security, this tool works entirely in your browser using WebAssembly technology. Your documents never leave your device.",
            },
            {
              q: "Can I edit existing text in the PDF?",
              a: "Yes. Our 'Edit Text (Lite)' mode allows you to make minor corrections to existing text, or you can use the 'Redact' tool to cover old text and type over it.",
            },
            {
              q: "Can I add images or signatures?",
              a: "Absolutely. You can upload images (JPG, PNG) to place anywhere on the document. We also have a dedicated Signature tool to create and save your signature.",
            },
            {
              q: "Does this work on Mac and Windows?",
              a: "Yes. Because Nextooly runs in your web browser (Chrome, Edge, Firefox, Safari), it works on Windows, Mac, Linux, and even Chromebooks.",
            },
          ]}
        />

        <MoreToolsSection />
      </div>
    </main>
  );
}