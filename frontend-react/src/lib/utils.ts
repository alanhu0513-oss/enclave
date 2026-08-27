import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(ts: number | string | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function timeAgo(ts: number | string | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function confidenceColor(conf: number): string {
  if (conf >= 80) return "#ff4757";
  if (conf >= 50) return "#ffb020";
  return "#00ff88";
}

export function confidenceLabel(conf: number): string {
  if (conf >= 80) return "Critical";
  if (conf >= 50) return "Elevated";
  if (conf >= 20) return "Watch";
  return "Safe";
}
