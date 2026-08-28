import { motion } from "motion/react";

/**
 * Haikei-style background layer system.
 * Layered, low-opacity organic blobs + fluid mesh gradients + contour waves.
 * Designed to sit behind content panels for depth without distraction.
 */

interface BlobProps {
  className?: string;
  gradientId: string;
  colors: [string, string];
  animate?: boolean;
}

function Blob({ className, gradientId, colors, animate = false }: BlobProps) {
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none ${className ?? ""}`}
      animate={animate ? { y: [0, -30, 0], x: [0, 20, 0] } : undefined}
      transition={
        animate
          ? { duration: 18, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      <svg viewBox="0 0 600 600" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${gradientId})`}
          d="M407.7,101.1C489.4,145.4,565.4,215.1,544.5,283.4C524.7,348.4,410.7,349.3,327.2,393.2C253.6,431.9,207.8,512.1,145.1,480.3C81.6,448.7,102.9,304.1,137.2,233.5C177.8,152.8,229.6,142.9,309.5,131.9C365.6,124,326.4,56.9,407.7,101.1Z"
        />
      </svg>
    </motion.div>
  );
}

function Wave() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 h-full w-full"
      viewBox="0 0 1200 1200"
      preserveAspectRatio="none"
    >
      <path
        fill="none"
        stroke="rgba(0,255,136,0.06)"
        strokeWidth="1"
        d="M0,200 C300,100 600,300 900,200 S1500,100 1800,200"
      />
      <path
        fill="none"
        stroke="rgba(0,191,255,0.05)"
        strokeWidth="1"
        d="M0,400 C300,300 600,500 900,400 S1500,300 1800,400"
      />
      <path
        fill="none"
        stroke="rgba(168,85,247,0.04)"
        strokeWidth="1"
        d="M0,600 C300,500 600,700 900,600 S1500,500 1800,600"
      />
    </svg>
  );
}

export function HaikeiBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Base fluid mesh via soft radial gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 700px at 10% 0%, rgba(0,255,136,0.09), transparent 55%)," +
            "radial-gradient(1000px 800px at 100% 10%, rgba(0,191,255,0.08), transparent 55%)," +
            "radial-gradient(900px 800px at 90% 100%, rgba(124,58,237,0.08), transparent 60%)," +
            "radial-gradient(700px 500px at 20% 100%, rgba(0,255,136,0.05), transparent 55%)",
        }}
      />

      {/* Organic blobs */}
      <div className="absolute left-[-10%] top-[15%] h-[42vw] w-[42vw] opacity-60">
        <Blob gradientId="blob-a" colors={["rgba(0,255,136,0.35)", "rgba(0,191,255,0.20)"]} animate />
      </div>
      <div className="absolute right-[-12%] top-[35%] h-[46vw] w-[46vw] opacity-50">
        <Blob gradientId="blob-b" colors={["rgba(124,58,237,0.30)", "rgba(0,191,255,0.22)"]} animate />
      </div>
      <div className="absolute bottom-[-15%] left-[25%] h-[44vw] w-[44vw] opacity-40">
        <Blob gradientId="blob-c" colors={["rgba(0,255,136,0.28)", "rgba(124,58,237,0.20)"]} />
      </div>

      {/* Contour waves */}
      <Wave />

      {/* Grain / vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}
