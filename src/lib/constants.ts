const raw = import.meta.env.VITE_API_URL ?? "";
export const API_URL = import.meta.env.DEV ? "http://localhost:3001" : raw.replace(/\/$/, "");

export const ADMIN_PANELS = ["dashboard", "data", "export", "shops", "ipstats", "system", "accounts", "logs"];
