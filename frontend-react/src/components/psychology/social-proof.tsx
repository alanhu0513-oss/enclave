import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CountUp } from "./count-up";

const CITIES = [
  "Tokyo", "London", "New York", "Berlin", "Sydney", "Seoul",
  "Toronto", "Paris", "Mumbai", "São Paulo", "Singapore",
  "Dubai", "Amsterdam", "Stockholm", "Hong Kong",
];

const ACTIONS = [
  "just blocked a deepfake attempt",
  "activated Camera Immunizer",
  "completed a deep scan",
  "reported a fake profile",
  "enabled Voice Shield",
  "generated a DMCA notice",
  "joined Enclave",
  "reached a 7-day streak",
];

interface Entry {
  id: number;
  city: string;
  action: string;
}

export function SocialProofFeed() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [online, setOnline] = useState(2847);
  const [blockedToday, setBlockedToday] = useState(1203);

  useEffect(() => {
    let idCounter = 0;
    const add = () => {
      idCounter += 1;
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
      const entry = { id: idCounter, city, action };
      setEntries((prev) => [entry, ...prev].slice(0, 5));
    };
    // Seed a few immediately, then keep flowing
    for (let i = 0; i < 3; i++) add();
    const interval = setInterval(add, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const jitter = () => {
      setOnline((2847 + Math.floor(Math.random() * 200 - 100)));
      setBlockedToday(1203 + Math.floor(Math.random() * 100));
    };
    const interval = setInterval(jitter, 15000);
    jitter();
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Live counters */}
        <div className="grid grid-cols-2 divide-x divide-white/[0.07] border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5 p-4">
            <Users className="h-4 w-4 text-cyan" />
            <div>
              <CountUp to={online} duration={900} className="font-display text-base font-bold text-ink" />
              <p className="text-[11px] text-ink-faint">Online now</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-4">
            <ShieldCheck className="h-4 w-4 text-green" />
            <div>
              <CountUp to={blockedToday} duration={900} className="font-display text-base font-bold text-ink" />
              <p className="text-[11px] text-ink-faint">Blocked today</p>
            </div>
          </div>
        </div>

        {/* Rotating feed */}
        <div className="flex flex-col gap-1 p-3">
          <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
            Live shield activity
          </p>
          <AnimatePresence initial={false}>
            {entries.map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-2.5 overflow-hidden rounded-lg px-1.5 py-1.5"
              >
                <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
                  <span className="absolute h-2 w-2 animate-ping rounded-full bg-green/40" />
                  <span className="h-2 w-2 rounded-full bg-green" />
                </span>
                <p className="text-xs leading-snug text-ink-muted">
                  Someone in <span className="font-medium text-ink">{e.city}</span> {e.action}
                  <span className="ml-1 text-[10px] text-ink-faint">just now</span>
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
