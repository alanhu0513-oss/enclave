import { useCallback, useEffect, useState } from "react";

const K_STREAK = "enclave_streak";
const K_STREAK_DATE = "enclave_streak_date";
const K_BADGES = "enclave_badges";
const K_SCANS = "enclave_scan_count";
const K_THREATS = "enclave_threats_blocked";
const K_TAKEDOWNS = "enclave_takedowns_done";
const K_CREATED = "enclave_created_at";

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: "first-scan", name: "First Scan", icon: "🔍", desc: "Run your first scan" },
  { id: "shield-1", name: "First Shield", icon: "🛡️", desc: "Activate 1 shield" },
  { id: "threat-blocked", name: "Threat Blocker", icon: "🚫", desc: "Block your first threat" },
  { id: "takedown-1", name: "First Takedown", icon: "⚖️", desc: "File a takedown request" },
  { id: "streak-3", name: "Three Day Run", icon: "🔥", desc: "Reach a 3-day streak" },
  { id: "streak-7", name: "Week Warrior", icon: "🏆", desc: "Reach a 7-day streak" },
  { id: "shield-5", name: "Full Fortress", icon: "🏰", desc: "Activate all 5 shields" },
  { id: "scanner-10", name: "Scan Master", icon: "🎯", desc: "Run 10 scans" },
];

export interface PsychologyState {
  streak: number;
  streakSub: string;
  threatsBlocked: number;
  scans: number;
  takedowns: number;
  createdAt: number;
  badges: Record<string, string>;
  unlockedIds: string[];
  recordScan: () => void;
  recordThreatBlocked: () => void;
  recordTakedown: () => void;
  checkBadges: (shieldsActive: number) => string[];
}

export function usePsychology(): PsychologyState {
  const [streak, setStreak] = useState(() => 1);
  const [streakSub, setStreakSub] = useState("Don't break it!");
  const [threatsBlocked, setThreatsBlocked] = useState(() => safeGet(K_THREATS, 0) as number);
  const [scans, setScans] = useState(() => safeGet(K_SCANS, 0) as number);
  const [takedowns, setTakedowns] = useState(() => safeGet(K_TAKEDOWNS, 0) as number);
  const [createdAt] = useState(() => {
    const c = safeGet(K_CREATED, "");
    if (c) return new Date(c).getTime();
    const now = Date.now();
    safeSet(K_CREATED, new Date(now).toISOString());
    return now;
  });
  const [badges, setBadges] = useState<Record<string, string>>(() =>
    safeGet(K_BADGES, {} as Record<string, string>)
  );

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = safeGet(K_STREAK_DATE, "");
    let next = safeGet(K_STREAK, 1) as number;
    if (lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastDate === yesterday) next += 1;
      else next = 1;
      safeSet(K_STREAK_DATE, today);
      safeSet(K_STREAK, next);
    }
    setStreak(next);
    if (next >= 7) setStreakSub("You're on fire!");
    else if (next >= 3) setStreakSub("Keep it going!");
    else setStreakSub("Don't break it!");
  }, []);

  const recordScan = useCallback(() => {
    setScans((s) => {
      const v = s + 1;
      safeSet(K_SCANS, v);
      return v;
    });
  }, []);

  const recordThreatBlocked = useCallback(() => {
    setThreatsBlocked((t) => {
      const v = t + 1;
      safeSet(K_THREATS, v);
      return v;
    });
  }, []);

  const recordTakedown = useCallback(() => {
    setTakedowns((t) => {
      const v = t + 1;
      safeSet(K_TAKEDOWNS, v);
      return v;
    });
  }, []);

  const checkBadges = useCallback(
    (shieldsActive: number): string[] => {
      const newly: string[] = [];
      const next = { ...badges };
      for (const def of BADGE_DEFS) {
        if (next[def.id]) continue;
        let earned = false;
        switch (def.id) {
          case "first-scan":
            earned = scans > 0;
            break;
          case "shield-1":
            earned = shieldsActive >= 1;
            break;
          case "threat-blocked":
            earned = threatsBlocked > 0;
            break;
          case "takedown-1":
            earned = takedowns > 0;
            break;
          case "streak-3":
            earned = streak >= 3;
            break;
          case "streak-7":
            earned = streak >= 7;
            break;
          case "shield-5":
            earned = shieldsActive >= 5;
            break;
          case "scanner-10":
            earned = scans >= 10;
            break;
        }
        if (earned) {
          next[def.id] = new Date().toISOString();
          newly.push(def.name);
        }
      }
      if (newly.length) {
        setBadges(next);
        safeSet(K_BADGES, next);
      }
      return newly;
    },
    [badges, scans, threatsBlocked, takedowns, streak]
  );

  return {
    streak,
    streakSub,
    threatsBlocked,
    scans,
    takedowns,
    createdAt,
    badges,
    unlockedIds: Object.keys(badges),
    recordScan,
    recordThreatBlocked,
    recordTakedown,
    checkBadges,
  };
}

export { safeGet, safeSet };
