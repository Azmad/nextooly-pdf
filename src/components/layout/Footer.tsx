import React from 'react';

const MAIN_SITE = "https://nextooly.com";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        width: "100%",
        borderTop: "1px solid #e5e7eb",
        backgroundColor: "#f9fafb",
        marginTop: "auto", 
        paddingTop: "40px",
      }}
    >
      <div
        style={{
          maxWidth: "min(1200px, 100%)",
          margin: "0 auto",
          padding: "22px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          fontSize: "14px",
          color: "#4b5563",
        }}
      >
        {/* Left: Copyright */}
        <div>
          © {year}{" "}
          <span style={{ fontWeight: 700, color: "#111827" }}>Nextooly</span>.
          All rights reserved.
        </div>

        {/* Center: AGPL Disclosure (Crucial for Compliance) */}
        <div style={{ textAlign: 'center', fontSize: '13px' }}>
            <span>Powered by </span>
            <a href="https://mupdf.com" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: '#4b5563' }}>
                MuPDF
            </a>
            <span style={{ margin: '0 4px' }}>•</span>
            <a 
                href="https://github.com/YOUR_GITHUB_USERNAME/nextooly-pdf-compressor" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: '#2563eb', fontWeight: 500, textDecoration: 'none' }}
            >
                Source Code
            </a>
        </div>

        {/* Right: Links */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <a href={`${MAIN_SITE}/privacy`} style={{ textDecoration: "none", color: "#4b5563" }}>
            Privacy Policy
          </a>
          <a href={`${MAIN_SITE}/terms`} style={{ textDecoration: "none", color: "#4b5563" }}>
            Terms of Use
          </a>
          <a href={`${MAIN_SITE}/contact`} style={{ textDecoration: "none", color: "#4b5563" }}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}