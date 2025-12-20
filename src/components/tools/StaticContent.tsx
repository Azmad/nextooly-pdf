import React from 'react';

export function HowToSection() {
  const steps = [
    {
      num: 1,
      title: "Upload your PDF",
      desc: "Click the Add PDF file button and select the PDF you want to compress from your device."
    },
    {
      num: 2,
      title: "Choose compression level",
      desc: "Select the desired compression level or quality setting based on your size and clarity requirements."
    },
    {
      num: 3,
      title: "Start compression",
      desc: "Click the Compress PDF button and let the tool process your file in the browser."
    },
    {
      num: 4,
      title: "Download the compressed file",
      desc: "Once processing is complete, download the optimized PDF to your device."
    }
  ];

  return (
    <section 
      style={{
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: '1px solid rgb(229, 231, 235)'
      }}
    >
      <h2 
        style={{
          fontSize: '18px',
          fontWeight: 600,
          marginBottom: '16px',
          color: '#0f172a'
        }}
      >
        How to compress a PDF file online
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {steps.map((item) => (
          <div key={item.num} style={{ display: 'flex', gap: '16px' }}>
            <div 
              style={{
                flexShrink: 0,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgb(239, 246, 255)',
                color: 'rgb(37, 99, 235)',
                border: '1px solid rgb(219, 234, 254)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}
            >
              {item.num}
            </div>

            <div style={{ minWidth: 0 }}>
              <h3 
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'rgb(51, 65, 85)',
                  margin: '0 0 4px 0'
                }}
              >
                {item.title}
              </h3>
              <p 
                style={{
                  fontSize: '14px',
                  color: 'rgb(71, 85, 105)',
                  lineHeight: '1.6',
                  margin: 0
                }}
              >
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FaqSection() {
  const faqs = [
    { 
      q: "Does this PDF compressor upload my file to any server?", 
      a: "No. All compression happens locally in your browser using WebAssembly (WASM). Your file never leaves your device, ensuring 100% privacy." 
    },
    { 
      q: "How does this tool compress a PDF?", 
      a: "We use the MuPDF engine to intelligently reduce the resolution of heavy images and remove unnecessary metadata, while keeping your text sharp and selectable." 
    },
    { 
      q: "What do the compression levels mean?", 
      a: "Recommended = Balanced quality & size. High = Smallest size (lower image quality). Lossless = Cleans metadata without affecting visual quality." 
    },
    { 
      q: "Why is the compression so fast?", 
      a: "Unlike standard JavaScript tools, we use compiled WebAssembly. This allows your browser to run heavy compression tasks at near-native speed." 
    },
    { 
      q: "Why does compression sometimes fail?", 
      a: "Common reasons include password-protected files, corrupted PDFs, or files that are already fully optimized." 
    },
    { 
      q: "Does the compressor change my file name?", 
      a: "Yes, the output is saved as 'compressed.pdf' (or similar) to prevent overwriting your original file by mistake." 
    }
  ];

  return (
    <section 
      style={{
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: '1px solid rgb(229, 231, 235)'
      }}
    >
      <h2 
        style={{
          fontSize: '18px',
          fontWeight: 600,
          marginBottom: '12px',
          color: 'rgb(15, 23, 42)'
        }}
      >
        Frequently asked questions
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {faqs.map((faq, i) => (
          <div 
            key={i} 
            style={{
              borderRadius: '12px',
              border: '1px solid rgb(229, 231, 235)',
              backgroundColor: 'rgb(249, 250, 251)',
              padding: '10px 14px'
            }}
          >
            <p 
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'rgb(17, 24, 39)',
                marginBottom: '4px'
              }}
            >
              {faq.q}
            </p>
            <p 
              style={{
                fontSize: '14px',
                color: 'rgb(75, 85, 99)',
                margin: 0,
                lineHeight: '1.5'
              }}
            >
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MoreToolsSection() {
  const tools = [
    { 
      name: "PDF → Images", 
      desc: "Convert PDF pages to high-quality JPG or PNG images securely in your browser with Nextooly.", 
      slug: "pdf-to-images" 
    },
    { 
      name: "Images → PDF", 
      desc: "Convert JPG, PNG & WebP to PDF securely in your browser with Nextooly. 100% free tool.", 
      slug: "images-to-pdf" 
    },
    { 
      name: "PDF Merge", 
      desc: "Merge multiple PDF files securely in your browser. 100% free, no file uploads, and no data limits.", 
      slug: "pdf-merge" 
    },
    { 
      name: "PDF Split", 
      desc: "Split PDF files and extract pages securely in your browser with Nextooly. 100% free client-side tool.", 
      slug: "pdf-split" 
    }
  ];

  return (
    <section 
      style={{
        marginTop: '32px',
        padding: '20px 24px 24px',
        borderRadius: '12px',
        border: '1px solid rgb(229, 231, 235)',
        backgroundColor: 'rgb(248, 250, 252)'
      }}
    >
      <h2 
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#0f172a',
          marginBottom: '12px'
        }}
      >
        More tools in File Conversion
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map((tool) => (
          <a 
            key={tool.slug}
            href={`https://nextooly.com/tools/${tool.slug}`}
            className="group flex flex-col p-3 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all h-[140px]"
            style={{ textDecoration: 'none' }}
          >
            <h3 className="font-semibold text-gray-900 text-sm mb-1">{tool.name}</h3>
            
            <p className="text-gray-500 text-[13px] leading-snug overflow-hidden flex-1 line-clamp-3">
              {tool.desc}
            </p>

            <div className="flex items-center justify-between mt-2">
              <div className="text-blue-600 text-xs font-semibold flex items-center gap-1">
                Open tool <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
              <span className="bg-green-50 text-green-700 text-[11px] px-2 py-0.5 rounded-full border border-green-100">
                Free
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}