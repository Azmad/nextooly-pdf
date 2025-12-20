
import React from "react";
import PdfUnlockTool from "@/components/tools/PdfUnlockTool";
import { MoreToolsSection } from "@/components/tools/StaticContent";
import NextoolyToolPageShell from "@/components/tools/NextoolyToolPageShell";
import { HowToGridSection, FaqListSection } from "@/components/tools/NextoolyContentBlocks";

import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Unlock PDF",
  description:
    "Unlock password-protected PDF files using Nextooly. Remove PDF passwords locally in your browser with 100% client-side processing.",
  alternates: {
    canonical: "/unlock-pdf",
  },
};


export default function UnlockPdfPage() {
  return (
    <NextoolyToolPageShell
      breadcrumbLabel="Unlock PDF"
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
            faqs={[
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
            ]}
          />

          <MoreToolsSection />
        </>
      }
    />
  );
}
