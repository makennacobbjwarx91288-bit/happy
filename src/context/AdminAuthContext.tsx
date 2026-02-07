import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

const ADMIN_TOKEN_KEY = "beardbrand_admin_token";
const ADMIN_USER_KEY = "beardbrand_admin_user";

interface AdminUser {
  username: string;
  role: string;
  permissions: string[] | null;
}

interface AdminAuthContextType {
  token: string | null;
  user: AdminUser | null;
  setAuth: (token: string, user: AdminUser) => void;
  clearAuth: () => void;
  getAuthHeaders: () => Record<string, string>;
  hasPanel: (panel: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUserState] = useState<AdminUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setAuth = useCallback((t: string, u: AdminUser) => {
    setTokenState(t);
    setUserState(u);
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
      sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(u));
    } catch {}
  }, []);

  const clearAuth = useCallback(() => {
    setTokenState(null);
    setUserState(null);
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_USER_KEY);
    } catch {}
  }, []);

  const getAuthHeaders = useCallback(() => {
    const t = token || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ADMIN_TOKEN_KEY) : null);
    return t ? { Authorization: `Bearer ${t}`, "X-Admin-Token": t } : {};
  }, [token]);

  const hasPanel = useCallback(
    (panel: string) => {
      if (!user) return false;
      if (user.role === "main") return true;
      return Array.isArray(user.permissions) && user.permissions.includes(panel);
    },
    [user]
  );

  return (
    <AdminAuthContext.Provider value={{ token, user, setAuth, clearAuth, getAuthHeaders, hasPanel }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (ctx === undefined) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
