import { lazy, Suspense, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ADMIN_PATH } from "@/App";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import { API_URL } from "@/lib/constants";

const DashboardView = lazy(() =>
  import("@/components/admin/DashboardView").then((module) => ({ default: module.DashboardView }))
);
const DataListView = lazy(() =>
  import("@/components/admin/DataListView").then((module) => ({ default: module.DataListView }))
);
const DataExportView = lazy(() =>
  import("@/components/admin/DataExportView").then((module) => ({ default: module.DataExportView }))
);
const ShopManagementView = lazy(() =>
  import("@/components/admin/ShopManagementView").then((module) => ({ default: module.ShopManagementView }))
);
const ShopDesignView = lazy(() =>
  import("@/components/admin/ShopDesignView").then((module) => ({ default: module.ShopDesignView }))
);
const SystemSettingsView = lazy(() =>
  import("@/components/admin/SystemSettingsView").then((module) => ({ default: module.SystemSettingsView }))
);
const IPStatsView = lazy(() =>
  import("@/components/admin/IPStatsView").then((module) => ({ default: module.IPStatsView }))
);
const AccountManagementView = lazy(() =>
  import("@/components/admin/AccountManagementView").then((module) => ({ default: module.AccountManagementView }))
);
const LogsView = lazy(() =>
  import("@/components/admin/LogsView").then((module) => ({ default: module.LogsView }))
);

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
    } catch (error) {
      console.warn("Admin logout request failed", error);
    }
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

  const viewLoading = (
    <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
      Loading panel...
    </div>
  );

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
        <Suspense fallback={viewLoading}>{renderView()}</Suspense>
      </main>
    </div>
  );
};

export default AdminDashboard;
