import { cn } from "@/lib/utils";

export function ShieldMark({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 52 52"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00ff88" />
          <stop offset="100%" stopColor="#00bfff" />
        </linearGradient>
      </defs>
      <path
        d="M26 3 L45 10 V26 C45 39 36 46 26 50 C16 46 7 39 7 26 V10 Z"
        fill="url(#shieldGrad)"
        opacity="0.12"
        stroke="url(#shieldGrad)"
        strokeWidth="2.4"
      />
      <path
        d="M26 8 L40 13.5 V26 C40 36 33.5 41.5 26 44.5 C18.5 41.5 12 36 12 26 V13.5 Z"
        fill="none"
        stroke="url(#shieldGrad)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M26 20 L26 32 M21 26 L31 26"
        stroke="#00ff88"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <ShieldMark size={compact ? 26 : 30} />
      {!compact && (
        <span className="font-display text-lg font-bold tracking-[0.28em] text-ink">
          ENCLAVE
        </span>
      )}
    </div>
  );
}
