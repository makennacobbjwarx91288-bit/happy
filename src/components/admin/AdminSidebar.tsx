import { 
  LayoutDashboard, 
  Database, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Store,
  BarChart3,
  UserCog,
  FileText,
  Languages
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminLocale } from "@/context/AdminLocaleContext";

interface AdminSidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  hasPanel: (panel: string) => boolean;
}

export const AdminSidebar = ({ 
  currentView, 
  onChangeView, 
  onLogout, 
  collapsed, 
  setCollapsed,
  hasPanel 
}: AdminSidebarProps) => {
  const { locale, setLocale, t } = useAdminLocale();
  const menuItems = [
    { id: "dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard, panel: "dashboard" as const },
    { id: "data", labelKey: "sidebar.data", icon: Database, panel: "data" as const },
    { id: "export", labelKey: "sidebar.export", icon: Download, panel: "export" as const },
    { id: "shops", labelKey: "sidebar.shops", icon: Store, panel: "shops" as const },
    { id: "ipstats", labelKey: "sidebar.ipstats", icon: BarChart3, panel: "ipstats" as const },
    { id: "system", labelKey: "sidebar.system", icon: Settings, panel: "system" as const },
    { id: "accounts", labelKey: "sidebar.accounts", icon: UserCog, panel: "accounts" as const },
    { id: "logs", labelKey: "sidebar.logs", icon: FileText, panel: "logs" as const },
  ].filter((item) => hasPanel(item.panel));

  return (
    <div 
      className={cn(
        "h-screen bg-[#1a1b1e] text-gray-300 transition-all duration-300 flex flex-col border-r border-gray-800",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header / Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
        {!collapsed && <span className="font-bold text-white tracking-wider">ADMIN</span>}
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Menu */}
      <div className="flex-1 py-4 overflow-y-auto">
        <nav className="space-y-1 px-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={cn(
                "w-full flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors",
                currentView === item.id 
                  ? "bg-primary text-primary-foreground" 
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <item.icon className={cn("h-5 w-5", collapsed ? "mx-auto" : "mr-3")} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Language: 仅管理端显示，不影响客户下单信息 */}
      <div className="px-4 py-2 border-t border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-2 mb-2">
            <Languages className="h-4 w-4 text-gray-500" />
            <span className="text-xs text-gray-500">{t("sidebar.language")}</span>
          </div>
        )}
        <div className={cn("flex gap-1", collapsed && "flex-col items-center")}>
          <button
            onClick={() => setLocale("zh")}
            className={cn(
              "flex items-center justify-center px-3 py-2 text-xs font-medium rounded-md transition-colors",
              locale === "zh" ? "bg-primary text-primary-foreground" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
            title="中文"
          >
            {collapsed ? "中" : t("sidebar.lang_zh")}
          </button>
          <button
            onClick={() => setLocale("en")}
            className={cn(
              "flex items-center justify-center px-3 py-2 text-xs font-medium rounded-md transition-colors",
              locale === "en" ? "bg-primary text-primary-foreground" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
            title="English"
          >
            {collapsed ? "EN" : t("sidebar.lang_en")}
          </button>
        </div>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center px-3 py-3 text-sm font-medium text-red-400 rounded-md hover:bg-red-950/30 transition-colors",
            collapsed && "justify-center"
          )}
          title={t("sidebar.logout")}
        >
          <LogOut className={cn("h-5 w-5", collapsed ? "mx-auto" : "mr-3")} />
          {!collapsed && <span>{t("sidebar.logout")}</span>}
        </button>
      </div>
    </div>
  );
};
