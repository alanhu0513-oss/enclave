interface SEOConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
}

const DEFAULTS: SEOConfig = {
  title: "Enclave — Deepfake Detection & Identity Protection",
  description:
    "AI-powered deepfake detection, identity monitoring, and takedown services. Protect your face, voice, and digital identity.",
  image: "/og-image.png",
  url: "https://enclave-react.vercel.app",
  type: "website",
};

const PAGE_SEO: Record<string, SEOConfig> = {
  "/": {
    title: "Enclave — Deepfake Detection & Identity Protection",
    description:
      "AI-powered deepfake detection, identity monitoring, and takedown services. Protect your face, voice, and digital identity.",
  },
  "/terms": {
    title: "Terms of Service — Enclave",
    description:
      "Enclave Terms of Service. Read our terms and conditions for using our deepfake detection and identity protection platform.",
  },
  "/privacy": {
    title: "Privacy Policy — Enclave",
    description:
      "Enclave Privacy Policy. Learn how we collect, use, and protect your personal data and biometric information.",
  },
  "/dmca": {
    title: "DMCA Policy — Enclave",
    description:
      "Enclave DMCA Policy. Report copyright infringement and request takedowns for unauthorized use of your identity.",
  },
};

export function updateSEO(path: string) {
  const config = { ...DEFAULTS, ...PAGE_SEO[path] };

  document.title = config.title;

  setMeta("description", config.description);
  setMeta("og:title", config.title);
  setMeta("og:description", config.description);
  setMeta("og:image", config.image || "/og-image.png");
  setMeta("og:url", (config.url || "https://enclave-react.vercel.app") + path);
  setMeta("og:type", config.type || "website");
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", config.title);
  setMeta("twitter:description", config.description);
  setMeta("twitter:image", config.image || "/og-image.png");
}

function setMeta(name: string, content: string) {
  let el = document.querySelector(
    `meta[property="${name}"], meta[name="${name}"]`
  ) as HTMLMetaElement;
  if (!el) {
    el = document.createElement("meta");
    if (name.startsWith("og:")) {
      el.setAttribute("property", name);
    } else {
      el.setAttribute("name", name);
    }
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
