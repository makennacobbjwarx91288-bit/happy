import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/constants";

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
  layout_config?: unknown;
  layout_config_v2?: unknown;
  theme_draft_v2?: unknown;
  layout_schema_version?: number;
  theme_editor_v2_enabled?: number | boolean;
}

interface ShopContextType {
  config: ShopConfig | null;
  loading: boolean;
  error: string | null;
  blocked: boolean;
  blockedAction: string | null;
  refreshConfig: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

function parseJsonFields(data: Record<string, unknown>) {
  const jsonFields = ["layout_config", "layout_config_v2", "theme_draft_v2"] as const;
  for (const field of jsonFields) {
    if (data[field] && typeof data[field] === "string") {
      try {
        data[field] = JSON.parse(data[field] as string);
      } catch {
        data[field] = field === "layout_config" ? {} : null;
      }
    }
  }
}

export const ShopProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedAction, setBlockedAction] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isAdminRef = useRef(false);

  const fetchConfig = useCallback((isRefresh = false) => {
    if (isAdminRef.current) return;
    if (!isRefresh) setLoading(true);

    const apiUrl = API_URL + "/api/config";
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
        parseJsonFields(data);
        setConfig(data);
        setLoading(false);
        if (data.name) document.title = data.name;
        if (data.theme_color) {
          document.documentElement.style.setProperty("--primary", data.theme_color);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!isRefresh) {
          setError(err.message);
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    const path = (typeof window !== "undefined" ? window.location.pathname : "") || "";
    const pathNorm = path.replace(/\/+$/, "") || "/";
    const isAdminPath = pathNorm === adminPathNorm || pathNorm.startsWith(adminPathNorm + "/");
    if (isAdminPath) {
      isAdminRef.current = true;
      setError(null);
      setLoading(false);
      return;
    }

    // Initial config load
    fetchConfig();

    // Listen for real-time theme updates via WebSocket
    const socket = io(API_URL, { autoConnect: true, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("theme_updated", () => {
      // Admin published or toggled theme — reload config
      fetchConfig(true);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [fetchConfig]);

  const refreshConfig = useCallback(() => {
    fetchConfig(true);
  }, [fetchConfig]);

  return (
    <ShopContext.Provider value={{ config, loading, error, blocked, blockedAction, refreshConfig }}>
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
