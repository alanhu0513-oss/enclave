export const gradients = {
  // Backgrounds — solid, not gradient-heavy
  bgPrimary: "bg-surface-0",
  bgCard: "bg-white/[0.03]",
  bgCardHover: "hover:bg-white/[0.05]",
  bgAccent: "bg-cyan/10",
  bgDanger: "bg-red/10",
  bgSuccess: "bg-green/10",
  bgWarning: "bg-amber/10",

  // Borders — subtle
  borderDefault: "border-white/[0.06]",
  borderHover: "hover:border-white/[0.12]",
  borderAccent: "border-cyan/20",
  borderDanger: "border-red/20",

  // Text
  textPrimary: "text-ink",
  textSecondary: "text-ink-muted",
  textMuted: "text-ink-faint",
  textAccent: "text-cyan",

  // Shadows — subtle, not glowy
  shadowCard: "shadow-[0_1px_3px_rgba(0,0,0,0.2)]",
  shadowGlow: "shadow-[0_2px_8px_rgba(103,232,249,0.08)]",
} as const;
