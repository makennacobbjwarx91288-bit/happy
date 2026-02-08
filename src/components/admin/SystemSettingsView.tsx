import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Settings, Key, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import { API_URL } from "@/lib/constants";

interface SettingsData {
  ipregistry_api_key: string;
  ipregistry_quota_used: string | null;
  ipregistry_quota_remaining: string | null;
  api_provider: string;
}

export const SystemSettingsView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const { t } = useAdminLocale();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testIp, setTestIp] = useState("8.8.8.8");
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, { headers: getAuthHeaders() });
      if (res.status === 401) { clearAuth(); return; }
      const data = await res.json();
      setSettings(data);
      setApiKey(data.ipregistry_api_key || "");
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  }, [getAuthHeaders, clearAuth]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
      if (res.ok && data.ok) {
        setTestResult({ ok: true });
        loadSettings();
      } else {
        setTestResult({ error: data.error || "Test failed" });
      }
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
        <h2 className="text-2xl font-bold tracking-tight">{t("system.title")}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t("system.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" /> {t("system.apiSection")}
          </CardTitle>
          <CardDescription>
            {t("system.apiDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("system.apiKeyLabel")}</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={t("system.apiKeyPlaceholder")}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={saveApiKey} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("system.save")}
              </Button>
            </div>
          </div>
          {(used != null || remaining != null) && (
            <div className="space-y-2">
              <Label>{t("system.quotaLabel")}</Label>
              <div className="flex items-center gap-4 text-sm">
                {used != null && <span>{t("system.quotaUsed")}: {used}</span>}
                {remaining != null && <span>{t("system.quotaRemaining")}: {remaining}</span>}
                {total != null && <span className="text-muted-foreground">Total: {total}</span>}
              </div>
              {total != null && <Progress value={pct} className="h-2 max-w-xs" />}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Label className="w-full sm:w-auto">{t("system.testLookup")}</Label>
            <Input
              placeholder="8.8.8.8"
              value={testIp}
              onChange={(e) => setTestIp(e.target.value)}
              className="w-32 font-mono"
            />
            <Button variant="outline" size="sm" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : t("system.testApi")}
            </Button>
            {testResult?.ok && <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {t("system.testOk")}</span>}
            {testResult?.error && <span className="text-destructive flex items-center gap-1"><XCircle className="w-4 h-4" /> {testResult.error}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> {t("system.apiSwitchTitle")}
          </CardTitle>
          <CardDescription>
            {t("system.apiSwitchDesc")}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};
