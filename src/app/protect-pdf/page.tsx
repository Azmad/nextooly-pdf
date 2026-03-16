import type { Metadata } from "next";
import React from "react";
import PdfProtectTool from "@/components/tools/PdfProtectTool";
import { MoreToolsSection } from "@/components/tools/StaticContent";
import JsonLdSchema, { type JsonLdFaqItem } from "@/components/tools/JsonLdSchema";
import NextoolyToolPageShell from "@/components/tools/NextoolyToolPageShell";
import { HowToGridSection, FaqListSection } from "@/components/tools/NextoolyContentBlocks";

const PAGE_URL = "https://pdf.nextooly.com/protect-pdf";
const PAGE_TITLE = "Protect PDF with Password - Secure PDF Online | Nextooly";
const PAGE_DESCRIPTION =
  "Protect PDF files with a password online. Encrypt PDFs securely in your browser. No uploads, no tracking, 100% private with Nextooly.";
const OG_IMAGE = "https://pdf.nextooly.com/og-image.png";

const featureList = [
  "Password protect PDFs locally",
  "AES-256 encryption",
  "No file uploads required",
  "Fast browser-based processing",
];

const faqs: JsonLdFaqItem[] = [
  {
    q: "Is it safe to protect my PDF on Nextooly?",
    a: "Yes. All encryption happens locally in your browser using WebAssembly. Your files and passwords are never sent to our servers, ensuring 100% privacy.",
  },
  {
    q: "What type of password am I setting?",
    a: "You are setting a document-open password. Once applied, anyone who tries to open the file will be prompted to enter this password before they can view the content.",
  },
  {
    q: "What encryption standard do you use?",
    a: "By default, we use AES-256 (Advanced Encryption Standard with a 256-bit key), which is the industry standard for securing sensitive data.",
  },
  {
    q: "Can you recover my password if I lose it?",
    a: "No. Because we respect your privacy and do not store your data, we have no way to retrieve or reset a forgotten password. Please keep your password safe.",
  },
  {
    q: "Can I protect a file that already has a password?",
    a: "No. If a file is already locked, you must first use our Unlock PDF tool to remove the old encryption before applying a new password here.",
  },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "Nextooly",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Nextooly Protect PDF tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function ProtectPdfPage() {
  return (
    <NextoolyToolPageShell
      schema={
        <JsonLdSchema
          name="Nextooly Protect PDF"
          description={PAGE_DESCRIPTION}
          url={PAGE_URL}
          featureList={featureList}
          faqItems={faqs}
        />
      }
      title="Protect PDF"
      description="Encrypt and secure your PDF documents with passwords."
      tool={<PdfProtectTool />}
      belowTool={
        <>
          <HowToGridSection
            heading="How to password protect a PDF file online"
            steps={[
              { step: "1", title: "Upload your PDF", desc: "Click the Select PDF button or drag and drop your file into the box." },
              { step: "2", title: "Set a password", desc: "Enter a strong user password. This will be required to open the document." },
              { step: "3", title: "Apply encryption", desc: "Click the Protect button. We use AES-256 encryption for maximum security." },
              { step: "4", title: "Download", desc: "Save your newly secured PDF file immediately to your device." },
            ]}
          />

          <FaqListSection
            heading="Frequently asked questions"
            faqs={faqs}
          />

          <MoreToolsSection currentPath="/protect-pdf" />
        </>
      }
    />
  );
}
