import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

const STORAGE_KEY = "admin_locale";

type Locale = "zh" | "en";

const ADMIN_STRINGS: Record<string, { zh: string; en: string }> = {
  "sidebar.dashboard": { zh: "工作台", en: "Dashboard" },
  "sidebar.data": { zh: "数据列表", en: "Data List" },
  "sidebar.export": { zh: "数据导出", en: "Data Export" },
  "sidebar.shops": { zh: "店铺管理", en: "Shop Management" },
  "sidebar.ipstats": { zh: "IP 访客统计", en: "IP Stats" },
  "sidebar.system": { zh: "系统设置", en: "System Settings" },
  "sidebar.accounts": { zh: "账号管理", en: "Account Management" },
  "sidebar.logs": { zh: "日志与错误", en: "Logs & Errors" },
  "sidebar.logout": { zh: "退出登录", en: "Logout" },
  "sidebar.language": { zh: "界面语言", en: "Language" },
  "sidebar.lang_zh": { zh: "中文", en: "中文" },
  "sidebar.lang_en": { zh: "English", en: "English" },
  "shops.createTitle": { zh: "创建新店铺", en: "Create New Shop" },
  "shops.createDesc": { zh: "选择店铺源码类型，再填写名称与主域名", en: "Select template, then name and primary domain" },
  "shops.sourceLabel": { zh: "源码选择", en: "Template" },
  "shops.sourceHint": { zh: "不同源码对应不同页面与商品，下单审核流程一致。", en: "Different templates use different pages and products; order flow is the same." },
  "shops.shopName": { zh: "店铺名称", en: "Shop Name" },
  "shops.primaryDomain": { zh: "主域名", en: "Primary Domain" },
  "shops.domainHint": { zh: "主域名，后续可在本店铺下添加更多域名。", en: "Primary domain; you can add more later." },
  "shops.newShop": { zh: "新建店铺", en: "New Shop" },
  "shops.createBtn": { zh: "创建店铺", en: "Create Shop" },
  "shops.cancel": { zh: "取消", en: "Cancel" },
  "shops.noShops": { zh: "暂无店铺，点击「新建店铺」添加。", en: "No shops yet. Click \"New Shop\" to add one." },
  "shops.boundDomains": { zh: "绑定域名", en: "Bound Domains" },
  "shops.primary": { zh: "主域名", en: "Primary" },
};

interface AdminLocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const AdminLocaleContext = createContext<AdminLocaleContextType | undefined>(undefined);

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "zh";
}

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const pair = ADMIN_STRINGS[key];
      if (!pair) return key;
      return pair[locale];
    },
    [locale]
  );

  return (
    <AdminLocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </AdminLocaleContext.Provider>
  );
}

export function useAdminLocale() {
  const ctx = useContext(AdminLocaleContext);
  if (ctx === undefined) throw new Error("useAdminLocale must be used within AdminLocaleProvider");
  return ctx;
}
