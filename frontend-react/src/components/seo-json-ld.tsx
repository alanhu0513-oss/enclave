export function SeoJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Enclave",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    description:
      "AI-powered deepfake detection, identity monitoring, and takedown services",
    url: "https://enclave-react.vercel.app",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "49.99",
      priceCurrency: "USD",
    },
    featureList: [
      "Deepfake Detection",
      "Identity Monitoring",
      "Content Takedown",
      "Voice Clone Detection",
      "Dark Web Monitoring",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
