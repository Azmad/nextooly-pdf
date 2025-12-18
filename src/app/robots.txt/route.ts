import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: https://compress.nextooly.com/sitemap.xml
`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
