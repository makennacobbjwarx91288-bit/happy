import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Settings, Key, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";

const API_URL = import.meta.env.DEV ? "http://localhost:3001" : (import.meta.env.VITE_API_URL ?? "");

interface SettingsData {
  ipregistry_api_key: string;
  ipregistry_quota_used: string | null;
  ipregistry_quota_remaining: string | null;
  api_provider: string;
}

export const SystemSettingsView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testIp, setTestIp] = useState("8.8.8.8");
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, { headers: getAuthHeaders() });
      if (res.status === 401) { clearAuth(); return; }
      const data = await res.json();
      setSettings(data);
      setApiKey(data.ipregistry_api_key || "");
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveApiKey = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const saveRes = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ipregistry_api_key: apiKey }),
      });
      if (saveRes.status === 401) clearAuth();
      await loadSettings();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings/test-ip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ip: testIp || "8.8.8.8", api_key: apiKey || undefined }),
      });
      if (res.status === 401) clearAuth();
      const data = await res.json();
      if (res.ok && data.ok) setTestResult({ ok: true });
      else setTestResult({ error: data.error || "Test failed" });
    } catch (err) {
      setTestResult({ error: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const used = settings?.ipregistry_quota_used != null ? parseInt(settings.ipregistry_quota_used, 10) : null;
  const remaining = settings?.ipregistry_quota_remaining != null ? parseInt(settings.ipregistry_quota_remaining, 10) : null;
  const total = (used != null && remaining != null) ? used + remaining : null;
  const pct = total && total > 0 && used != null ? Math.round((used / total) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">API keys and IP protection provider</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" /> IP API (ipregistry)
          </CardTitle>
          <CardDescription>
            Used for visitor IP risk checks. You can replace the backend module to use another provider later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Your ipregistry.co API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={saveApiKey} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
          {total != null && (
            <div className="space-y-2">
              <Label>Quota</Label>
              <div className="flex items-center gap-4 text-sm">
                <span>Used: {used ?? "—"}</span>
                <span>Remaining: {remaining ?? "—"}</span>
                <span className="text-muted-foreground">Total: {total}</span>
              </div>
              <Progress value={pct} className="h-2 max-w-xs" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Label className="w-full sm:w-auto">Test lookup</Label>
            <Input
              placeholder="8.8.8.8"
              value={testIp}
              onChange={(e) => setTestIp(e.target.value)}
              className="w-32 font-mono"
            />
            <Button variant="outline" size="sm" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
            </Button>
            {testResult?.ok && <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> OK</span>}
            {testResult?.error && <span className="text-destructive flex items-center gap-1"><XCircle className="w-4 h-4" /> {testResult.error}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> API 切换说明
          </CardTitle>
          <CardDescription>
            当前使用 ipregistry.co。若需更换为其他 IP 风控服务商，只需在服务端替换 <code className="text-xs bg-muted px-1 rounded">server/ipcheck.js</code> 模块，保持对外接口（lookup / testApiKey）一致即可。
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};
