import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// 后台路径识别：兼容 __ADMIN_PATH__（构建注入）+ VITE_ADMIN_PATH + 默认值，不依赖单一来源
declare const __ADMIN_PATH__: string | undefined;
const RAW_ADMIN =
  (typeof __ADMIN_PATH__ !== "undefined" && __ADMIN_PATH__) ||
  (import.meta.env?.VITE_ADMIN_PATH as string | undefined) ||
  "/manage-admin";
const adminPathNorm = ("/" + String(RAW_ADMIN).replace(/^\/|\/$/g, "")).replace(/\/+/g, "/") || "/manage-admin";

export interface ShopConfig {
  id: number;
  domain: string;
  name: string;
  logo_url: string;
  theme_color: string;
}

interface ShopContextType {
  config: ShopConfig | null;
  loading: boolean;
  error: string | null;
  blocked: boolean;
  blockedAction: string | null;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedAction, setBlockedAction] = useState<string | null>(null);

  useEffect(() => {
    const path = (typeof window !== "undefined" ? window.location.pathname : "") || "";
    const pathNorm = path.replace(/\/+$/, "") || "/";
    const isAdminPath = pathNorm === adminPathNorm || pathNorm.startsWith(adminPathNorm + "/");
    if (isAdminPath) {
      setError(null);
      setLoading(false);
      return;
    }

    const base = import.meta.env.DEV ? "http://localhost:3001" : (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
    const apiUrl = base + "/api/config";

    fetch(apiUrl)
      .then((res) => {
        if (res.status === 403) {
          return res.json().then((data: { reason?: string; action?: string }) => {
            if (data.reason === "ip_policy") {
              setBlocked(true);
              setBlockedAction(data.action || "captcha");
              setLoading(false);
              return null;
            }
            setError("Access denied");
            setLoading(false);
            return null;
          });
        }
        if (!res.ok) throw new Error("Failed to load shop config");
        return res.json();
      })
      .then((data) => {
        if (data == null) return;
        setConfig(data);
        setLoading(false);
        if (data.name) document.title = data.name;
        if (data.theme_color) {
          document.documentElement.style.setProperty("--primary", data.theme_color);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <ShopContext.Provider value={{ config, loading, error, blocked, blockedAction }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
};
