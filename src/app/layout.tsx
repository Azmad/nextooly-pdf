import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../components/layout/Header";

const inter = Inter({ subsets: ["latin"], display: "swap" });
const SITE_URL = "https://pdf.nextooly.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "Nextooly PDF Tools — Compress, Protect & Unlock PDFs",
    template: "%s | Nextooly",
  },
  applicationName: "Nextooly",
  description:"Free PDF tools by Nextooly. Compress, protect, and unlock PDFs directly in your browser. 100% client-side, no uploads.",
  keywords: [
  "nextooly",
  "pdf tools",
  "pdf compressor",
  "compress pdf",
  "protect pdf",
  "encrypt pdf",
  "unlock pdf",
  "remove pdf password",
  "client-side pdf",
  "browser pdf tools",
],

  icons: {
    icon: "/favicon.ico", 
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "Nextooly PDF Tools — Compress, Protect & Unlock PDFs",
    description:"Compress, protect, and unlock PDFs directly in your browser. 100% client-side processing, no uploads.",
    url: SITE_URL,
    siteName: "Nextooly",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Nextooly Tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nextooly PDF Tools — Compress, Protect & Unlock PDFs",
    description: "Free PDF tools by Nextooly. 100% client-side, no uploads.",
    images: [`${SITE_URL}/main-logo.png`], 
  },
  other: {
  "application/ld+json": JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nextooly PDF Tools",
    applicationCategory: "UtilityApplication",
    operatingSystem: "Web",
    url: "https://pdf.nextooly.com",
    description:
      "Free online PDF tools by Nextooly to compress, protect, and unlock PDF files using 100% client-side processing.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: "Nextooly",
      url: "https://nextooly.com",
    },
  }),
},

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Kept paddingBottom: "80px" as requested for Ad reservation */}
      <body 
        className={`${inter.className} antialiased`} 
        style={{ 
          margin: 0, 
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", 
          backgroundColor: "#ffffff", 
          color: "#111827", 
          minHeight: "100vh", 
          display: "flex", 
          flexDirection: "column",
          paddingBottom: "80px" 
        }}
      >
        
        <Header />

        <main style={{ flex: 1 }}>
          {children}
        </main>

        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 100, backgroundColor: 'transparent', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70px', pointerEvents: 'none' }}>
        </div>

        {/* --- Footer (Updated with AGPL Link) --- */}
        <footer style={{ width: "100%", borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb", marginTop: "40px" }}>
          <div style={{ maxWidth: "min(1200px, 100%)", margin: "0 auto", padding: "22px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", fontSize: "14px", color: "#4b5563" }}>
            
            {/* Copyright */}
            <div>
              &copy; {new Date().getFullYear()} <span style={{ fontWeight: 700, color: "#111827" }}>Nextooly</span>. All rights reserved.
            </div>

            {/* Links Area */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
              
              {/* --- REQUIRED: MuPDF Attribution --- */}
              <a 
                href="https://github.com/Azmad/nextooly-pdf-compressor" 
                target="_blank" 
                rel="nofollow noreferrer"
                style={{ textDecoration: "none", color: "#64748b", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                 Source Code (AGPL)
              </a>
              <span style={{ color: "#cbd5e1" }}>|</span>

              <a style={{ textDecoration: "none", color: "#4b5563" }} href="https://nextooly.com/privacy">Privacy Policy</a>
              <a style={{ textDecoration: "none", color: "#4b5563" }} href="https://nextooly.com/terms">Terms of Use</a>
              <a style={{ textDecoration: "none", color: "#4b5563" }} href="https://nextooly.com/contact">Contact</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}