/**
 * Background layer — minimal, not decorative.
 * Just enough depth to separate content from the void.
 */

export function HaikeiBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Very subtle warm gradient — top-left corner only */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 600px at 10% 0%, rgba(52,211,153,0.04), transparent 60%)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </div>
  );
}
