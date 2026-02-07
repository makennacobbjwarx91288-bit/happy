import { useState } from "react";
import { 
  LayoutDashboard, 
  Database, 
  Trash2, 
  Users, 
  Settings, 
  ShieldAlert,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Store,
  BarChart3,
  UserCog,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, panel: "dashboard" as const },
    { id: "data", label: "Data List", icon: Database, panel: "data" as const },
    { id: "export", label: "Data Export", icon: Download, panel: "data" as const },
    { id: "shops", label: "Shop Management", icon: Store, panel: "shops" as const },
    { id: "ipstats", label: "IP 访客统计", icon: BarChart3, panel: "ipstats" as const },
    { id: "system", label: "System Settings", icon: Settings, panel: "system" as const },
    { id: "accounts", label: "Account Management", icon: UserCog, panel: "accounts" as const },
    { id: "logs", label: "Logs & Errors", icon: FileText, panel: "logs" as const },
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
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-5 w-5", collapsed ? "mx-auto" : "mr-3")} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center px-3 py-3 text-sm font-medium text-red-400 rounded-md hover:bg-red-950/30 transition-colors",
            collapsed && "justify-center"
          )}
          title="Logout"
        >
          <LogOut className={cn("h-5 w-5", collapsed ? "mx-auto" : "mr-3")} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};
