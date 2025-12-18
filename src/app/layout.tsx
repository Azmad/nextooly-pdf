import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compress PDF Online – Reduce PDF Size Free | Nextooly",
  description:
    "Compress PDF files online for free. Reduce PDF file size directly in your browser with no uploads. Fast, private, and secure PDF compression by Nextooly.",
  alternates: {
    canonical: "https://compress.nextooly.com/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Compress PDF Online – Reduce PDF Size Free",
    description:
      "Reduce PDF file size directly in your browser. No uploads. Fast, private, and secure PDF compression.",
    url: "https://compress.nextooly.com/",
    siteName: "Nextooly",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Compress PDF Online – Reduce PDF Size Free",
    description:
      "Compress PDF files online with no uploads. Fast, private, and secure.",
  },
};



export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
