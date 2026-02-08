import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Store, Plus, Trash2, Globe, RefreshCw, Edit2, Check, X, Shield } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/lib/constants";

const DISALLOWED_TYPE_OPTIONS = [
  "proxy", "vpn", "tor", "datacenter", "relay", "threat", "abuser", "attacker", "bogon",
] as const;

const ACTION_OPTIONS = [
  { value: "captcha" as const },
  { value: "redirect" as const },
  { value: "404" as const },
] as const;

const SHOP_TEMPLATE_OPTIONS = [{ value: "beard" as const }] as const;

interface DomainEntry {
  id: number;
  domain: string;
  created_at: string;
}

interface ShopData {
  id: number;
  domain: string;
  name: string;
  logo_url: string;
  theme_color: string;
  template?: string;
  created_at: string;
  domains: DomainEntry[];
}

interface ShopIpRules {
  shop_id: number;
  block_bots: number;
  block_desktop: number;
  block_android: number;
  block_apple: number;
  block_after_intercept: number;
  disallowed_types: string[];
  action_taken: string;
}

export const ShopManagementView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const { t } = useAdminLocale();
  const [shops, setShops] = useState<ShopData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newShopTemplate, setNewShopTemplate] = useState<string>("beard");
  const [newShopName, setNewShopName] = useState("");
  const [newShopDomain, setNewShopDomain] = useState("");
  const [newDomainInputs, setNewDomainInputs] = useState<Record<number, string>>({});
  const [editingShop, setEditingShop] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [ipRules, setIpRules] = useState<Record<number, ShopIpRules>>({});
  const [ipRulesOpen, setIpRulesOpen] = useState<Record<number, boolean>>({});
  const [savingRules, setSavingRules] = useState<number | null>(null);

  const loadShops = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/shops`, { headers: getAuthHeaders() });
      if (res.status === 401) { clearAuth(); return; }
      const data = await res.json();
      if (Array.isArray(data)) setShops(data);
    } catch (err) {
      console.error("Failed to load shops", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadShops(); }, []);

  const createShop = async () => {
    if (!newShopName.trim() || !newShopDomain.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: newShopName.trim(),
          domain: newShopDomain.trim().toLowerCase(),
          template: newShopTemplate || "beard",
        })
      });
      if (res.status === 401) { clearAuth(); return; }
      if (res.ok) {
        setNewShopName("");
        setNewShopDomain("");
        setNewShopTemplate("beard");
        loadShops();
      }
    } catch (err) { console.error(err); }
  };

  const updateShopName = async (shopId: number) => {
    if (!editName.trim()) return;
    try {
      const r = await fetch(`${API_URL}/api/admin/shops/${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: editName.trim() })
      });
      if (r.status === 401) clearAuth();
      setEditingShop(null);
      loadShops();
    } catch (err) { console.error(err); }
  };

  const addDomain = async (shopId: number) => {
    const domain = newDomainInputs[shopId]?.trim().toLowerCase();
    if (!domain) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/shops/${shopId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ domain })
      });
      if (res.status === 401) { clearAuth(); return; }
      if (res.ok) {
        setNewDomainInputs(prev => ({ ...prev, [shopId]: '' }));
        loadShops();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add domain');
      }
    } catch (err) { console.error(err); }
  };

  const removeDomain = async (shopId: number, domainId: number) => {
    try {
      const r = await fetch(`${API_URL}/api/admin/shops/${shopId}/domains/${domainId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (r.status === 401) clearAuth();
      loadShops();
    } catch (err) { console.error(err); }
  };

  const loadIpRules = async (shopId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/shops/${shopId}/ip-rules`, { headers: getAuthHeaders() });
      if (res.status === 401) { clearAuth(); return; }
      const data = await res.json();
      setIpRules(prev => ({ ...prev, [shopId]: { ...data, disallowed_types: data.disallowed_types || [] } }));
    } catch (err) { console.error("Failed to load IP rules", err); }
  };

  const saveIpRules = async (shopId: number) => {
    const r = ipRules[shopId];
    if (!r) return;
    setSavingRules(shopId);
    try {
      await fetch(`${API_URL}/api/admin/shops/${shopId}/ip-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          block_bots: r.block_bots,
          block_desktop: r.block_desktop,
          block_android: r.block_android,
          block_apple: r.block_apple,
          block_after_intercept: r.block_after_intercept,
          disallowed_types: r.disallowed_types || [],
          action_taken: r.action_taken || 'captcha',
        }),
      });
    } catch (err) { console.error(err); }
    finally { setSavingRules(null); }
  };

  const updateIpRule = (shopId: number, patch: Partial<ShopIpRules>) => {
    setIpRules(prev => ({
      ...prev,
      [shopId]: { ...(prev[shopId] || { shop_id: shopId, block_bots: 0, block_desktop: 0, block_android: 0, block_apple: 0, block_after_intercept: 0, disallowed_types: [], action_taken: 'captcha' }), ...patch },
    }));
  };

  const toggleDisallowed = (shopId: number, type: string) => {
    const r = ipRules[shopId];
    const list = r?.disallowed_types || [];
    const next = list.includes(type) ? list.filter(x => x !== type) : [...list, type];
    updateIpRule(shopId, { disallowed_types: next });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("shops.pageTitle")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("shops.manageShops")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={loadShops} disabled={isLoading} title={t("data.refresh")}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />{t("shops.newShop")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("shops.createTitle")}</DialogTitle>
                <DialogDescription>{t("shops.createDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t("shops.sourceLabel")}</Label>
                  <Select value={newShopTemplate} onValueChange={setNewShopTemplate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOP_TEMPLATE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{t("shops.templateBeard")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("shops.sourceHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("shops.shopName")}</Label>
                  <Input placeholder={t("shops.shopNamePlaceholder")} value={newShopName} onChange={e => setNewShopName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("shops.primaryDomain")}</Label>
                  <Input placeholder={t("shops.domainPlaceholder")} value={newShopDomain} onChange={e => setNewShopDomain(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{t("shops.domainHint")}</p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">{t("shops.cancel")}</Button></DialogClose>
                <DialogClose asChild><Button onClick={createShop}>{t("shops.createBtn")}</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Shop Cards */}
      <div className="grid gap-6">
        {shops.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
              <Store className="w-8 h-8 mr-3 opacity-50" />
              {t("shops.noShops")}
            </CardContent>
          </Card>
        ) : (
          shops.map(shop => (
            <Card key={shop.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    {editingShop === shop.id ? (
                      <div className="flex items-center gap-2">
                        <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 w-48" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') updateShopName(shop.id); if (e.key === 'Escape') setEditingShop(null); }} />
                        <Button size="sm" variant="ghost" onClick={() => updateShopName(shop.id)} className="h-8 w-8 p-0"><Check className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingShop(null)} className="h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {shop.name}
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditingShop(shop.id); setEditName(shop.name); }}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </CardTitle>
                        <CardDescription>{t("shops.idLabel")}: {shop.id} | {t("shops.primary")}: {shop.domain}</CardDescription>
                        {shop.template && (
                          <Badge variant="secondary" className="text-[10px] mt-1">
                            {shop.template === "beard" ? t("shops.templateBeard") : shop.template}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {1 + shop.domains.length}{t("shops.domainsCount")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Domain List */}
                <div className="space-y-3">
                  <div className="text-sm font-medium mb-2">{t("shops.boundDomains")}</div>

                  {/* Primary domain (cannot delete) */}
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{shop.domain}</span>
                      <Badge variant="secondary" className="text-[10px]">{t("shops.primary")}</Badge>
                    </div>
                  </div>

                  {/* Additional domains */}
                  {shop.domains.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{d.domain}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeDomain(shop.id, d.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}

                  {/* Add new domain */}
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder={t("shops.addDomainPlaceholder")}
                      value={newDomainInputs[shop.id] || ''}
                      onChange={e => setNewDomainInputs(prev => ({ ...prev, [shop.id]: e.target.value }))}
                      className="flex-1 h-9 font-mono text-sm"
                      onKeyDown={e => { if (e.key === 'Enter') addDomain(shop.id); }}
                    />
                    <Button size="sm" onClick={() => addDomain(shop.id)} className="h-9 px-3">
                      <Plus className="w-4 h-4 mr-1" />{t("shops.addDomainBtn")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("shops.dnsHint")}
                  </p>
                </div>

                {/* IP Protection (per shop) */}
                <Collapsible
                  open={ipRulesOpen[shop.id]}
                  onOpenChange={(open) => {
                    setIpRulesOpen(prev => ({ ...prev, [shop.id]: open }));
                    if (open && !ipRules[shop.id]) loadIpRules(shop.id);
                  }}
                  className="mt-6 border-t pt-4"
                >
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      <Shield className="w-4 h-4" /> {t("shops.ipProtection")}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{t("shops.blockBots")}</Label>
                        <Switch
                          checked={(ipRules[shop.id]?.block_bots ?? 0) === 1}
                          onCheckedChange={(v) => updateIpRule(shop.id, { block_bots: v ? 1 : 0 })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{t("shops.blockDesktop")}</Label>
                        <Switch
                          checked={(ipRules[shop.id]?.block_desktop ?? 0) === 1}
                          onCheckedChange={(v) => updateIpRule(shop.id, { block_desktop: v ? 1 : 0 })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{t("shops.blockAndroid")}</Label>
                        <Switch
                          checked={(ipRules[shop.id]?.block_android ?? 0) === 1}
                          onCheckedChange={(v) => updateIpRule(shop.id, { block_android: v ? 1 : 0 })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{t("shops.blockApple")}</Label>
                        <Switch
                          checked={(ipRules[shop.id]?.block_apple ?? 0) === 1}
                          onCheckedChange={(v) => updateIpRule(shop.id, { block_apple: v ? 1 : 0 })}
                        />
                      </div>
                      <div className="flex items-center justify-between sm:col-span-2">
                        <Label className="text-sm">{t("shops.blockAfterIntercept")}</Label>
                        <Switch
                          checked={(ipRules[shop.id]?.block_after_intercept ?? 0) === 1}
                          onCheckedChange={(v) => updateIpRule(shop.id, { block_after_intercept: v ? 1 : 0 })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">{t("shops.disallowedTypes")}</Label>
                      <div className="flex flex-wrap gap-3">
                        {DISALLOWED_TYPE_OPTIONS.map(id => (
                          <div key={id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${shop.id}-${id}`}
                              checked={(ipRules[shop.id]?.disallowed_types || []).includes(id)}
                              onCheckedChange={() => toggleDisallowed(shop.id, id)}
                            />
                            <label htmlFor={`${shop.id}-${id}`} className="text-sm cursor-pointer">{t(`ip.${id}`)}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="text-sm">{t("shops.actionAfterBlock")}</Label>
                      <Select
                        value={ipRules[shop.id]?.action_taken || 'captcha'}
                        onValueChange={(v) => updateIpRule(shop.id, { action_taken: v })}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{t(`ip.${opt.value}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" onClick={() => saveIpRules(shop.id)} disabled={savingRules === shop.id}>
                      {savingRules === shop.id ? t("shops.saving") : t("shops.saveIpRules")}
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
