import React from 'react';

export type JsonLdFaqItem = {
  q: string;
  a: string;
};

type JsonLdSchemaProps = {
  name: string;
  description: string;
  url: string;
  featureList?: string[];
  faqItems?: JsonLdFaqItem[];
};

export default function JsonLdSchema({
  name,
  description,
  url,
  featureList = [],
  faqItems = [],
}: JsonLdSchemaProps) {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name,
      url,
      description,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser with WebAssembly support",
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      provider: {
        "@type": "Organization",
        name: "Nextooly",
        url: "https://nextooly.com",
      },
      ...(featureList.length > 0 ? { featureList } : {}),
    },
  ];

  if (faqItems.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    });
  }

  const schema = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
