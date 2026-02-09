import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Save,
  Upload,
  RotateCcw,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Sparkles,
  Undo2,
  Redo2,
  Monitor,
  Smartphone,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { API_URL } from "@/lib/constants";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import ThemeHomeRenderer from "@/components/ThemeHomeRenderer";
import {
  createSection,
  getDefaultThemeV2,
  legacyLayoutToThemeV2,
  normalizeThemeV2,
  type ThemeMediaAsset,
  type ThemePreviewPage,
  type ThemeSection,
  type ThemeSectionType,
  type ThemeV2,
  type ThemeViewport,
} from "@/lib/theme-editor";

interface Shop {
  id: number;
  name: string;
  domain: string;
  layout_config: string | null | Record<string, unknown>;
}

interface ThemeVersion {
  id: number;
  version_no: number;
  schema_version: number;
  created_by: string | null;
  created_at: string;
}

interface LegacyLayout {
  header: {
    announcementEnabled: boolean;
    announcementText: string;
    navLinks: { label: string; href: string }[];
  };
  hero: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    backgroundImage: string;
  };
  productGrid: {
    sectionTitle: string;
    itemsPerPage: number;
  };
}

const DEFAULT_LEGACY_LAYOUT: LegacyLayout = {
  header: {
    announcementEnabled: true,
    announcementText: "Norse Winter Beard Oil Available Now",
    navLinks: [
      { label: "Shop", href: "/shop" },
      { label: "Deals", href: "/deals" },
      { label: "Beard", href: "/beard" },
      { label: "Hair", href: "/hair" },
      { label: "Body", href: "/body" },
      { label: "Fragrances", href: "/fragrances" },
    ],
  },
  hero: {
    title: "Keep on Growing",
    subtitle: "Premium beard care products",
    ctaText: "Shop Now",
    ctaLink: "/shop",
    backgroundImage: "",
  },
  productGrid: {
    sectionTitle: "The Collection",
    itemsPerPage: 8,
  },
};

function parseLegacyLayout(raw: unknown): LegacyLayout {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return DEFAULT_LEGACY_LAYOUT;
  }

  const source = parsed as Record<string, unknown>;
  const header = (source.header && typeof source.header === "object" && !Array.isArray(source.header)
    ? source.header
    : {}) as Record<string, unknown>;
  const hero = (source.hero && typeof source.hero === "object" && !Array.isArray(source.hero)
    ? source.hero
    : {}) as Record<string, unknown>;
  const productGrid = (source.productGrid && typeof source.productGrid === "object" && !Array.isArray(source.productGrid)
    ? source.productGrid
    : {}) as Record<string, unknown>;

  const navRaw = Array.isArray(header.navLinks) ? header.navLinks : DEFAULT_LEGACY_LAYOUT.header.navLinks;
  const navLinks = navRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { label?: unknown; href?: unknown };
      if (typeof row.label !== "string" || typeof row.href !== "string") return null;
      return { label: row.label, href: row.href };
    })
    .filter((item): item is { label: string; href: string } => Boolean(item));

  return {
    header: {
      announcementEnabled:
        typeof header.announcementEnabled === "boolean"
          ? header.announcementEnabled
          : DEFAULT_LEGACY_LAYOUT.header.announcementEnabled,
      announcementText:
        typeof header.announcementText === "string"
          ? header.announcementText
          : DEFAULT_LEGACY_LAYOUT.header.announcementText,
      navLinks: navLinks.length > 0 ? navLinks : DEFAULT_LEGACY_LAYOUT.header.navLinks,
    },
    hero: {
      title: typeof hero.title === "string" ? hero.title : DEFAULT_LEGACY_LAYOUT.hero.title,
      subtitle: typeof hero.subtitle === "string" ? hero.subtitle : DEFAULT_LEGACY_LAYOUT.hero.subtitle,
      ctaText: typeof hero.ctaText === "string" ? hero.ctaText : DEFAULT_LEGACY_LAYOUT.hero.ctaText,
      ctaLink: typeof hero.ctaLink === "string" ? hero.ctaLink : DEFAULT_LEGACY_LAYOUT.hero.ctaLink,
      backgroundImage:
        typeof hero.backgroundImage === "string"
          ? hero.backgroundImage
          : DEFAULT_LEGACY_LAYOUT.hero.backgroundImage,
    },
    productGrid: {
      sectionTitle:
        typeof productGrid.sectionTitle === "string"
          ? productGrid.sectionTitle
          : DEFAULT_LEGACY_LAYOUT.productGrid.sectionTitle,
      itemsPerPage:
        typeof productGrid.itemsPerPage === "number"
          ? productGrid.itemsPerPage
          : DEFAULT_LEGACY_LAYOUT.productGrid.itemsPerPage,
    },
  };
}

function sectionTypeLabel(type: ThemeSectionType) {
  if (type === "hero") return "横幅 Hero";
  if (type === "product_grid") return "商品网格";
  if (type === "tagline") return "标语";
  if (type === "brand_story") return "品牌故事";
  return "富文本";
}

function sectionSummary(section: ThemeSection) {
  const settings = section.settings as Record<string, unknown>;
  if (section.type === "hero") return String(settings.title || "Hero section");
  if (section.type === "product_grid") return String(settings.title || "Product section");
  if (section.type === "tagline") return String(settings.text || "Tagline section");
  if (section.type === "brand_story") return String(settings.title || "Brand story section");
  return String(settings.heading || "Custom rich text");
}

const PREVIEW_PAGES: { value: ThemePreviewPage; label: string }[] = [
  { value: "home", label: "首页" },
  { value: "collection", label: "集合页" },
  { value: "product", label: "商品详情" },
  { value: "support", label: "支持页" },
  { value: "company", label: "公司页" },
];

const VIEWPORT_LABEL: Record<ThemeViewport, string> = {
  desktop: "电脑端",
  mobile: "手机端",
};

export const ShopDesignView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const { toast } = useToast();

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingTheme, setLoadingTheme] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingLegacy, setSavingLegacy] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const [themeDraft, setThemeDraft] = useState<ThemeV2>(getDefaultThemeV2());
  const [publishedTheme, setPublishedTheme] = useState<ThemeV2 | null>(null);
  const [themeEnabled, setThemeEnabled] = useState(false);
  const [versions, setVersions] = useState<ThemeVersion[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [previewViewport, setPreviewViewport] = useState<ThemeViewport>("desktop");
  const [previewPage, setPreviewPage] = useState<ThemePreviewPage>("home");

  const [undoStack, setUndoStack] = useState<ThemeV2[]>([]);
  const [redoStack, setRedoStack] = useState<ThemeV2[]>([]);

  const [assetName, setAssetName] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetType, setAssetType] = useState<ThemeMediaAsset["type"]>("image");

  const [legacyLayout, setLegacyLayout] = useState<LegacyLayout>(DEFAULT_LEGACY_LAYOUT);

  const selectedSection = useMemo(
    () => themeDraft.home.sections.find((section) => section.id === selectedSectionId) || null,
    [themeDraft.home.sections, selectedSectionId]
  );
  const selectedShop = useMemo(
    () => shops.find((shop) => String(shop.id) === selectedShopId) || null,
    [shops, selectedShopId]
  );
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const currentViewportOverride = themeDraft.viewportOverrides[previewViewport];

  const loadShops = useCallback(async () => {
    setLoadingShops(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/shops`, { headers: getAuthHeaders() });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      const data = await response.json();
      if (!Array.isArray(data)) return;
      setShops(data);
      if (data.length > 0) setSelectedShopId((prev) => prev || String(data[0].id));
    } catch (error) {
      console.error("Failed to load shops", error);
      toast({ title: "Error", description: "Failed to load shops.", variant: "destructive" });
    } finally {
      setLoadingShops(false);
    }
  }, [clearAuth, getAuthHeaders, toast]);

  const loadTheme = useCallback(async (shopId: string, fallbackLayout?: unknown) => {
    if (!shopId) return;
    setLoadingTheme(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/shops/${shopId}/theme-v2`, {
        headers: getAuthHeaders(),
      });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      if (!response.ok) throw new Error("Failed to load theme");
      const data = await response.json();
      const draft = normalizeThemeV2(data?.draft);
      const published = data?.published ? normalizeThemeV2(data.published) : null;
      setThemeDraft(draft);
      setPublishedTheme(published);
      setThemeEnabled(Boolean(data?.enabled));
      setSelectedSectionId(draft.home.sections[0]?.id || "");
      setUndoStack([]);
      setRedoStack([]);
    } catch (error) {
      console.error("Failed to load theme", error);
      const fallback = fallbackLayout
        ? legacyLayoutToThemeV2(fallbackLayout)
        : getDefaultThemeV2();
      setThemeDraft(fallback);
      setPublishedTheme(null);
      setThemeEnabled(false);
      setSelectedSectionId(fallback.home.sections[0]?.id || "");
      setUndoStack([]);
      setRedoStack([]);
      toast({
        title: "Theme v2 fallback",
        description: "Using fallback draft derived from current legacy layout.",
      });
    } finally {
      setLoadingTheme(false);
    }
  }, [clearAuth, getAuthHeaders, toast]);

  const loadVersions = useCallback(async (shopId: string) => {
    if (!shopId) return;
    setLoadingVersions(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/shops/${shopId}/theme-v2/versions`, {
        headers: getAuthHeaders(),
      });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      if (!response.ok) throw new Error("Failed to load versions");
      const data = await response.json();
      setVersions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load versions", error);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }, [clearAuth, getAuthHeaders]);

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (!selectedShopId) return;
    const shop = shops.find((item) => String(item.id) === selectedShopId);
    if (!shop) return;
    setLegacyLayout(parseLegacyLayout(shop.layout_config));
    void loadTheme(selectedShopId, shop.layout_config);
    void loadVersions(selectedShopId);
  }, [selectedShopId, shops, loadTheme, loadVersions]);

  const updateThemeDraft = (updater: (prev: ThemeV2) => ThemeV2) => {
    setThemeDraft((prev) => {
      const next = normalizeThemeV2(updater(prev));
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      setUndoStack((stack) => [...stack.slice(-59), prev]);
      setRedoStack([]);
      return next;
    });
  };

  const updateSection = (sectionId: string, updater: (section: ThemeSection) => ThemeSection) => {
    updateThemeDraft((prev) => ({
      ...prev,
      home: {
        ...prev.home,
        sections: prev.home.sections.map((section) =>
          section.id === sectionId ? updater(section) : section
        ),
      },
    }));
  };

  const updateToken = <K extends keyof ThemeV2["tokens"]>(key: K, value: ThemeV2["tokens"][K]) => {
    updateThemeDraft((prev) => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        [key]: value,
      },
    }));
  };

  const updateViewportOverride = (
    viewport: ThemeViewport,
    patch: Partial<ThemeV2["viewportOverrides"][ThemeViewport]>
  ) => {
    updateThemeDraft((prev) => ({
      ...prev,
      viewportOverrides: {
        ...prev.viewportOverrides,
        [viewport]: {
          ...prev.viewportOverrides[viewport],
          ...patch,
        },
      },
    }));
  };

  const handleUndo = () => {
    if (!themeDraft || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [themeDraft, ...stack].slice(0, 60));
    setThemeDraft(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((stack) => stack.slice(1));
    setUndoStack((stack) => [...stack.slice(-59), themeDraft]);
    setThemeDraft(next);
  };

  const toggleHiddenInCurrentViewport = (sectionId: string, checked: boolean) => {
    const hidden = new Set(currentViewportOverride.hiddenSectionIds);
    if (checked) hidden.add(sectionId);
    else hidden.delete(sectionId);
    updateViewportOverride(previewViewport, { hiddenSectionIds: Array.from(hidden) });
  };

  const addMediaAsset = () => {
    if (!assetName.trim() || !assetUrl.trim()) return;
    updateThemeDraft((prev) => ({
      ...prev,
      mediaLibrary: [
        ...prev.mediaLibrary,
        {
          id: `asset-${Date.now()}-${prev.mediaLibrary.length + 1}`,
          name: assetName.trim(),
          url: assetUrl.trim(),
          type: assetType,
        },
      ],
    }));
    setAssetName("");
    setAssetUrl("");
    setAssetType("image");
  };

  const removeMediaAsset = (assetId: string) => {
    updateThemeDraft((prev) => ({
      ...prev,
      mediaLibrary: prev.mediaLibrary.filter((asset) => asset.id !== assetId),
    }));
  };

  const addSection = (type: ThemeSectionType) => {
    const created = createSection(type);
    updateThemeDraft((prev) => ({
      ...prev,
      home: {
        ...prev.home,
        sections: [...prev.home.sections, created],
      },
    }));
    setSelectedSectionId(created.id);
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    updateThemeDraft((prev) => {
      const list = [...prev.home.sections];
      const index = list.findIndex((section) => section.id === sectionId);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[nextIndex];
      list[nextIndex] = temp;
      return { ...prev, home: { ...prev.home, sections: list } };
    });
  };

  const duplicateSection = (sectionId: string) => {
    updateThemeDraft((prev) => {
      const list = [...prev.home.sections];
      const index = list.findIndex((section) => section.id === sectionId);
      if (index < 0) return prev;
      const source = list[index];
      const copy: ThemeSection = {
        ...source,
        id: `${source.type}-${Date.now()}`,
      };
      list.splice(index + 1, 0, copy);
      setSelectedSectionId(copy.id);
      return { ...prev, home: { ...prev.home, sections: list } };
    });
  };

  const deleteSection = (sectionId: string) => {
    updateThemeDraft((prev) => {
      if (prev.home.sections.length <= 1) {
        toast({
          title: "Cannot delete",
          description: "At least one section is required.",
          variant: "destructive",
        });
        return prev;
      }
      const next = prev.home.sections.filter((section) => section.id !== sectionId);
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(next[0]?.id || "");
      }
      return { ...prev, home: { ...prev.home, sections: next } };
    });
  };

  const saveDraft = async () => {
    if (!selectedShopId) return;
    setSavingDraft(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/shops/${selectedShopId}/theme-v2/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ theme: themeDraft }),
      });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      if (!response.ok) throw new Error("Failed to save draft");
      const data = await response.json();
      setThemeDraft(normalizeThemeV2(data?.draft || themeDraft));
      toast({ title: "Draft saved", description: "Theme draft is stored successfully." });
    } catch (error) {
      console.error("Failed to save draft", error);
      toast({ title: "Error", description: "Failed to save draft.", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  const publishTheme = async () => {
    if (!selectedShopId) return;
    setPublishing(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/shops/${selectedShopId}/theme-v2/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ theme: themeDraft, enabled: themeEnabled }),
      });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      if (!response.ok) throw new Error("Failed to publish theme");
      const data = await response.json();
      const published = normalizeThemeV2(data?.published || themeDraft);
      setThemeDraft(published);
      setPublishedTheme(published);
      setUndoStack([]);
      setRedoStack([]);
      await loadVersions(selectedShopId);
      toast({
        title: "Published",
        description: `Theme published as version #${data?.versionNo ?? "new"}.`,
      });
    } catch (error) {
      console.error("Failed to publish theme", error);
      toast({ title: "Error", description: "Failed to publish theme.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const rollbackVersion = async (versionId: number) => {
    if (!selectedShopId) return;
    setPublishing(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/shops/${selectedShopId}/theme-v2/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ versionId }),
      });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      if (!response.ok) throw new Error("Failed to rollback theme");
      const data = await response.json();
      const next = normalizeThemeV2(data?.published || themeDraft);
      setThemeDraft(next);
      setPublishedTheme(next);
      setSelectedSectionId(next.home.sections[0]?.id || "");
      setUndoStack([]);
      setRedoStack([]);
      await loadVersions(selectedShopId);
      toast({
        title: "Rollback completed",
        description: `Restored and published as version #${data?.versionNo ?? "new"}.`,
      });
    } catch (error) {
      console.error("Failed to rollback", error);
      toast({ title: "Error", description: "Rollback failed.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const toggleThemeEnabled = async (checked: boolean) => {
    if (!selectedShopId) return;
    setThemeEnabled(checked);
    setTogglingEnabled(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/shops/${selectedShopId}/theme-v2/flag`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ enabled: checked }),
      });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      if (!response.ok) throw new Error("Failed to toggle theme flag");
      toast({ title: "Updated", description: `Theme v2 is now ${checked ? "enabled" : "disabled"}.` });
    } catch (error) {
      console.error("Failed to toggle theme flag", error);
      setThemeEnabled(!checked);
      toast({ title: "Error", description: "Failed to toggle theme flag.", variant: "destructive" });
    } finally {
      setTogglingEnabled(false);
    }
  };

  const saveLegacy = async () => {
    if (!selectedShopId) return;
    setSavingLegacy(true);
    try {
      const payload = {
        layout_config: {
          header: legacyLayout.header,
          hero: legacyLayout.hero,
          productGrid: legacyLayout.productGrid,
        },
      };
      const response = await fetch(`${API_URL}/api/admin/shops/${selectedShopId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        clearAuth();
        return;
      }
      if (!response.ok) throw new Error("Failed to save legacy layout");
      setShops((prev) =>
        prev.map((shop) =>
          String(shop.id) === selectedShopId
            ? { ...shop, layout_config: JSON.stringify(payload.layout_config) }
            : shop
        )
      );
      toast({ title: "Legacy saved", description: "Legacy v1 layout updated." });
    } catch (error) {
      console.error("Failed to save legacy layout", error);
      toast({ title: "Error", description: "Failed to save legacy layout.", variant: "destructive" });
    } finally {
      setSavingLegacy(false);
    }
  };

  const isBusy = loadingShops || loadingTheme;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">店铺装修中心 v2</h2>
          <p className="text-sm text-muted-foreground">
            支持草稿、发布、回滚、手机/电脑预览与模块可视化编辑。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedShopId} onValueChange={setSelectedShopId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="选择店铺" />
            </SelectTrigger>
            <SelectContent>
              {shops.map((shop) => (
                <SelectItem key={shop.id} value={String(shop.id)}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 border rounded-md px-3 h-10">
            <Switch checked={themeEnabled} disabled={togglingEnabled || !selectedShopId} onCheckedChange={toggleThemeEnabled} />
            <span className="text-sm">启用 v2</span>
            {togglingEnabled ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
          </div>

          <Button variant="outline" onClick={handleUndo} disabled={!canUndo}>
            <Undo2 className="w-4 h-4 mr-2" />
            撤销
          </Button>
          <Button variant="outline" onClick={handleRedo} disabled={!canRedo}>
            <Redo2 className="w-4 h-4 mr-2" />
            重做
          </Button>

          <Button variant="outline" onClick={() => selectedShopId && (void loadTheme(selectedShopId))} disabled={!selectedShopId}>
            <RotateCcw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button variant="outline" onClick={saveDraft} disabled={!selectedShopId || savingDraft || isBusy}>
            {savingDraft ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            保存草稿
          </Button>
          <Button onClick={publishTheme} disabled={!selectedShopId || publishing || isBusy}>
            {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            发布上线
          </Button>
        </div>
      </div>

      {isBusy ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : null}

      {!isBusy && selectedShop ? (
        <Tabs defaultValue="v2" className="w-full">
          <TabsList>
            <TabsTrigger value="v2" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Theme v2
            </TabsTrigger>
            <TabsTrigger value="legacy">Legacy v1</TabsTrigger>
          </TabsList>

          <TabsContent value="v2" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">当前店铺</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="font-medium">{selectedShop.name}</div>
                  <div className="text-muted-foreground">{selectedShop.domain}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">主题状态</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <Badge variant={themeEnabled ? "default" : "outline"}>
                    {themeEnabled ? "v2 已启用" : "v2 未启用"}
                  </Badge>
                  <div className="text-muted-foreground">
                    已发布版本: {versions[0]?.version_no ?? "无"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">草稿操作</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!publishedTheme}
                    onClick={() => {
                      if (!publishedTheme) return;
                      const next = normalizeThemeV2(publishedTheme);
                      setThemeDraft(next);
                      setSelectedSectionId(next.home.sections[0]?.id || "");
                      setUndoStack([]);
                      setRedoStack([]);
                    }}
                  >
                    使用已发布版本作为草稿
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>可视化预览</CardTitle>
                <CardDescription>切换设备与页面，右侧实时预览当前草稿效果。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={previewViewport === "desktop" ? "default" : "outline"}
                    onClick={() => setPreviewViewport("desktop")}
                  >
                    <Monitor className="w-4 h-4 mr-2" />
                    电脑端
                  </Button>
                  <Button
                    type="button"
                    variant={previewViewport === "mobile" ? "default" : "outline"}
                    onClick={() => setPreviewViewport("mobile")}
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    手机端
                  </Button>
                </div>

                <Tabs value={previewPage} onValueChange={(value) => setPreviewPage(value as ThemePreviewPage)}>
                  <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto">
                    {PREVIEW_PAGES.map((page) => (
                      <TabsTrigger key={page.value} value={page.value}>
                        {page.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="rounded-md border bg-muted/30 p-3">
                  <div
                    className={cn(
                      "mx-auto rounded-md border bg-background overflow-auto",
                      previewViewport === "mobile" ? "max-w-[420px]" : "w-full"
                    )}
                  >
                    <ThemeHomeRenderer
                      theme={themeDraft}
                      shopName={selectedShop.name}
                      viewport={previewViewport}
                      page={previewPage}
                      interactive={false}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>主题样式</CardTitle>
                    <CardDescription>全局宽度、圆角、字体和颜色配置。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>内容宽度</Label>
                      <Select
                        value={themeDraft.tokens.contentWidth}
                        onValueChange={(value) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            tokens: { ...prev.tokens, contentWidth: value as ThemeV2["tokens"]["contentWidth"] },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="narrow">窄</SelectItem>
                          <SelectItem value="normal">标准</SelectItem>
                          <SelectItem value="wide">宽</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>圆角</Label>
                      <Select
                        value={themeDraft.tokens.radius}
                        onValueChange={(value) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            tokens: { ...prev.tokens, radius: value as ThemeV2["tokens"]["radius"] },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">无</SelectItem>
                          <SelectItem value="sm">小</SelectItem>
                          <SelectItem value="md">中</SelectItem>
                          <SelectItem value="lg">大</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>表面风格</Label>
                      <Select
                        value={themeDraft.tokens.surface}
                        onValueChange={(value) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            tokens: { ...prev.tokens, surface: value as ThemeV2["tokens"]["surface"] },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">默认</SelectItem>
                          <SelectItem value="soft">柔和</SelectItem>
                          <SelectItem value="outline">描边</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>字体</Label>
                      <Select
                        value={themeDraft.tokens.fontFamily}
                        onValueChange={(value) => updateToken("fontFamily", value as ThemeV2["tokens"]["fontFamily"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="serif">Serif</SelectItem>
                          <SelectItem value="sans">Sans</SelectItem>
                          <SelectItem value="mono">Mono</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label>主题色</Label>
                        <Input
                          type="color"
                          value={themeDraft.tokens.accentColor}
                          onChange={(event) => updateToken("accentColor", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>背景色</Label>
                        <Input
                          type="color"
                          value={themeDraft.tokens.backgroundColor}
                          onChange={(event) => updateToken("backgroundColor", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>文字色</Label>
                        <Input
                          type="color"
                          value={themeDraft.tokens.textColor}
                          onChange={(event) => updateToken("textColor", event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>模块间距</Label>
                        <Input
                          type="number"
                          min={8}
                          max={64}
                          value={themeDraft.tokens.sectionGap}
                          onChange={(event) =>
                            updateToken("sectionGap", Math.max(8, Math.min(64, Number(event.target.value) || 24)))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>卡片间距</Label>
                        <Input
                          type="number"
                          min={0}
                          max={32}
                          value={themeDraft.tokens.cardGap}
                          onChange={(event) =>
                            updateToken("cardGap", Math.max(0, Math.min(32, Number(event.target.value) || 8)))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>标题大小</Label>
                      <Select
                        value={themeDraft.tokens.titleScale}
                        onValueChange={(value) => updateToken("titleScale", value as ThemeV2["tokens"]["titleScale"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sm">小</SelectItem>
                          <SelectItem value="md">中</SelectItem>
                          <SelectItem value="lg">大</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{VIEWPORT_LABEL[previewViewport]} 覆盖设置</CardTitle>
                    <CardDescription>仅影响当前预览设备，不会影响另一端。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>内容宽度</Label>
                      <Select
                        value={currentViewportOverride.contentWidth || "follow"}
                        onValueChange={(value) =>
                          updateViewportOverride(previewViewport, {
                            contentWidth: value === "follow" ? undefined : (value as ThemeV2["tokens"]["contentWidth"]),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="follow">跟随全局</SelectItem>
                          <SelectItem value="narrow">窄</SelectItem>
                          <SelectItem value="normal">标准</SelectItem>
                          <SelectItem value="wide">宽</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>标题大小</Label>
                      <Select
                        value={currentViewportOverride.titleScale || "follow"}
                        onValueChange={(value) =>
                          updateViewportOverride(previewViewport, {
                            titleScale: value === "follow" ? undefined : (value as ThemeV2["tokens"]["titleScale"]),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="follow">跟随全局</SelectItem>
                          <SelectItem value="sm">小</SelectItem>
                          <SelectItem value="md">中</SelectItem>
                          <SelectItem value="lg">大</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>模块间距</Label>
                        <Input
                          type="number"
                          min={8}
                          max={64}
                          value={currentViewportOverride.sectionGap ?? ""}
                          placeholder="跟随全局"
                          onChange={(event) => {
                            const value = event.target.value;
                            updateViewportOverride(previewViewport, {
                              sectionGap: value === "" ? undefined : Math.max(8, Math.min(64, Number(value) || 24)),
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>卡片间距</Label>
                        <Input
                          type="number"
                          min={0}
                          max={32}
                          value={currentViewportOverride.cardGap ?? ""}
                          placeholder="跟随全局"
                          onChange={(event) => {
                            const value = event.target.value;
                            updateViewportOverride(previewViewport, {
                              cardGap: value === "" ? undefined : Math.max(0, Math.min(32, Number(value) || 8)),
                            });
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* header and footer cards */}
                <Card>
                  <CardHeader>
                    <CardTitle>顶部导航</CardTitle>
                    <CardDescription>公告栏和导航链接。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="announcement-enabled">公告开关</Label>
                      <Switch
                        id="announcement-enabled"
                        checked={themeDraft.header.announcementEnabled}
                        onCheckedChange={(checked) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            header: { ...prev.header, announcementEnabled: checked },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>公告文字</Label>
                      <Input
                        value={themeDraft.header.announcementText}
                        onChange={(event) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            header: { ...prev.header, announcementText: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label>导航链接</Label>
                      {themeDraft.header.navLinks.map((link, index) => (
                        <div key={`${link.label}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <Input
                            value={link.label}
                            onChange={(event) =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                header: {
                                  ...prev.header,
                                  navLinks: prev.header.navLinks.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, label: event.target.value } : row
                                  ),
                                },
                              }))
                            }
                          />
                          <Input
                            value={link.href}
                            onChange={(event) =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                header: {
                                  ...prev.header,
                                  navLinks: prev.header.navLinks.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, href: event.target.value } : row
                                  ),
                                },
                              }))
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                header: {
                                  ...prev.header,
                                  navLinks: prev.header.navLinks.filter((_, rowIndex) => rowIndex !== index),
                                },
                              }))
                            }
                            disabled={themeDraft.header.navLinks.length <= 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            header: {
                              ...prev.header,
                              navLinks: [...prev.header.navLinks, { label: "New Link", href: "/" }],
                            },
                          }))
                        }
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        添加链接
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>底部信息</CardTitle>
                    <CardDescription>描述、标语和社交链接。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>描述</Label>
                      <Textarea
                        value={themeDraft.footer.description}
                        onChange={(event) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            footer: { ...prev.footer, description: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>标语</Label>
                      <Input
                        value={themeDraft.footer.motto}
                        onChange={(event) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            footer: { ...prev.footer, motto: event.target.value },
                          }))
                        }
                      />
                    </div>

                    <Separator />
                    <div className="space-y-2">
                      <Label>社交链接</Label>
                      {themeDraft.footer.socialLinks.map((social, index) => (
                        <div key={`${social.name}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <Input
                            value={social.name}
                            onChange={(event) =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  socialLinks: prev.footer.socialLinks.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, name: event.target.value } : row
                                  ),
                                },
                              }))
                            }
                          />
                          <Input
                            value={social.href}
                            onChange={(event) =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  socialLinks: prev.footer.socialLinks.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, href: event.target.value } : row
                                  ),
                                },
                              }))
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  socialLinks: prev.footer.socialLinks.filter((_, rowIndex) => rowIndex !== index),
                                },
                              }))
                            }
                            disabled={themeDraft.footer.socialLinks.length <= 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            footer: {
                              ...prev.footer,
                              socialLinks: [...prev.footer.socialLinks, { name: "New", href: "#" }],
                            },
                          }))
                        }
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        添加社交链接
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>首页模块</CardTitle>
                    <CardDescription>
                      排序和编辑模块。禁用的模块保留在草稿中但不会渲染。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => addSection("hero")}>
                        <Plus className="w-4 h-4 mr-2" />
                        横幅
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("product_grid")}>
                        <Plus className="w-4 h-4 mr-2" />
                        商品网格
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("tagline")}>
                        <Plus className="w-4 h-4 mr-2" />
                        标语
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("brand_story")}>
                        <Plus className="w-4 h-4 mr-2" />
                        品牌故事
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("rich_text")}>
                        <Plus className="w-4 h-4 mr-2" />
                        富文本
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {themeDraft.home.sections.map((section, index) => (
                        <div
                          key={section.id}
                          className={`border rounded-md p-3 ${
                            selectedSectionId === section.id ? "border-primary bg-muted/40" : ""
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <button
                              type="button"
                              className="text-left flex-1"
                              onClick={() => setSelectedSectionId(section.id)}
                            >
                              <div className="font-medium">
                                {index + 1}. {sectionTypeLabel(section.type)}
                              </div>
                              <div className="text-sm text-muted-foreground">{sectionSummary(section)}</div>
                            </button>
                            <div className="flex flex-wrap items-center gap-2">
                              <Switch
                                checked={section.enabled}
                                onCheckedChange={(checked) =>
                                  updateSection(section.id, (current) => ({ ...current, enabled: checked }))
                                }
                              />
                              <div className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center gap-2">
                                D
                                <Switch
                                  checked={section.visibility.desktop}
                                  onCheckedChange={(checked) =>
                                    updateSection(section.id, (current) => ({
                                      ...current,
                                      visibility: { ...current.visibility, desktop: checked },
                                    }))
                                  }
                                />
                              </div>
                              <div className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center gap-2">
                                M
                                <Switch
                                  checked={section.visibility.mobile}
                                  onCheckedChange={(checked) =>
                                    updateSection(section.id, (current) => ({
                                      ...current,
                                      visibility: { ...current.visibility, mobile: checked },
                                    }))
                                  }
                                />
                              </div>
                              <div className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center gap-2">
                                隐藏({VIEWPORT_LABEL[previewViewport]})
                                <Switch
                                  checked={currentViewportOverride.hiddenSectionIds.includes(section.id)}
                                  onCheckedChange={(checked) => toggleHiddenInCurrentViewport(section.id, checked)}
                                />
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => moveSection(section.id, "up")}>
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => moveSection(section.id, "down")}>
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => duplicateSection(section.id)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteSection(section.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {selectedSection ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        编辑模块: {sectionTypeLabel(selectedSection.type)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedSection.type === "hero" ? (
                        <>
                          <div className="space-y-2">
                            <Label>标题</Label>
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).title || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), title: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>副标题</Label>
                            <Textarea
                              value={String((selectedSection.settings as Record<string, unknown>).subtitle || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    subtitle: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>按钮文字</Label>
                              <Input
                                value={String((selectedSection.settings as Record<string, unknown>).ctaText || "")}
                                onChange={(event) =>
                                  updateSection(selectedSection.id, (section) => ({
                                    ...section,
                                    settings: {
                                      ...(section.settings as Record<string, unknown>),
                                      ctaText: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>按钮链接</Label>
                              <Input
                                value={String((selectedSection.settings as Record<string, unknown>).ctaLink || "")}
                                onChange={(event) =>
                                  updateSection(selectedSection.id, (section) => ({
                                    ...section,
                                    settings: {
                                      ...(section.settings as Record<string, unknown>),
                                      ctaLink: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>背景图片 URL</Label>
                            <Input
                              value={String(
                                (selectedSection.settings as Record<string, unknown>).backgroundImage || ""
                              )}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    backgroundImage: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : null}

                      {selectedSection.type === "product_grid" ? (
                        <>
                          <div className="space-y-2">
                            <Label>标题</Label>
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).title || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), title: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>每页商品数</Label>
                              <Select
                                value={String((selectedSection.settings as Record<string, unknown>).itemsPerPage || 8)}
                                onValueChange={(value) =>
                                  updateSection(selectedSection.id, (section) => ({
                                    ...section,
                                    settings: {
                                      ...(section.settings as Record<string, unknown>),
                                      itemsPerPage: Number(value),
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="4">4</SelectItem>
                                  <SelectItem value="8">8</SelectItem>
                                  <SelectItem value="12">12</SelectItem>
                                  <SelectItem value="16">16</SelectItem>
                                  <SelectItem value="24">24</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <div className="flex items-center justify-between border rounded-md px-3 h-10 w-full">
                                <Label htmlFor="show-filters">显示分类筛选</Label>
                                <Switch
                                  id="show-filters"
                                  checked={Boolean(
                                    (selectedSection.settings as Record<string, unknown>).showFilters !== false
                                  )}
                                  onCheckedChange={(checked) =>
                                    updateSection(selectedSection.id, (section) => ({
                                      ...section,
                                      settings: {
                                        ...(section.settings as Record<string, unknown>),
                                        showFilters: checked,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {selectedSection.type === "tagline" ? (
                        <div className="space-y-2">
                          <Label>标语文字</Label>
                          <Input
                            value={String((selectedSection.settings as Record<string, unknown>).text || "")}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => ({
                                ...section,
                                settings: { ...(section.settings as Record<string, unknown>), text: event.target.value },
                              }))
                            }
                          />
                        </div>
                      ) : null}

                      {selectedSection.type === "brand_story" ? (
                        <>
                          <div className="space-y-2">
                            <Label>小标题</Label>
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).kicker || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    kicker: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>标题</Label>
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).title || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    title: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>正文</Label>
                            <Textarea
                              rows={6}
                              value={String((selectedSection.settings as Record<string, unknown>).body || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    body: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>按钮文字</Label>
                              <Input
                                value={String(
                                  (selectedSection.settings as Record<string, unknown>).buttonText || ""
                                )}
                                onChange={(event) =>
                                  updateSection(selectedSection.id, (section) => ({
                                    ...section,
                                    settings: {
                                      ...(section.settings as Record<string, unknown>),
                                      buttonText: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>按钮链接</Label>
                              <Input
                                value={String(
                                  (selectedSection.settings as Record<string, unknown>).buttonLink || ""
                                )}
                                onChange={(event) =>
                                  updateSection(selectedSection.id, (section) => ({
                                    ...section,
                                    settings: {
                                      ...(section.settings as Record<string, unknown>),
                                      buttonLink: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </>
                      ) : null}

                      {selectedSection.type === "rich_text" ? (
                        <>
                          <div className="space-y-2">
                            <Label>标题</Label>
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).heading || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    heading: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>正文</Label>
                            <Textarea
                              rows={5}
                              value={String((selectedSection.settings as Record<string, unknown>).body || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    body: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>对齐方式</Label>
                            <Select
                              value={String((selectedSection.settings as Record<string, unknown>).align || "left")}
                              onValueChange={(value) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: {
                                    ...(section.settings as Record<string, unknown>),
                                    align: value,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">左对齐</SelectItem>
                                <SelectItem value="center">居中</SelectItem>
                                <SelectItem value="right">右对齐</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      点击左侧模块进行编辑。
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>页面配置（Page Presets）</CardTitle>
                    <CardDescription>配置集合页、商品页、支持页、公司页预览字段。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="font-medium">集合页</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.collection.title}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: {
                                ...prev.pages,
                                collection: { ...prev.pages.collection, title: event.target.value },
                              },
                            }))
                          }
                          placeholder="标题"
                        />
                        <Input
                          value={themeDraft.pages.collection.subtitle}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: {
                                ...prev.pages,
                                collection: { ...prev.pages.collection, subtitle: event.target.value },
                              },
                            }))
                          }
                          placeholder="副标题"
                        />
                      </div>
                      <Input
                        value={themeDraft.pages.collection.bannerImage}
                        onChange={(event) =>
                          updateThemeDraft((prev) => ({
                            ...prev,
                            pages: {
                              ...prev.pages,
                              collection: { ...prev.pages.collection, bannerImage: event.target.value },
                            },
                          }))
                        }
                        placeholder="Banner 图片 URL"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">商品页</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.product.title}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, product: { ...prev.pages.product, title: event.target.value } },
                            }))
                          }
                          placeholder="标题"
                        />
                        <Input
                          value={themeDraft.pages.product.subtitle}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, product: { ...prev.pages.product, subtitle: event.target.value } },
                            }))
                          }
                          placeholder="副标题"
                        />
                      </div>
                      <div className="grid md:grid-cols-3 gap-3">
                        <Select
                          value={themeDraft.pages.product.galleryStyle}
                          onValueChange={(value) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: {
                                ...prev.pages,
                                product: { ...prev.pages.product, galleryStyle: value as "grid" | "carousel" },
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grid">Grid</SelectItem>
                            <SelectItem value="carousel">Carousel</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="border rounded-md px-3 py-2 flex items-center justify-between">
                          <span className="text-sm">面包屑导航</span>
                          <Switch
                            checked={themeDraft.pages.product.showBreadcrumbs}
                            onCheckedChange={(checked) =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                pages: {
                                  ...prev.pages,
                                  product: { ...prev.pages.product, showBreadcrumbs: checked },
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="border rounded-md px-3 py-2 flex items-center justify-between">
                          <span className="text-sm">卖点展示</span>
                          <Switch
                            checked={themeDraft.pages.product.showBenefits}
                            onCheckedChange={(checked) =>
                              updateThemeDraft((prev) => ({
                                ...prev,
                                pages: {
                                  ...prev.pages,
                                  product: { ...prev.pages.product, showBenefits: checked },
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">支持页 / 公司页</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.support.title}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, support: { ...prev.pages.support, title: event.target.value } },
                            }))
                          }
                          placeholder="支持页标题"
                        />
                        <Input
                          value={themeDraft.pages.support.heroImage}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, support: { ...prev.pages.support, heroImage: event.target.value } },
                            }))
                          }
                          placeholder="支持页图片 URL"
                        />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.company.title}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, company: { ...prev.pages.company, title: event.target.value } },
                            }))
                          }
                          placeholder="公司页标题"
                        />
                        <Input
                          value={themeDraft.pages.company.heroImage}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, company: { ...prev.pages.company, heroImage: event.target.value } },
                            }))
                          }
                          placeholder="公司页图片 URL"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>媒体库</CardTitle>
                    <CardDescription>可复用的图片/视频地址，用于模块和页面字段。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-3">
                      <Select value={assetType} onValueChange={(value) => setAssetType(value as ThemeMediaAsset["type"])}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">image</SelectItem>
                          <SelectItem value="video">video</SelectItem>
                          <SelectItem value="file">file</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="素材名称" />
                      <Input value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} placeholder="URL" className="md:col-span-2" />
                    </div>
                    <Button onClick={addMediaAsset} disabled={!assetName.trim() || !assetUrl.trim()}>
                      <Plus className="w-4 h-4 mr-2" />
                      添加素材
                    </Button>
                    <div className="space-y-2">
                      {themeDraft.mediaLibrary.length === 0 ? (
                        <div className="text-sm text-muted-foreground">暂无素材</div>
                      ) : (
                        themeDraft.mediaLibrary.map((asset) => (
                          <div key={asset.id} className="border rounded-md p-2 flex items-center gap-2">
                            <Badge variant="outline">{asset.type}</Badge>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{asset.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{asset.url}</div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeMediaAsset(asset.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>版本历史</CardTitle>
                    <CardDescription>每次发布和回滚都会创建新的不可变版本。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {loadingVersions ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        加载版本中...
                      </div>
                    ) : versions.length === 0 ? (
                      <div className="text-muted-foreground text-sm">暂无已发布版本。</div>
                    ) : (
                      versions.map((version) => (
                        <div
                          key={version.id}
                          className="border rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                        >
                          <div className="text-sm">
                            <div className="font-medium">版本 #{version.version_no}</div>
                            <div className="text-muted-foreground">
                              schema {version.schema_version} | {version.created_by || "system"} |{" "}
                              {new Date(version.created_at).toLocaleString()}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => rollbackVersion(version.id)}
                            disabled={publishing}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            回滚
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="legacy" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>旧版 v1 布局</CardTitle>
                <CardDescription>
                  此编辑器用于维护旧版 layout_config。在 v2 禁用时使用。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Header</h3>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="legacy-announce">公告栏</Label>
                    <Switch
                      id="legacy-announce"
                      checked={legacyLayout.header.announcementEnabled}
                      onCheckedChange={(checked) =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          header: { ...prev.header, announcementEnabled: checked },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Announcement Text</Label>
                    <Input
                      value={legacyLayout.header.announcementText}
                      onChange={(event) =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          header: { ...prev.header, announcementText: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Navigation Links</Label>
                    {legacyLayout.header.navLinks.map((link, index) => (
                      <div key={`${link.label}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Input
                          value={link.label}
                          onChange={(event) =>
                            setLegacyLayout((prev) => ({
                              ...prev,
                              header: {
                                ...prev.header,
                                navLinks: prev.header.navLinks.map((row, rowIndex) =>
                                  rowIndex === index ? { ...row, label: event.target.value } : row
                                ),
                              },
                            }))
                          }
                        />
                        <Input
                          value={link.href}
                          onChange={(event) =>
                            setLegacyLayout((prev) => ({
                              ...prev,
                              header: {
                                ...prev.header,
                                navLinks: prev.header.navLinks.map((row, rowIndex) =>
                                  rowIndex === index ? { ...row, href: event.target.value } : row
                                ),
                              },
                            }))
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setLegacyLayout((prev) => ({
                              ...prev,
                              header: {
                                ...prev.header,
                                navLinks: prev.header.navLinks.filter((_, rowIndex) => rowIndex !== index),
                              },
                            }))
                          }
                          disabled={legacyLayout.header.navLinks.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          header: {
                            ...prev.header,
                            navLinks: [...prev.header.navLinks, { label: "New Link", href: "/" }],
                          },
                        }))
                      }
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Link
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Hero</h3>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={legacyLayout.hero.title}
                      onChange={(event) =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, title: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input
                      value={legacyLayout.hero.subtitle}
                      onChange={(event) =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, subtitle: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>CTA Text</Label>
                      <Input
                        value={legacyLayout.hero.ctaText}
                        onChange={(event) =>
                          setLegacyLayout((prev) => ({
                            ...prev,
                            hero: { ...prev.hero, ctaText: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CTA Link</Label>
                      <Input
                        value={legacyLayout.hero.ctaLink}
                        onChange={(event) =>
                          setLegacyLayout((prev) => ({
                            ...prev,
                            hero: { ...prev.hero, ctaLink: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background Image URL</Label>
                    <Input
                      value={legacyLayout.hero.backgroundImage}
                      onChange={(event) =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, backgroundImage: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Product Grid</h3>
                  <div className="space-y-2">
                    <Label>Section Title</Label>
                    <Input
                      value={legacyLayout.productGrid.sectionTitle}
                      onChange={(event) =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          productGrid: { ...prev.productGrid, sectionTitle: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Items Per Page</Label>
                    <Select
                      value={String(legacyLayout.productGrid.itemsPerPage)}
                      onValueChange={(value) =>
                        setLegacyLayout((prev) => ({
                          ...prev,
                          productGrid: { ...prev.productGrid, itemsPerPage: Number(value) },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="16">16</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={saveLegacy} disabled={savingLegacy}>
                  {savingLegacy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  保存旧版布局
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
};
