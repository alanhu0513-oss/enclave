import { motion } from "motion/react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: typeof theme; icon: typeof Sun; label: string }[] = [
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "light", icon: Sun, label: "Light" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            className={cn(
              "relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              active ? "text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-lg bg-white/[0.08]"
                transition={{ duration: 0.2 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
