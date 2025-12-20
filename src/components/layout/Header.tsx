"use client";

import React from 'react';
import Image from "next/image";

const MAIN_SITE = "https://nextooly.com";

const NAV_ITEMS = [
  { label: "Home", href: `${MAIN_SITE}/` },
  { label: "Categories", href: `${MAIN_SITE}/?tab=categories#categories` },
  { label: "About", href: `${MAIN_SITE}/about` },
  { label: "Contact", href: `${MAIN_SITE}/contact` },
];

export default function Header() {
  return (
    <header
      style={{
        width: "100%",
        borderBottom: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width : "100%",
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {/* Logo + Brand */}
        <a
          href={MAIN_SITE}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px", 
            textDecoration: "none",
          }}
        >
          <div style={{ position: 'relative', width: 40, height: 40 }}>
             <Image
              src="/main-logo.png"
              alt="Nextooly Logo"
              width={120}
              height={40}
              // style={{ objectFit: "contain" }}
              fetchPriority="high"
              priority
            />
          </div>
         
          {/* EXACT STYLES FROM image_7334a8.png */}
          <span
            style={{
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "0.03em",
              color: "#0f172a",
            }}
          >
            Nextooly
          </span>
        </a>

        {/* Navigation */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            fontSize: "15px",
            flexWrap: "wrap",
          }}
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              style={{
                textDecoration: "none",
                color: "#4b5563",
                fontWeight: 500,
                padding: "6px 0",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#111827"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#4b5563"}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}