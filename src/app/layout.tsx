import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../components/layout/Header";

const inter = Inter({ subsets: ["latin"] });
const SITE_URL = "https://nextooly.com"; 

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nextooly — Fast, Secure & Free Online Tools",
    template: "%s | Nextooly",
  },
  applicationName: "Nextooly",
  description:
    "Use 90+ fast, secure, browser-based tools for PDFs, images, text, data, security, and more. 100% client-side, no uploads, no signup.",
  keywords: [
    "nextooly",
    "online tools",
    "pdf tools",
    "image tools",
    "text tools",
    "developer tools",
    "browser tools",
    "free utilities",
    "client-side tools",
  ],
  icons: {
    icon: "/favicon.ico", 
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "Nextooly — Fast, Secure & Free Online Tools",
    description:
      "Use 90+ fast, secure, browser-based tools for PDFs, images, text, data, security, and more. Everything runs in your browser — no uploads, no signup.",
    url: SITE_URL,
    siteName: "Nextooly",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/main-logo.png`,
        width: 1200,
        height: 630,
        alt: "Nextooly Tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nextooly — Fast, Secure & Free Online Tools",
    description: "Free, fast, and secure browser-based tools...",
    images: [`${SITE_URL}/main-logo.png`], 
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