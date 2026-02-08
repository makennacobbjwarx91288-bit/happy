import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import { FileText, RefreshCw } from "lucide-react";
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

interface LogRow {
  id: number;
  kind: string;
  ip: string | null;
  detail: string | null;
  created_at: string;
}

export const LogsView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const { t } = useAdminLocale();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/admin/logs?limit=200`, { headers: getAuthHeaders() })
      .then((r) => {
        if (r.status === 401) clearAuth();
        return r.json();
      })
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("logs.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("logs.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {t("logs.refresh")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {t("logs.securityLogs")}</CardTitle>
          <CardDescription>{t("logs.securityDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("logs.time")}</TableHead>
                <TableHead>{t("logs.kind")}</TableHead>
                <TableHead>{t("logs.ip")}</TableHead>
                <TableHead>{t("logs.detail")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">{t("logs.noLogs")}</TableCell>
                </TableRow>
              ) : (
                logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">{row.created_at}</TableCell>
                    <TableCell>{row.kind}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ip || "—"}</TableCell>
                    <TableCell className="text-xs max-w-md truncate">{row.detail || "—"}</TableCell>
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
