import type { Metadata } from "next";
import React from "react";
import PdfEditorTool from "@/components/tools/PdfEditorTool";
import { MoreToolsSection } from "@/components/tools/StaticContent";
import JsonLdSchema, { type JsonLdFaqItem } from "@/components/tools/JsonLdSchema";
import { HowToGridSection, FaqListSection } from "@/components/tools/NextoolyContentBlocks";

const PAGE_URL = "https://pdf.nextooly.com/pdf-edit";
const PAGE_TITLE = "Free Online PDF Editor - Edit PDF Files in Your Browser | Nextooly";
const PAGE_DESCRIPTION =
  "Edit PDF files instantly in your browser - add text, images, shapes, signatures and redactions. 100% free, no sign-up, no file uploads. Your documents never leave your device.";
const OG_IMAGE = "https://pdf.nextooly.com/og-image.png";

const featureList = [
  "Add text to PDF",
  "Insert images into PDF",
  "Draw shapes and annotations",
  "Add signatures",
  "Redact sensitive content",
  "Edit existing PDF text",
  "Fill PDF forms",
  "Organize PDF pages",
  "No file upload required",
  "100% browser-based processing",
];

const faqs: JsonLdFaqItem[] = [
  {
    q: "Is this PDF editor free to use?",
    a: "Yes, Nextooly provides a completely free online PDF editor with no hidden costs, watermarks, or subscription required.",
  },
  {
    q: "Do you upload my files to a server?",
    a: "No. For your security and privacy, this tool works entirely in your browser using WebAssembly technology. Your documents never leave your device.",
  },
  {
    q: "Can I edit existing text in a PDF?",
    a: "Yes. Our Edit Text mode lets you click text blocks on the PDF to make corrections. You can also use the Redact tool to cover old text and type new content over it.",
  },
  {
    q: "Can I add images or signatures to a PDF?",
    a: "Absolutely. You can upload images (JPG, PNG) to place anywhere on the document. There is also a dedicated Signature tool to draw and save your personal signature.",
  },
  {
    q: "Does the Nextooly PDF editor work on Mac and Windows?",
    a: "Yes. Because Nextooly runs in your web browser - Chrome, Edge, Firefox, or Safari - it works on Windows, Mac, Linux, and even Chromebooks.",
  },
  {
    q: "Do I need to create an account?",
    a: "No account or sign-up is required. Just open the editor, upload your PDF, make your edits, and download the result instantly.",
  },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "free online pdf editor",
    "edit pdf online",
    "pdf editor no upload",
    "pdf text editor",
    "add text to pdf",
    "sign pdf online",
    "annotate pdf",
    "pdf editor browser",
    "edit pdf free",
    "nextooly pdf editor",
  ].join(", "),
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Edit any PDF directly in your browser. Add text, images, signatures and more. Files never leave your device - 100% private and free.",
    url: PAGE_URL,
    siteName: "Nextooly",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Nextooly Free Online PDF Editor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description:
      "Edit PDFs in your browser. Add text, images, signatures and shapes. 100% free and private - files never leave your device.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function EditPdfPage() {
  return (
    <>
      <JsonLdSchema
        name="Nextooly PDF Editor"
        description={PAGE_DESCRIPTION}
        url={PAGE_URL}
        featureList={featureList}
        faqItems={faqs}
      />

      <main className="min-h-screen bg-white pdf-editor-active-page">
        <section aria-label="PDF Editor Tool" className="w-full bg-slate-50 border-b border-slate-200">
          <PdfEditorTool />
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Free Online PDF Editor
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Edit PDF files directly in your browser. Add text, images, signatures and annotations
              - no upload, no sign-up, 100% private. Powered by WebAssembly on your own device.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-5 text-sm text-slate-500 font-medium">
              <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> No file upload</span>
              <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> No sign-up required</span>
              <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> 100% free forever</span>
              <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Works on all browsers</span>
            </div>
          </div>

          <HowToGridSection
            heading="How to edit a PDF file online"
            steps={[
              {
                step: "1",
                title: "Upload your PDF",
                desc: "Drag and drop your PDF into the editor or click to select a file from your device. The file is processed locally - never sent to any server.",
              },
              {
                step: "2",
                title: "Edit and annotate",
                desc: "Use the toolbar to add text, insert images, draw shapes, highlight content, or redact sensitive information.",
              },
              {
                step: "3",
                title: "Fill forms and sign",
                desc: "Fill out interactive PDF form fields and add your handwritten signature or a saved stamp directly to the page.",
              },
              {
                step: "4",
                title: "Download instantly",
                desc: "Click Download to save your edited PDF. All processing happens in your browser - no waiting for server uploads.",
              },
            ]}
          />

          <FaqListSection
            heading="Frequently asked questions"
            faqs={faqs}
          />

          <MoreToolsSection currentPath="/pdf-edit" />
        </div>
      </main>
    </>
  );
}
