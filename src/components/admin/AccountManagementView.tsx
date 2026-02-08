import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserCog, Plus, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { API_URL, ADMIN_PANELS } from "@/lib/constants";

interface AdminUser {
  id: number;
  username: string;
  role: string;
  permissions: string[] | null;
  created_at: string;
}

export const AccountManagementView = () => {
  const { getAuthHeaders, user } = useAdminAuth();
  const { t } = useAdminLocale();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPerms, setCreatePerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API_URL}/api/admin/accounts`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveMe = async () => {
    if (!editing || editing.username !== user?.username) return;
    setSaving(true);
    const body: { username?: string; newPassword?: string } = {};
    if (newUsername.trim()) body.username = newUsername.trim();
    if (newPassword.length >= 8) body.newPassword = newPassword;
    const res = await fetch(`${API_URL}/api/admin/accounts/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      setNewUsername("");
      setNewPassword("");
      load();
    }
  };

  const handleSaveSub = async (id: number) => {
    const u = users.find((x) => x.id === id);
    if (!u || u.role === "main") return;
    setSaving(true);
    const res = await fetch(`${API_URL}/api/admin/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ username: newUsername.trim() || u.username, newPassword: newPassword || undefined, permissions: newPerms }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      load();
    }
  };

  const handleCreate = async () => {
    if (!createUsername.trim() || createPassword.length < 8) return;
    setSaving(true);
    const res = await fetch(`${API_URL}/api/admin/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ username: createUsername.trim(), password: createPassword, permissions: createPerms }),
    });
    setSaving(false);
    if (res.ok) {
      setOpenCreate(false);
      setCreateUsername("");
      setCreatePassword("");
      setCreatePerms([]);
      load();
    }
  };

  const togglePerm = (list: string[], set: (v: string[]) => void, p: string) => {
    set(list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("accounts.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("accounts.subtitle")}</p>
        </div>
        {user?.role === "main" && (
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> {t("accounts.addAccount")}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="w-5 h-5" /> {t("accounts.accountsList")}</CardTitle>
          <CardDescription>{t("accounts.accountsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <span className="font-medium">{u.username}</span>
                <Badge className="ml-2" variant={u.role === "main" ? "default" : "secondary"}>{u.role === "main" ? t("accounts.mainAccount") : t("accounts.subAccount")}</Badge>
                {u.permissions && <span className="text-muted-foreground text-sm ml-2">({u.permissions.join(", ")})</span>}
              </div>
              {(user?.role === "main" || user?.username === u.username) && (
                <Button variant="outline" size="sm" onClick={() => { setEditing(u); setNewUsername(u.username); setNewPassword(""); setNewPerms(u.permissions || []); }}>
                  {t("accounts.edit")}
                </Button>
              )}
            </div>
          ))}

          {editing && (
            <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing.role === "main" ? t("accounts.editMain") : t("accounts.editSub")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t("accounts.username")}</Label>
                    <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder={t("accounts.username")} />
                  </div>
                  <div>
                    <Label>{t("accounts.newPassword")} ({t("accounts.newPasswordHint")})</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("accounts.minChars")} />
                  </div>
                  {editing.role === "sub" && user?.role === "main" && (
                    <div>
                      <Label>{t("accounts.panels")}</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ADMIN_PANELS.map((p) => (
                          <div key={p} className="flex items-center gap-2">
                            <Checkbox checked={newPerms.includes(p)} onCheckedChange={() => togglePerm(newPerms, setNewPerms, p)} />
                            <span className="text-sm">{(t as (k: string) => string)("sidebar." + p)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditing(null)}>{t("accounts.cancel")}</Button>
                  <Button disabled={saving} onClick={() => editing.role === "main" ? handleSaveMe() : handleSaveSub(editing.id)}>{t("accounts.save")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accounts.createSubTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("accounts.createSubDesc")}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("accounts.username")}</Label>
              <Input value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} placeholder={t("accounts.username")} />
            </div>
            <div>
              <Label>{t("accounts.password")}</Label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder={t("accounts.minChars")} />
            </div>
            <div>
              <Label>{t("accounts.panels")}</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ADMIN_PANELS.map((p) => (
                          <div key={p} className="flex items-center gap-2">
                    <Checkbox checked={createPerms.includes(p)} onCheckedChange={() => togglePerm(createPerms, setCreatePerms, p)} />
                    <span className="text-sm">{(t as (k: string) => string)("sidebar." + p)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>{t("accounts.cancel")}</Button>
            <Button disabled={saving || !createUsername.trim() || createPassword.length < 8} onClick={handleCreate}>{t("accounts.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
