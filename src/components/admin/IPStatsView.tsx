import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Globe, AlertTriangle, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.DEV ? "http://localhost:3001" : (import.meta.env.VITE_API_URL ?? "");

interface IpStats {
  today: { total: number; blocked: number; rate: string };
  week: { total: number; blocked: number; rate: string };
  month: { total: number; blocked: number; rate: string };
  threatDistribution: Record<string, number>;
  countryDistribution: Record<string, number>;
}

interface IpLogRow {
  id: number;
  ip: string;
  domain: string;
  is_proxy: number;
  is_vpn: number;
  is_tor: number;
  is_datacenter: number;
  is_bot: number;
  threat_level: string | null;
  country: string | null;
  device_type: string | null;
  action_taken: string;
  checked_at: string;
}

export const IPStatsView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const { t } = useAdminLocale();
  const [stats, setStats] = useState<IpStats | null>(null);
  const [logs, setLogs] = useState<IpLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const headers = getAuthHeaders();
    try {
      const [resStats, resLogs] = await Promise.all([
        fetch(`${API_URL}/api/admin/ip-stats`, { headers }),
        fetch(`${API_URL}/api/admin/ip-logs?limit=50`, { headers }),
      ]);
      if (resStats.status === 401 || resLogs.status === 401) { clearAuth(); return; }
      const statsData = await resStats.json();
      const logsData = await resLogs.json();
      setStats(statsData);
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err) {
      console.error("Failed to load IP stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const blockedLogs = logs.filter((r) => r.action_taken !== "allow");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("ipstats.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("ipstats.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("ipstats.refresh")}
        </Button>
      </div>

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("ipstats.today")}</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.today.total}</div>
                <p className="text-xs text-muted-foreground">
                  {t("ipstats.totalChecks")} · {t("ipstats.blocked")} {stats.today.blocked}（{stats.today.rate}%）
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("ipstats.week")}</CardTitle>
                <Shield className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.week.total}</div>
                <p className="text-xs text-muted-foreground">
                  {t("ipstats.totalChecks")} · {t("ipstats.blocked")} {stats.week.blocked}（{stats.week.rate}%）
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("ipstats.month")}</CardTitle>
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.month.total}</div>
                <p className="text-xs text-muted-foreground">
                  {t("ipstats.totalChecks")} · {t("ipstats.blocked")} {stats.month.blocked}（{stats.month.rate}%）
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("ipstats.threatDist")}</CardTitle>
                <CardDescription>{t("ipstats.threatDistDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.threatDistribution || {}).map(([k, v]) => (
                    <Badge key={k} variant={k === "allow" ? "secondary" : "destructive"}>
                      {k}: {v}
                    </Badge>
                  ))}
                  {Object.keys(stats.threatDistribution || {}).length === 0 && (
                    <span className="text-muted-foreground text-sm">{t("ipstats.noData")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4" /> {t("ipstats.countrySource")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {Object.entries(stats.countryDistribution || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20)
                    .map(([code, count]) => (
                      <Badge key={code} variant="outline">
                        {code}: {count}
                      </Badge>
                    ))}
                  {Object.keys(stats.countryDistribution || {}).length === 0 && (
                    <span className="text-muted-foreground text-sm">{t("ipstats.noData")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("ipstats.recentLogs")}</CardTitle>
          <CardDescription>{t("ipstats.recentLogsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>{t("ipstats.domain")}</TableHead>
                <TableHead>{t("ipstats.reason")}</TableHead>
                <TableHead>{t("data.country")}</TableHead>
                <TableHead>{t("ipstats.action")}</TableHead>
                <TableHead>{t("data.time")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t("ipstats.noBlockLogs")}
                  </TableCell>
                </TableRow>
              ) : (
                blockedLogs.slice(0, 30).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.ip}</TableCell>
                    <TableCell className="text-xs">{row.domain || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.is_proxy === 1 && <Badge variant="secondary">proxy</Badge>}
                        {row.is_vpn === 1 && <Badge variant="secondary">vpn</Badge>}
                        {row.is_tor === 1 && <Badge variant="secondary">tor</Badge>}
                        {row.is_bot === 1 && <Badge variant="secondary">bot</Badge>}
                        {row.threat_level && <Badge variant="destructive">{row.threat_level}</Badge>}
                        {!row.is_proxy && !row.is_vpn && !row.is_tor && !row.is_bot && !row.threat_level && "—"}
                      </div>
                    </TableCell>
                    <TableCell>{row.country || "—"}</TableCell>
                    <TableCell>{row.action_taken}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.checked_at}</TableCell>
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
