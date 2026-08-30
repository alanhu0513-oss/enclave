import * as React from "react";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { api, setToken, clearToken, getToken } from "@/lib/api";
import {
  getStoredReferralCode,
  clearReferralCode,
} from "@/lib/referral";
import { track } from "@/lib/analytics";

interface AuthState {
  user: any | null;
  loading: boolean;
  locked: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  lock: () => void;
  unlock: (password: string) => Promise<void>;
  setUser: (u: any) => void;
  verifyPassword: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(() => {
    try {
      const raw = sessionStorage.getItem("enclave_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [locked, setLocked] = useState(() => sessionStorage.getItem("enclave_locked") === "1");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user || !getToken()) return;
    let active = true;
    api
      .getUserData()
      .then((d: any) => {
        if (!active) return;
        const u = { email: d?.user?.email || "User", ...(d?.user ?? {}) };
        setUser(u);
        sessionStorage.setItem("enclave_user", JSON.stringify(u));
      })
      .catch(() => {
        if (active) clearToken();
      });
    return () => {
      active = false;
    };
  }, [user]);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    setLoading(true);
    try {
      const data = (await api.login(email, password)) as any;
      if (data?.token) setToken(data.token, remember);
      const u = {
        email,
        ...(data.user ?? {}),
        fullName: data.fullName || data.user?.fullName || email.split("@")[0],
      };
      setUser(u);
      sessionStorage.setItem("enclave_user", JSON.stringify(u));
      sessionStorage.setItem("enclave_remember", remember ? "1" : "0");
      setLocked(false);
      sessionStorage.removeItem("enclave_locked");
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      setLoading(true);
      try {
        await api.register(email, password, fullName);
        await login(email, password);
        // Apply a referral attribution code captured from ?code=, if present.
        const code = getStoredReferralCode();
        if (code) {
          try {
            await api.applyReferral(code);
          } catch {
            /* best-effort attribution */
          } finally {
            clearReferralCode();
          }
        }
        track("signup");
      } finally {
        setLoading(false);
      }
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      // Server-side token revocation: invalidates any other sessions too.
      await api.logout();
    } catch {
      // Revocation best-effort; still clear the local session.
    }
    clearToken();
    setUser(null);
    setLocked(false);
    sessionStorage.removeItem("enclave_user");
    sessionStorage.removeItem("enclave_locked");
    sessionStorage.removeItem("enclave_remember");
  }, []);

  const lock = useCallback(() => {
    setLocked(true);
    sessionStorage.setItem("enclave_locked", "1");
  }, []);

  const unlock = useCallback(async (password: string) => {
    // Real security: require the account password before unlocking the vault.
    await api.verifyPassword(password);
    setLocked(false);
    sessionStorage.removeItem("enclave_locked");
  }, []);

  const verifyPassword = useCallback(async (password: string) => {
    try {
      await api.verifyPassword(password);
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, locked, login, register, logout, lock, unlock, setUser, verifyPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
