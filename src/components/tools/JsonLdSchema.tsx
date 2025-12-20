import React from 'react';

export default function JsonLdSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Nextooly PDF Compressor",
        "operatingSystem": "Web",
        "applicationCategory": "UtilitiesApplication",
        "url": "https://pdf.nextooly.com",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "ratingCount": "1250"
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://nextooly.com"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "File Conversion",
            "item": "https://nextooly.com/category/file-conversion"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "PDF Compressor",
            "item": "https://pdf.nextooly.com"
          }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}