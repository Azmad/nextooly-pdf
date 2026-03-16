import type { Metadata } from "next";
import React from "react";
import PdfUnlockTool from "@/components/tools/PdfUnlockTool";
import { MoreToolsSection } from "@/components/tools/StaticContent";
import JsonLdSchema, { type JsonLdFaqItem } from "@/components/tools/JsonLdSchema";
import NextoolyToolPageShell from "@/components/tools/NextoolyToolPageShell";
import { HowToGridSection, FaqListSection } from "@/components/tools/NextoolyContentBlocks";

const PAGE_URL = "https://pdf.nextooly.com/unlock-pdf";
const PAGE_TITLE = "Unlock PDF Online - Remove PDF Password Securely | Nextooly";
const PAGE_DESCRIPTION =
  "Unlock password-protected PDFs online. Remove PDF passwords securely in your browser with no uploads. Fast, private, and free by Nextooly.";
const OG_IMAGE = "https://pdf.nextooly.com/og-image.png";

const featureList = [
  "Unlock PDFs locally in the browser",
  "No file uploads required",
  "Preserve PDF content and layout",
  "Fast browser-based decryption",
];

const faqs: JsonLdFaqItem[] = [
  {
    q: "Does this tool upload my PDF or password to any server?",
    a: "No. Unlocking happens locally in your browser. Your PDF and password never leave your device.",
  },
  {
    q: "Can I unlock a PDF without knowing the password?",
    a: "No. You must provide the correct password to decrypt the file. This tool does not bypass PDF security.",
  },
  {
    q: "Will this change my PDF content?",
    a: "No. The output is the same PDF without encryption. The content and layout remain unchanged.",
  },
  {
    q: "Why does unlocking fail sometimes?",
    a: "Common reasons include an incorrect password, corrupted files, or unsupported encryption structures in certain PDFs.",
  },
  {
    q: "Can I re-protect the unlocked PDF with a new password?",
    a: "Yes. After unlocking, you can use Nextooly Protect PDF to apply a new password.",
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
        alt: "Nextooly Unlock PDF tool",
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

export default function UnlockPdfPage() {
  return (
    <NextoolyToolPageShell
      schema={
        <JsonLdSchema
          name="Nextooly Unlock PDF"
          description={PAGE_DESCRIPTION}
          url={PAGE_URL}
          featureList={featureList}
          faqItems={faqs}
        />
      }
      title="Unlock PDF"
      description="Remove password security from your PDF files instantly."
      tool={<PdfUnlockTool />}
      belowTool={
        <>
          <HowToGridSection
            heading="How to unlock a PDF file online"
            steps={[
              { step: "1", title: "Upload your locked PDF", desc: "Click the Select PDF button or drag and drop your file into the box." },
              { step: "2", title: "Enter the password", desc: "Provide the correct document password to decrypt the PDF locally." },
              { step: "3", title: "Unlock PDF", desc: "Click the Unlock button. The encryption is removed in your browser." },
              { step: "4", title: "Download", desc: "Save the unlocked PDF file immediately to your device." },
            ]}
          />

          <FaqListSection
            heading="Frequently asked questions"
            faqs={faqs}
          />

          <MoreToolsSection currentPath="/unlock-pdf" />
        </>
      }
    />
  );
}
