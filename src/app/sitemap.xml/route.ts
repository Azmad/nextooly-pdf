import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = "https://pdf.nextooly.com";
  const now = new Date().toISOString();

  const urls = [
    {
      loc: `${baseUrl}/`,
      changefreq: "weekly",
      priority: "1.0",
    },
    {
      loc: `${baseUrl}/compress`,
      changefreq: "weekly",
      priority: "0.9",
    },
    {
      loc: `${baseUrl}/protect-pdf`,
      changefreq: "weekly",
      priority: "0.8",
    },
    {
      loc: `${baseUrl}/unlock-pdf`,
      changefreq: "weekly",
      priority: "0.8",
    },
    {
      loc: `${baseUrl}/pdf-edit`,
      changefreq: "weekly",
      priority: "0.8",
    },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `
  <url>
    <loc>${u.loc}</loc>
    
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
