import * as React from "react";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { api, setToken, clearToken, getToken } from "@/lib/api";

interface AuthState {
  user: any | null;
  loading: boolean;
  locked: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  lock: () => void;
  unlock: () => void;
  setUser: (u: any) => void;
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

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = (await api.login(email, password)) as any;
      if (data?.token) setToken(data.token);
      const u = {
        email,
        ...(data.user ?? {}),
        fullName: data.fullName || data.user?.fullName || email.split("@")[0],
      };
      setUser(u);
      sessionStorage.setItem("enclave_user", JSON.stringify(u));
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
      } finally {
        setLoading(false);
      }
    },
    [login]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setLocked(false);
    sessionStorage.removeItem("enclave_user");
    sessionStorage.removeItem("enclave_locked");
  }, []);

  const lock = useCallback(() => {
    setLocked(true);
    sessionStorage.setItem("enclave_locked", "1");
  }, []);

  const unlock = useCallback(() => {
    setLocked(false);
    sessionStorage.removeItem("enclave_locked");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, locked, login, register, logout, lock, unlock, setUser }}
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
