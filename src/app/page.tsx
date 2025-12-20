import React from "react";
import ExternalBreadcrumb from '../components/tools/ExternalBreadcrumb';
import PdfCompressorTool from "@/components/tools/PdfCompressorTool";
import { HowToSection, MoreToolsSection, FaqSection } from '../components/tools/StaticContent';
import JsonLdSchema from "../components/tools/JsonLdSchema";

export default function Page() {
  return (
    <main className="min-h-screen bg-white">
      <JsonLdSchema />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-[12px]">
          <ExternalBreadcrumb />
        </div>

        <div className="text-left border-b border-gray-200 pb-2 mb-8">
          <h1 className="text-[26px] font-bold text-[#0f172a] mb-[6px] leading-tight">
            PDF Compressor
          </h1>
          
          <p className="text-[15px] text-[#475569] mb-[16px] leading-relaxed">
            Compress PDF by flattening pages and optimizing images.
          </p>
        </div>

        {/* 3. The Tool */}
        <div className="mb-16">
           <PdfCompressorTool />
        </div>

        {/* 4. Sections */}
        <HowToSection />
        <FaqSection />
        <MoreToolsSection />
        
      </div>
    </main>
  );
}