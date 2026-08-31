export const gradients = {
  // Backgrounds
  bgPrimary: "bg-gradient-to-br from-[#0a0e17] via-[#0f1729] to-[#0a0e17]",
  bgCard: "bg-gradient-to-br from-white/[0.06] to-white/[0.02]",
  bgCardHover: "hover:from-white/[0.08] hover:to-white/[0.04]",
  bgAccent: "bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10",
  bgDanger: "bg-gradient-to-r from-red-500/10 to-rose-500/10",
  bgSuccess: "bg-gradient-to-r from-emerald-500/10 to-green-500/10",
  bgWarning: "bg-gradient-to-r from-amber-500/10 to-orange-500/10",

  // Borders
  borderDefault: "border-white/[0.08]",
  borderHover: "hover:border-white/[0.15]",
  borderAccent: "border-cyan-500/20",
  borderDanger: "border-red-500/20",

  // Text
  textPrimary: "text-white",
  textSecondary: "text-white/70",
  textMuted: "text-white/50",
  textAccent: "text-cyan-400",

  // Shadows
  shadowCard: "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)]",
  shadowGlow: "shadow-[0_0_20px_-4px_rgba(0,212,255,0.15)]",
} as const;
