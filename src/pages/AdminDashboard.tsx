import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { DashboardView } from "@/components/admin/DashboardView";
import { DataListView } from "@/components/admin/DataListView";
import { DataExportView } from "@/components/admin/DataExportView";
import { ShopManagementView } from "@/components/admin/ShopManagementView";
import { ShopDesignView } from "@/components/admin/ShopDesignView";
import { SystemSettingsView } from "@/components/admin/SystemSettingsView";
import { IPStatsView } from "@/components/admin/IPStatsView";
import { AccountManagementView } from "@/components/admin/AccountManagementView";
import { LogsView } from "@/components/admin/LogsView";
import { ADMIN_PATH } from "@/App";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import { API_URL } from "@/lib/constants";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { token, clearAuth, getAuthHeaders, user, hasPanel, setAuth } = useAdminAuth();
  const { t } = useAdminLocale();
  const [currentView, setCurrentView] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      if (!token) {
        navigate(ADMIN_PATH);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/admin/auth/me`, { headers: getAuthHeaders() });
        if (res.status === 401) {
          clearAuth();
          navigate(ADMIN_PATH);
          return;
        }
        if (!res.ok) throw new Error("Failed to verify admin session");

        const data = await res.json().catch(() => null);
        if (!active) return;

        if (!data || typeof data.username !== "string" || typeof data.role !== "string") {
          clearAuth();
          navigate(ADMIN_PATH);
          return;
        }

        setAuth(token, {
          username: data.username,
          role: data.role,
          permissions: Array.isArray(data.permissions) ? data.permissions : null,
        });
        setReady(true);
      } catch {
        if (!active) return;
        clearAuth();
        navigate(ADMIN_PATH);
      }
    };

    void verifySession();

    return () => {
      active = false;
    };
  }, [token, navigate, getAuthHeaders, clearAuth, setAuth]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/admin/auth/logout`, { method: "POST", headers: getAuthHeaders() });
    } catch {}
    clearAuth();
    navigate(ADMIN_PATH);
  };

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading admin...
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardView />;
      case "data":
        return <DataListView />;
      case "export":
        return <DataExportView />;
      case "shops":
        return <ShopManagementView />;
      case "design":
        return <ShopDesignView />;
      case "ipstats":
        return <IPStatsView />;
      case "system":
        return <SystemSettingsView />;
      case "accounts":
        return <AccountManagementView />;
      case "logs":
        return <LogsView />;
      default:
        return (
          <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
            {t("common.underConstruction")}
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AdminSidebar
        currentView={currentView}
        onChangeView={setCurrentView}
        onLogout={handleLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        hasPanel={hasPanel}
      />
      <main className="flex-1 p-8 overflow-y-auto h-screen">
        {renderView()}
      </main>
    </div>
  );
};

export default AdminDashboard;
