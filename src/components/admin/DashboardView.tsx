import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, ShoppingCart, DollarSign, Activity, CalendarIcon, ArrowUpRight, ArrowDownRight, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, startOfDay, endOfDay, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import { API_URL } from "@/lib/constants";

interface OrderData {
  id: string;
  created_at: string;
  total: number;
  status: string;
  customer: any;
}

export const DashboardView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const { t } = useAdminLocale();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [shopDomains, setShopDomains] = useState<{name: string; domain: string; domains: {domain: string}[]}[]>([]);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/orders`, { headers: getAuthHeaders() });
        if (res.status === 401) { clearAuth(); return; }
        const data = await res.json();
        if (Array.isArray(data)) setOrders(data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    };
    loadData();
    fetch(`${API_URL}/api/admin/shops`, { headers: getAuthHeaders() }).then(r => { if (r.status === 401) clearAuth(); return r.json(); }).then(data => {
      if (Array.isArray(data)) setShopDomains(data);
    }).catch(() => {});
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [getAuthHeaders, clearAuth]);

  // Filter orders based on selected date
  const filteredOrders = orders.filter(order => {
    if (!date) return true;
    const orderDate = new Date(order.created_at);
    return isSameDay(orderDate, date);
  });

  // Calculate Stats
  const totalRevenue = filteredOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(o => o.status === "COMPLETED").length;
  const activeOrders = filteredOrders.filter(o => o.status !== "COMPLETED" && o.status !== "REJECTED").length;
  
  // Calculate conversion rate
  const conversionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : "0";

  // Get Recent Activity (Top 5 from filtered)
  const recentActivity = [...filteredOrders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h2>
            <p className="text-muted-foreground text-sm">
                {date ? format(date, "PPP") : t("dashboard.allTime")} {t("dashboard.statsDate")}
            </p>
        </div>
        
        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm"
                onClick={() => setDate(new Date())}
                className={isSameDay(date || new Date(), new Date()) ? "bg-secondary" : ""}
            >
                {t("dashboard.today")}
            </Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        size="sm"
                        className={cn(
                        "justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>{t("dashboard.pickDate")}</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalRevenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard.generatedOn")} {date ? format(date, "MMM dd") : ""}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalOrders")}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
               {totalOrders > 0 ? (
                   <span className="text-green-500 flex items-center gap-1">
                       <ArrowUpRight className="w-3 h-3" /> {t("dashboard.active")}
                   </span>
               ) : (
                   <span>{t("dashboard.noOrdersYet")}</span>
               )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.successRate")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
                {completedOrders} / {totalOrders} {t("dashboard.completedTotal")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.livePending")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard.currentlyProcessing")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Overview */}
      {shopDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />{t("dashboard.frontendDomains")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {shopDomains.map((shop, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="font-medium text-sm">{shop.name}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                      <span className="font-mono text-xs truncate">{shop.domain}</span>
                      <Badge variant="secondary" className="text-[9px] h-4">{t("shops.primary")}</Badge>
                    </div>
                    {shop.domains?.map((d: any, j: number) => (
                      <div key={j} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                        <span className="font-mono text-xs truncate">{d.domain}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 lg:col-span-4">
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8 max-h-[300px] overflow-y-auto pr-2">
                {recentActivity.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">{t("dashboard.noActivity")}</div>
                ) : (
                    recentActivity.map((order, i) => (
                        <div key={i} className="flex items-center">
                            <div className="relative">
                                <span className={cn(
                                    "absolute -left-1 top-1 w-2 h-2 rounded-full",
                                    order.status === "COMPLETED" ? "bg-green-500" :
                                    order.status === "REJECTED" ? "bg-red-500" : "bg-blue-500 animate-pulse"
                                )}></span>
                                <div className="ml-4 space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {t("dashboard.orderLabel")} {order.id} - {order.customer.firstName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(order.created_at).toLocaleTimeString()} • {order.status}
                                    </p>
                                </div>
                            </div>
                            <div className="ml-auto font-medium text-sm">
                                +${order.total.toFixed(2)}
                            </div>
                        </div>
                    ))
                )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 lg:col-span-3">
            <CardHeader>
                <CardTitle>{t("dashboard.statusDist")}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> {t("dashboard.completed")}</span>
                        <span className="font-bold">{completedOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> {t("dashboard.processing")}</span>
                        <span className="font-bold">{activeOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> {t("dashboard.rejected")}</span>
                        <span className="font-bold">{filteredOrders.filter(o => o.status === "REJECTED").length}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};
