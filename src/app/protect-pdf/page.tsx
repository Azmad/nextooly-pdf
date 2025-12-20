import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Protect PDF",
  description:
    "Protect PDF files with a password using Nextooly. Encrypt PDFs locally in your browser with 100% client-side processing.",
  alternates: {
    canonical: "/protect-pdf",
  },
};

import React from "react";
import PdfProtectTool from "@/components/tools/PdfProtectTool";
import { MoreToolsSection } from "@/components/tools/StaticContent";
import JsonLdSchema from "@/components/tools/JsonLdSchema";
import NextoolyToolPageShell from "@/components/tools/NextoolyToolPageShell";
import { HowToGridSection, FaqListSection } from "@/components/tools/NextoolyContentBlocks";

export default function Page() {
  return (
    <NextoolyToolPageShell
      schema={<JsonLdSchema />}
      breadcrumbLabel="Protect PDF"
      title="Protect PDF"
      description="Encrypt and secure your PDF documents with passwords."
      tool={<PdfProtectTool />}
      belowTool={
        <>
          <HowToGridSection
            heading="How to password protect a PDF file online"
            steps={[
              { step: "1", title: "Upload your PDF", desc: "Click the Select PDF button or drag and drop your file into the box." },
              { step: "2", title: "Set a Password", desc: "Enter a strong 'User Password'. This will be required to open the document." },
              { step: "3", title: "Apply Encryption", desc: "Click the Protect button. We use AES-256 encryption for maximum security." },
              { step: "4", title: "Download", desc: "Save your newly secured PDF file immediately to your device." },
            ]}
          />

          <FaqListSection
            heading="Frequently asked questions"
            faqs={[
              {
                q: "Is it safe to protect my PDF on Nextooly?",
                a: "Yes. All encryption happens locally in your browser using WebAssembly. Your files and passwords are never sent to our servers, ensuring 100% privacy.",
              },
              {
                q: "What type of password am I setting?",
                a: "You are setting a 'Document Open' password. Once applied, anyone who tries to open the file will be prompted to enter this password before they can view the content.",
              },
              {
                q: "What encryption standard do you use?",
                a: "By default, we use AES-256 (Advanced Encryption Standard with a 256-bit key), which is the industry standard for securing sensitive data. It is virtually impossible to crack with current technology.",
              },
              {
                q: "Can you recover my password if I lose it?",
                a: "No. Because we respect your privacy and don't store your data, we have no way to retrieve or reset a forgotten password. Please keep your password safe.",
              },
              {
                q: "Can I protect a file that already has a password?",
                a: "No. If a file is already locked, you must first use our 'Unlock PDF' tool to remove the old encryption before applying a new password here.",
              },
            ]}
          />

          <MoreToolsSection />
        </>
      }
    />
  );
}
