import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Save,
  Upload,
  Download,
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
  GripVertical,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { API_URL } from "@/lib/constants";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { reorderList } from "@/lib/reorder-list";
import ThemeHomeRenderer from "@/components/ThemeHomeRenderer";
import {
  createSection,
  getDefaultThemeV2,
  legacyLayoutToThemeV2,
  normalizeThemeV2,
  type ThemeCatalogProduct,
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

const TEMPLATE_EXPORT_FORMAT = "theme-v2-template";
const MAX_IMAGE_UPLOAD_SIZE = 3 * 1024 * 1024;

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

const SECTION_TYPE_LABELS: Record<ThemeSectionType, string> = {
  hero: "Hero 横幅",
  product_grid: "商品网格",
  tagline: "标语",
  brand_story: "品牌故事",
  rich_text: "富文本",
  image_carousel: "图片轮播",
  video_embed: "视频嵌入",
  testimonials: "客户评价",
  divider: "分隔符",
  countdown_timer: "倒计时",
  featured_collection: "精选集合",
};

function sectionTypeLabel(type: ThemeSectionType) {
  return SECTION_TYPE_LABELS[type] || type;
}

function sectionSummary(section: ThemeSection) {
  const settings = section.settings as Record<string, unknown>;
  if (section.type === "hero") return String(settings.title || "Hero section");
  if (section.type === "product_grid") return String(settings.title || "Product section");
  if (section.type === "tagline") return String(settings.text || "Tagline section");
  if (section.type === "brand_story") return String(settings.title || "Brand story section");
  if (section.type === "image_carousel") return String(settings.title || "图片轮播");
  if (section.type === "video_embed") return String(settings.title || "视频嵌入");
  if (section.type === "testimonials") return String(settings.title || "客户评价");
  if (section.type === "divider") return `分隔符 (${settings.style || "line"})`;
  if (section.type === "countdown_timer") return String(settings.title || "倒计时");
  if (section.type === "featured_collection") return String(settings.title || "精选集合");
  return String(settings.heading || "Custom rich text");
}

const PREVIEW_PAGES: { value: ThemePreviewPage; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "collection", label: "Collection" },
  { value: "product", label: "Product" },
  { value: "support", label: "Support" },
  { value: "company", label: "Company" },
  { value: "checkout", label: "Checkout" },
  { value: "coupon", label: "Coupon" },
  { value: "pin", label: "PIN" },
];

const VIEWPORT_LABEL: Record<ThemeViewport, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
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
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [sectionDropTargetId, setSectionDropTargetId] = useState<string | null>(null);
  const [draggingNavIndex, setDraggingNavIndex] = useState<number | null>(null);
  const [navDropTargetIndex, setNavDropTargetIndex] = useState<number | null>(null);
  const [draggingSocialIndex, setDraggingSocialIndex] = useState<number | null>(null);
  const [socialDropTargetIndex, setSocialDropTargetIndex] = useState<number | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [assetDropTargetId, setAssetDropTargetId] = useState<string | null>(null);

  // Auto-save state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSnapshotRef = useRef<string>("");

  // Confirmation dialogs
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmRollbackOpen, setConfirmRollbackOpen] = useState(false);
  const [confirmRollbackVersionId, setConfirmRollbackVersionId] = useState<number | null>(null);
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);

  const [legacyLayout, setLegacyLayout] = useState<LegacyLayout>(DEFAULT_LEGACY_LAYOUT);
  const templateImportInputRef = useRef<HTMLInputElement | null>(null);
  const productImportInputRef = useRef<HTMLInputElement | null>(null);

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

  const updateCheckoutPage = (patch: Partial<ThemeV2["pages"]["checkout"]>) => {
    updateThemeDraft((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        checkout: {
          ...prev.pages.checkout,
          ...patch,
        },
      },
    }));
  };

  const updateCouponPage = (patch: Partial<ThemeV2["pages"]["coupon"]>) => {
    updateThemeDraft((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        coupon: {
          ...prev.pages.coupon,
          ...patch,
        },
      },
    }));
  };

  const updatePinPage = (patch: Partial<ThemeV2["pages"]["pin"]>) => {
    updateThemeDraft((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        pin: {
          ...prev.pages.pin,
          ...patch,
        },
      },
    }));
  };

  const updateCatalogProduct = (productId: string, patch: Partial<ThemeCatalogProduct>) => {
    updateThemeDraft((prev) => ({
      ...prev,
      catalog: {
        ...prev.catalog,
        products: prev.catalog.products.map((product) =>
          product.id === productId ? { ...product, ...patch } : product
        ),
      },
    }));
  };

  const updateCatalogProductNumber = (
    productId: string,
    field: "price" | "rating" | "reviews",
    value: string
  ) => {
    const parsed = Number(value);
    const normalized = Number.isFinite(parsed) ? parsed : 0;

    if (field === "price") {
      updateCatalogProduct(productId, { price: Math.max(0, normalized) });
      return;
    }

    if (field === "rating") {
      updateCatalogProduct(productId, { rating: Math.max(0, Math.min(5, normalized)) });
      return;
    }

    updateCatalogProduct(productId, { reviews: Math.max(0, Math.round(normalized)) });
  };

  const setCatalogProductCoverImage = (productId: string, imageUrl: string) => {
    updateThemeDraft((prev) => ({
      ...prev,
      catalog: {
        ...prev.catalog,
        products: prev.catalog.products.map((product) => {
          if (product.id !== productId) return product;
          const normalizedImage = imageUrl.trim();
          const nextImages = normalizedImage
            ? [normalizedImage, ...product.images.filter((url) => url !== normalizedImage)]
            : product.images;
          return {
            ...product,
            image: normalizedImage,
            images: nextImages,
          };
        }),
      },
    }));
  };

  const setCatalogProductImagesFromText = (productId: string, value: string) => {
    const nextImages = value
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    updateThemeDraft((prev) => ({
      ...prev,
      catalog: {
        ...prev.catalog,
        products: prev.catalog.products.map((product) => {
          if (product.id !== productId) return product;
          const fallbackImage = product.image || product.images[0] || "";
          const normalizedImages = nextImages.length > 0 ? nextImages : fallbackImage ? [fallbackImage] : [];
          return {
            ...product,
            image: normalizedImages[0] || "",
            images: normalizedImages,
          };
        }),
      },
    }));
  };

  const addCatalogProduct = () => {
    updateThemeDraft((prev) => {
      const nextIndex = prev.catalog.products.length + 1;
      const created: ThemeCatalogProduct = {
        id: `product-${Date.now()}-${nextIndex}`,
        title: `New Product ${nextIndex}`,
        description: "Product description",
        category: "Beard",
        price: 0,
        displayPrice: "$0.00",
        image: "",
        images: [],
        rating: 4.5,
        reviews: 0,
      };

      return {
        ...prev,
        catalog: {
          ...prev.catalog,
          products: [...prev.catalog.products, created],
        },
      };
    });
  };

  const removeCatalogProduct = (productId: string) => {
    updateThemeDraft((prev) => {
      if (prev.catalog.products.length <= 1) return prev;
      return {
        ...prev,
        catalog: {
          ...prev.catalog,
          products: prev.catalog.products.filter((product) => product.id !== productId),
        },
      };
    });
  };

  const moveCatalogProduct = (productId: string, direction: "up" | "down") => {
    updateThemeDraft((prev) => {
      const list = [...prev.catalog.products];
      const index = list.findIndex((product) => product.id === productId);
      if (index < 0) return prev;

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= list.length) return prev;

      return {
        ...prev,
        catalog: {
          ...prev.catalog,
          products: reorderList(list, index, nextIndex),
        },
      };
    });
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Failed to read file"));
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const embedImageFromFile = async (
    file: File,
    apply: (dataUrl: string) => void,
    targetLabel: string
  ) => {
    if (!file) return;

    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      toast({
        title: "Image too large",
        description: `Each image must be <= ${Math.round(MAX_IMAGE_UPLOAD_SIZE / 1024 / 1024)}MB.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      apply(dataUrl);
      toast({
        title: "Image embedded",
        description: `${targetLabel} updated successfully.`,
      });
    } catch (error) {
      console.error("Failed to embed image", error);
      toast({
        title: "Image processing failed",
        description: "Please try a different image.",
        variant: "destructive",
      });
    }
  };

  const handleSingleImageInput = async (
    event: ChangeEvent<HTMLInputElement>,
    apply: (dataUrl: string) => void,
    targetLabel: string
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await embedImageFromFile(file, apply, targetLabel);
  };

  const handleMultiImageInput = async (
    event: ChangeEvent<HTMLInputElement>,
    apply: (dataUrls: string[]) => void,
    targetLabel: string
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const validFiles = files.filter((file) => file.size <= MAX_IMAGE_UPLOAD_SIZE);
    if (validFiles.length === 0) {
      toast({
        title: "No valid images",
        description: `Please choose images <= ${Math.round(MAX_IMAGE_UPLOAD_SIZE / 1024 / 1024)}MB.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrls = await Promise.all(validFiles.map((file) => readFileAsDataUrl(file)));
      apply(dataUrls);
      toast({
        title: "Images embedded",
        description: `${targetLabel} added ${dataUrls.length} image(s).`,
      });
    } catch (error) {
      console.error("Failed to embed images", error);
      toast({
        title: "Batch image processing failed",
        description: "Please verify the images and try again.",
        variant: "destructive",
      });
    }
  };

  const exportTemplate = () => {
    if (!selectedShop) return;

    const payload = {
      format: TEMPLATE_EXPORT_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      shop: {
        id: selectedShop.id,
        name: selectedShop.name,
        domain: selectedShop.domain,
      },
      themeEnabled,
      legacyLayout,
      theme: themeDraft,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedShop.domain || "shop"}-theme-v2-template.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Template exported",
      description: "Downloaded full theme template with data URLs.",
    });
  };

  const importTemplateFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      const parsedObject =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;

      const nextThemeRaw = parsedObject
        ? parsedObject.theme || parsedObject.themeDraft || parsedObject.layout_config_v2 || parsedObject
        : parsed;

      const nextTheme = normalizeThemeV2(nextThemeRaw);
      setThemeDraft(nextTheme);
      setSelectedSectionId(nextTheme.home.sections[0]?.id || "");
      setUndoStack([]);
      setRedoStack([]);

      if (parsedObject?.legacyLayout) {
        setLegacyLayout(parseLegacyLayout(parsedObject.legacyLayout));
      }

      if (typeof parsedObject?.themeEnabled === "boolean") {
        setThemeEnabled(parsedObject.themeEnabled);
      }

      toast({
        title: "Template imported",
        description: "Theme loaded. Save draft or publish when ready.",
      });
    } catch (error) {
      console.error("Failed to import template", error);
      toast({
        title: "Template import failed",
        description: "Invalid JSON template file.",
        variant: "destructive",
      });
    }
  };

  const exportCatalogJson = () => {
    const payload = {
      products: themeDraft.catalog.products,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `catalog-products-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Catalog exported",
      description: "Product JSON downloaded.",
    });
  };

  const importCatalogFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      const parsedObject =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;

      const productsInput = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsedObject?.products)
          ? parsedObject.products
          : Array.isArray(parsedObject?.catalog)
            ? parsedObject.catalog
            : parsedObject?.catalog &&
                typeof parsedObject.catalog === "object" &&
                !Array.isArray(parsedObject.catalog) &&
                Array.isArray((parsedObject.catalog as Record<string, unknown>).products)
              ? ((parsedObject.catalog as Record<string, unknown>).products as unknown[])
            : null;

      if (!productsInput) {
        throw new Error("Invalid products payload");
      }

      updateThemeDraft((prev) => ({
        ...prev,
        catalog: {
          ...prev.catalog,
          products: productsInput as ThemeV2["catalog"]["products"],
        },
      }));

      toast({
        title: "Catalog imported",
        description: `Imported ${productsInput.length} product(s).`,
      });
    } catch (error) {
      console.error("Failed to import catalog", error);
      toast({
        title: "Catalog import failed",
        description: "Please use a valid catalog JSON file.",
        variant: "destructive",
      });
    }
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

  const moveMediaAssetById = (fromAssetId: string, toAssetId: string) => {
    if (!fromAssetId || !toAssetId || fromAssetId === toAssetId) return;
    updateThemeDraft((prev) => {
      const fromIndex = prev.mediaLibrary.findIndex((asset) => asset.id === fromAssetId);
      const toIndex = prev.mediaLibrary.findIndex((asset) => asset.id === toAssetId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      return {
        ...prev,
        mediaLibrary: reorderList(prev.mediaLibrary, fromIndex, toIndex),
      };
    });
  };

  const onAssetDragStart = (event: DragEvent<HTMLDivElement>, assetId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", assetId);
    setDraggingAssetId(assetId);
    setAssetDropTargetId(assetId);
  };

  const onAssetDragOver = (event: DragEvent<HTMLDivElement>, assetId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (assetDropTargetId !== assetId) {
      setAssetDropTargetId(assetId);
    }
  };

  const onAssetDrop = (event: DragEvent<HTMLDivElement>, assetId: string) => {
    event.preventDefault();
    const fromAssetId = draggingAssetId || event.dataTransfer.getData("text/plain");
    moveMediaAssetById(fromAssetId, assetId);
    setDraggingAssetId(null);
    setAssetDropTargetId(null);
  };

  const onAssetDragEnd = () => {
    setDraggingAssetId(null);
    setAssetDropTargetId(null);
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

  const moveSectionById = (fromSectionId: string, toSectionId: string) => {
    if (!fromSectionId || !toSectionId || fromSectionId === toSectionId) return;
    updateThemeDraft((prev) => {
      const fromIndex = prev.home.sections.findIndex((section) => section.id === fromSectionId);
      const toIndex = prev.home.sections.findIndex((section) => section.id === toSectionId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      return {
        ...prev,
        home: {
          ...prev.home,
          sections: reorderList(prev.home.sections, fromIndex, toIndex),
        },
      };
    });
  };

  const onSectionDragStart = (event: DragEvent<HTMLDivElement>, sectionId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionId);
    setDraggingSectionId(sectionId);
    setSectionDropTargetId(sectionId);
  };

  const onSectionDragOver = (event: DragEvent<HTMLDivElement>, sectionId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (sectionDropTargetId !== sectionId) {
      setSectionDropTargetId(sectionId);
    }
  };

  const onSectionDrop = (event: DragEvent<HTMLDivElement>, sectionId: string) => {
    event.preventDefault();
    const fromSectionId = draggingSectionId || event.dataTransfer.getData("text/plain");
    moveSectionById(fromSectionId, sectionId);
    setDraggingSectionId(null);
    setSectionDropTargetId(null);
  };

  const onSectionDragEnd = () => {
    setDraggingSectionId(null);
    setSectionDropTargetId(null);
  };

  const moveHeaderNavLink = (fromIndex: number, toIndex: number) => {
    updateThemeDraft((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        navLinks: reorderList(prev.header.navLinks, fromIndex, toIndex),
      },
    }));
  };

  const onNavDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggingNavIndex(index);
    setNavDropTargetIndex(index);
  };

  const onNavDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (navDropTargetIndex !== index) {
      setNavDropTargetIndex(index);
    }
  };

  const onNavDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (draggingNavIndex == null) return;
    moveHeaderNavLink(draggingNavIndex, index);
    setDraggingNavIndex(null);
    setNavDropTargetIndex(null);
  };

  const onNavDragEnd = () => {
    setDraggingNavIndex(null);
    setNavDropTargetIndex(null);
  };

  const moveFooterSocialLink = (fromIndex: number, toIndex: number) => {
    updateThemeDraft((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        socialLinks: reorderList(prev.footer.socialLinks, fromIndex, toIndex),
      },
    }));
  };

  const onSocialDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggingSocialIndex(index);
    setSocialDropTargetIndex(index);
  };

  const onSocialDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (socialDropTargetIndex !== index) {
      setSocialDropTargetIndex(index);
    }
  };

  const onSocialDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (draggingSocialIndex == null) return;
    moveFooterSocialLink(draggingSocialIndex, index);
    setDraggingSocialIndex(null);
    setSocialDropTargetIndex(null);
  };

  const onSocialDragEnd = () => {
    setDraggingSocialIndex(null);
    setSocialDropTargetIndex(null);
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
        settings: { ...(source.settings as Record<string, unknown>) },
        visibility: { ...source.visibility },
      };
      list.splice(index + 1, 0, copy);
      setSelectedSectionId(copy.id);
      return { ...prev, home: { ...prev.home, sections: list } };
    });
  };

  const requestDeleteSection = (sectionId: string) => {
    if (themeDraft.home.sections.length <= 1) {
      toast({
        title: "无法删除",
        description: "至少需要保留一个模块。",
        variant: "destructive",
      });
      return;
    }
    setConfirmDeleteSectionId(sectionId);
  };

  const confirmDeleteSection = () => {
    const sectionId = confirmDeleteSectionId;
    setConfirmDeleteSectionId(null);
    if (!sectionId) return;
    updateThemeDraft((prev) => {
      const next = prev.home.sections.filter((section) => section.id !== sectionId);
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(next[0]?.id || "");
      }
      return { ...prev, home: { ...prev.home, sections: next } };
    });
  };

  const saveDraft = async (silent = false) => {
    if (!selectedShopId) return;
    if (!silent) setSavingDraft(true);
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
      const saved = normalizeThemeV2(data?.draft || themeDraft);
      draftSnapshotRef.current = JSON.stringify(saved);
      if (!silent) {
        setThemeDraft(saved);
        toast({ title: "草稿已保存", description: "主题草稿已成功存储。" });
      }
      setLastAutoSave(new Date());
    } catch (error) {
      console.error("Failed to save draft", error);
      if (!silent) {
        toast({ title: "保存失败", description: "草稿保存失败，请重试。", variant: "destructive" });
      }
    } finally {
      if (!silent) setSavingDraft(false);
    }
  };

  // Auto-save: debounced save 30s after last change
  useEffect(() => {
    if (!autoSaveEnabled || !selectedShopId) return;
    const currentSnapshot = JSON.stringify(themeDraft);
    if (currentSnapshot === draftSnapshotRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void saveDraft(true);
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [themeDraft, autoSaveEnabled, selectedShopId]);

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
            <SelectTrigger className="w-[220px]" title="选择要编辑装修的店铺">
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

          <div
            className="flex items-center gap-2 border rounded-md px-3 h-10"
            title="开：前台使用已发布的 Theme v2。关：前台回退使用 Legacy v1。"
          >
            <Switch checked={themeEnabled} disabled={togglingEnabled || !selectedShopId} onCheckedChange={toggleThemeEnabled} />
            <span className="text-sm">启用 v2</span>
            {togglingEnabled ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
          </div>

          <Button variant="outline" onClick={handleUndo} disabled={!canUndo} title="撤销上一步编辑">
            <Undo2 className="w-4 h-4 mr-2" />
            撤销
          </Button>
          <Button variant="outline" onClick={handleRedo} disabled={!canRedo} title="恢复刚刚撤销的编辑">
            <Redo2 className="w-4 h-4 mr-2" />
            重做
          </Button>

          <Button
            variant="outline"
            onClick={() => selectedShopId && (void loadTheme(selectedShopId))}
            disabled={!selectedShopId}
            title="从服务器重新拉取当前店铺配置"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button
            variant="outline"
            onClick={exportTemplate}
            disabled={!selectedShopId}
            title="Export full template backup (includes image data URLs)"
          >
            <Download className="w-4 h-4 mr-2" />
            导出模板
          </Button>
          <Button
            variant="outline"
            onClick={() => templateImportInputRef.current?.click()}
            disabled={!selectedShopId}
            title="Import previously exported template JSON"
          >
            <Upload className="w-4 h-4 mr-2" />
            导入模板
          </Button>
          <input
            ref={templateImportInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => void importTemplateFromFile(event)}
          />
          <Button
            variant="outline"
            onClick={() => saveDraft()}
            disabled={!selectedShopId || savingDraft || isBusy}
            title="仅保存草稿，不会立刻影响前台用户"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            保存草稿
          </Button>
          <Button
            onClick={() => setConfirmPublishOpen(true)}
            disabled={!selectedShopId || publishing || isBusy}
            title="将当前草稿发布为线上版本，前台会立即使用"
          >
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
            <TabsTrigger
              value="v2"
              className="gap-2"
              title="Theme v2：新装修系统（可视化、拖拽、发布、回滚）"
            >
              <Sparkles className="w-4 h-4" />
              Theme v2
            </TabsTrigger>
            <TabsTrigger value="legacy" title="Legacy v1：旧版布局编辑（用于兼容和回退）">
              Legacy v1
            </TabsTrigger>
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
                    title="用线上已发布版本覆盖当前草稿，适合回到稳定状态后再改"
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
                  <TabsList className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 h-auto">
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
                      <div className="text-xs text-muted-foreground">按住手柄拖拽排序</div>
                      {themeDraft.header.navLinks.map((link, index) => (
                        <div
                          key={`${link.label}-${index}`}
                          draggable
                          onDragStart={(event) => onNavDragStart(event, index)}
                          onDragOver={(event) => onNavDragOver(event, index)}
                          onDrop={(event) => onNavDrop(event, index)}
                          onDragEnd={onNavDragEnd}
                          className={cn(
                            "grid grid-cols-[auto_1fr_1fr_auto] gap-2 rounded-md border border-transparent p-1 items-center",
                            draggingNavIndex === index ? "opacity-50" : "",
                            navDropTargetIndex === index && draggingNavIndex !== index
                              ? "border-primary/60 bg-muted/40"
                              : ""
                          )}
                        >
                          <div className="cursor-grab active:cursor-grabbing px-1">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>
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
                      <div className="text-xs text-muted-foreground">按住手柄拖拽排序</div>
                      {themeDraft.footer.socialLinks.map((social, index) => (
                        <div
                          key={`${social.name}-${index}`}
                          draggable
                          onDragStart={(event) => onSocialDragStart(event, index)}
                          onDragOver={(event) => onSocialDragOver(event, index)}
                          onDrop={(event) => onSocialDrop(event, index)}
                          onDragEnd={onSocialDragEnd}
                          className={cn(
                            "grid grid-cols-[auto_1fr_1fr_auto] gap-2 rounded-md border border-transparent p-1 items-center",
                            draggingSocialIndex === index ? "opacity-50" : "",
                            socialDropTargetIndex === index && draggingSocialIndex !== index
                              ? "border-primary/60 bg-muted/40"
                              : ""
                          )}
                        >
                          <div className="cursor-grab active:cursor-grabbing px-1">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>
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
                      <Button variant="outline" size="sm" onClick={() => addSection("image_carousel")}>
                        <Plus className="w-4 h-4 mr-2" />
                        图片轮播
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("video_embed")}>
                        <Plus className="w-4 h-4 mr-2" />
                        视频嵌入
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("testimonials")}>
                        <Plus className="w-4 h-4 mr-2" />
                        客户评价
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("divider")}>
                        <Plus className="w-4 h-4 mr-2" />
                        分隔符
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("countdown_timer")}>
                        <Plus className="w-4 h-4 mr-2" />
                        倒计时
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addSection("featured_collection")}>
                        <Plus className="w-4 h-4 mr-2" />
                        精选集合
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">按住左侧手柄拖拽模块可调整前台显示顺序</div>
                      {themeDraft.home.sections.map((section, index) => (
                        <div
                          key={section.id}
                          draggable
                          onDragStart={(event) => onSectionDragStart(event, section.id)}
                          onDragOver={(event) => onSectionDragOver(event, section.id)}
                          onDrop={(event) => onSectionDrop(event, section.id)}
                          onDragEnd={onSectionDragEnd}
                          className={cn(
                            "border rounded-md transition-all",
                            selectedSectionId === section.id ? "border-primary bg-muted/40 shadow-sm" : "hover:border-muted-foreground/30",
                            draggingSectionId === section.id ? "opacity-50 scale-[0.98]" : "",
                            sectionDropTargetId === section.id && draggingSectionId !== section.id
                              ? "ring-2 ring-primary/50 border-primary/40 bg-primary/5"
                              : ""
                          )}
                        >
                          <div className="flex items-stretch">
                            <div className="flex items-center px-2 cursor-grab active:cursor-grabbing border-r bg-muted/20 rounded-l-md">
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 p-3">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <button
                                  type="button"
                                  className="text-left flex-1"
                                  onClick={() => setSelectedSectionId(section.id)}
                                >
                                  <div className="font-medium flex items-center gap-2">
                                    <Badge variant={section.enabled ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                                      {index + 1}
                                    </Badge>
                                    {sectionTypeLabel(section.type)}
                                    {!section.enabled && <span className="text-xs text-muted-foreground">(已禁用)</span>}
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-0.5 truncate max-w-[300px]">
                                    {sectionSummary(section)}
                                  </div>
                                </button>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center gap-1.5">
                                    启用
                                    <Switch
                                      checked={section.enabled}
                                      onCheckedChange={(checked) =>
                                        updateSection(section.id, (current) => ({ ...current, enabled: checked }))
                                      }
                                    />
                                  </div>
                                  <div className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center gap-1.5">
                                    <Monitor className="w-3 h-3" />
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
                                  <div className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center gap-1.5">
                                    <Smartphone className="w-3 h-3" />
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
                                  <div className="text-xs text-muted-foreground border rounded px-2 py-1 flex items-center gap-1.5">
                                    隐藏({VIEWPORT_LABEL[previewViewport]})
                                    <Switch
                                      checked={currentViewportOverride.hiddenSectionIds.includes(section.id)}
                                      onCheckedChange={(checked) => toggleHiddenInCurrentViewport(section.id, checked)}
                                    />
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => moveSection(section.id, "up")} title="上移">
                                    <ArrowUp className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => moveSection(section.id, "down")} title="下移">
                                    <ArrowDown className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => duplicateSection(section.id)} title="复制">
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => requestDeleteSection(section.id)} title="删除">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
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
                      ) : selectedSection.type === "image_carousel" ? (
                        <>
                          <div className="space-y-2">
                            <Label>标题（可选）</Label>
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
                            <Label>图片 URL 列表（每行一个）</Label>
                            <Textarea
                              rows={5}
                              placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                              value={(Array.isArray((selectedSection.settings as Record<string, unknown>).images) ? (selectedSection.settings as Record<string, unknown>).images as string[] : []).join("\n")}
                              onChange={(event) => {
                                const images = event.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), images },
                                }));
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>自动播放</Label>
                            <Switch
                              checked={Boolean((selectedSection.settings as Record<string, unknown>).autoPlay !== false)}
                              onCheckedChange={(checked) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), autoPlay: checked },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>切换间隔（秒）</Label>
                            <Input
                              type="number"
                              min={2}
                              max={15}
                              value={Number((selectedSection.settings as Record<string, unknown>).interval) || 4}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), interval: Number(event.target.value) || 4 },
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : selectedSection.type === "video_embed" ? (
                        <>
                          <div className="space-y-2">
                            <Label>标题（可选）</Label>
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
                            <Label>视频 URL</Label>
                            <Input
                              placeholder="YouTube / Vimeo 链接"
                              value={String((selectedSection.settings as Record<string, unknown>).videoUrl || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), videoUrl: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>宽高比</Label>
                            <Select
                              value={String((selectedSection.settings as Record<string, unknown>).aspectRatio || "16:9")}
                              onValueChange={(value) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), aspectRatio: value },
                                }))
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="16:9">16:9</SelectItem>
                                <SelectItem value="4:3">4:3</SelectItem>
                                <SelectItem value="1:1">1:1</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>视频说明（可选）</Label>
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).caption || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), caption: event.target.value },
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : selectedSection.type === "testimonials" ? (
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
                          <Separator />
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>评价列表</Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateSection(selectedSection.id, (section) => {
                                    const items = Array.isArray((section.settings as Record<string, unknown>).items)
                                      ? [...((section.settings as Record<string, unknown>).items as { author: string; content: string; rating: number }[])]
                                      : [];
                                    items.push({ author: "New Customer", content: "Great product!", rating: 5 });
                                    return { ...section, settings: { ...(section.settings as Record<string, unknown>), items } };
                                  })
                                }
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                添加
                              </Button>
                            </div>
                            {(Array.isArray((selectedSection.settings as Record<string, unknown>).items)
                              ? ((selectedSection.settings as Record<string, unknown>).items as { author: string; content: string; rating: number }[])
                              : []
                            ).map((item, idx) => (
                              <div key={idx} className="border rounded-md p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      updateSection(selectedSection.id, (section) => {
                                        const items = [...((section.settings as Record<string, unknown>).items as { author: string; content: string; rating: number }[])];
                                        items.splice(idx, 1);
                                        return { ...section, settings: { ...(section.settings as Record<string, unknown>), items } };
                                      })
                                    }
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                                <Input
                                  placeholder="作者"
                                  value={item.author}
                                  onChange={(event) =>
                                    updateSection(selectedSection.id, (section) => {
                                      const items = [...((section.settings as Record<string, unknown>).items as { author: string; content: string; rating: number }[])];
                                      items[idx] = { ...items[idx], author: event.target.value };
                                      return { ...section, settings: { ...(section.settings as Record<string, unknown>), items } };
                                    })
                                  }
                                />
                                <Textarea
                                  rows={2}
                                  placeholder="评价内容"
                                  value={item.content}
                                  onChange={(event) =>
                                    updateSection(selectedSection.id, (section) => {
                                      const items = [...((section.settings as Record<string, unknown>).items as { author: string; content: string; rating: number }[])];
                                      items[idx] = { ...items[idx], content: event.target.value };
                                      return { ...section, settings: { ...(section.settings as Record<string, unknown>), items } };
                                    })
                                  }
                                />
                                <Select
                                  value={String(item.rating)}
                                  onValueChange={(value) =>
                                    updateSection(selectedSection.id, (section) => {
                                      const items = [...((section.settings as Record<string, unknown>).items as { author: string; content: string; rating: number }[])];
                                      items[idx] = { ...items[idx], rating: Number(value) };
                                      return { ...section, settings: { ...(section.settings as Record<string, unknown>), items } };
                                    })
                                  }
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5].map((r) => (
                                      <SelectItem key={r} value={String(r)}>{"★".repeat(r)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : selectedSection.type === "divider" ? (
                        <>
                          <div className="space-y-2">
                            <Label>样式</Label>
                            <Select
                              value={String((selectedSection.settings as Record<string, unknown>).style || "line")}
                              onValueChange={(value) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), style: value },
                                }))
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="line">线条</SelectItem>
                                <SelectItem value="space">空白间距</SelectItem>
                                <SelectItem value="dots">圆点</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>高度 (px)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={120}
                              value={Number((selectedSection.settings as Record<string, unknown>).height) || 1}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), height: Number(event.target.value) || 1 },
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : selectedSection.type === "countdown_timer" ? (
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
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).subtitle || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), subtitle: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>结束日期</Label>
                            <Input
                              type="datetime-local"
                              value={String((selectedSection.settings as Record<string, unknown>).endDate || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), endDate: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>按钮文字</Label>
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).ctaText || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), ctaText: event.target.value },
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
                                  settings: { ...(section.settings as Record<string, unknown>), ctaLink: event.target.value },
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : selectedSection.type === "featured_collection" ? (
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
                            <Input
                              value={String((selectedSection.settings as Record<string, unknown>).subtitle || "")}
                              onChange={(event) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), subtitle: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>列数</Label>
                            <Select
                              value={String((selectedSection.settings as Record<string, unknown>).columns || 4)}
                              onValueChange={(value) =>
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), columns: Number(value) },
                                }))
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[2, 3, 4, 5, 6].map((c) => (
                                  <SelectItem key={c} value={String(c)}>{c} 列</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>商品 ID 列表（每行一个，留空则自动选取）</Label>
                            <Textarea
                              rows={4}
                              placeholder="prod_1&#10;prod_2&#10;prod_3"
                              value={(Array.isArray((selectedSection.settings as Record<string, unknown>).productIds) ? (selectedSection.settings as Record<string, unknown>).productIds as string[] : []).join("\n")}
                              onChange={(event) => {
                                const productIds = event.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                                updateSection(selectedSection.id, (section) => ({
                                  ...section,
                                  settings: { ...(section.settings as Record<string, unknown>), productIds },
                                }));
                              }}
                            />
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
                    <CardDescription>
                      配置集合页、商品页、支持页、公司页、结账页、优惠券页的文案和图片字段。
                    </CardDescription>
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
                      <h4 className="font-medium">支持页</h4>
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
                          value={themeDraft.pages.support.subtitle}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, support: { ...prev.pages.support, subtitle: event.target.value } },
                            }))
                          }
                          placeholder="支持页副标题"
                        />
                      </div>
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

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">公司页</h4>
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
                          value={themeDraft.pages.company.subtitle}
                          onChange={(event) =>
                            updateThemeDraft((prev) => ({
                              ...prev,
                              pages: { ...prev.pages, company: { ...prev.pages.company, subtitle: event.target.value } },
                            }))
                          }
                          placeholder="公司页副标题"
                        />
                      </div>
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

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">结账页（Checkout）</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.checkout.title}
                          onChange={(event) => updateCheckoutPage({ title: event.target.value })}
                          placeholder="页面标题"
                        />
                        <Input
                          value={themeDraft.pages.checkout.subtitle}
                          onChange={(event) => updateCheckoutPage({ subtitle: event.target.value })}
                          placeholder="页面副标题"
                        />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.checkout.shippingTitle}
                          onChange={(event) => updateCheckoutPage({ shippingTitle: event.target.value })}
                          placeholder="配送信息标题"
                        />
                        <Input
                          value={themeDraft.pages.checkout.defaultCountry}
                          onChange={(event) => updateCheckoutPage({ defaultCountry: event.target.value })}
                          placeholder="默认国家（如 United States）"
                        />
                      </div>
                      <Input
                        value={themeDraft.pages.checkout.heroImage}
                        onChange={(event) => updateCheckoutPage({ heroImage: event.target.value })}
                        placeholder="顶部图片 URL（可选）"
                      />

                      <div className="grid md:grid-cols-3 gap-3">
                        <Input
                          value={themeDraft.pages.checkout.countryLabel}
                          onChange={(event) => updateCheckoutPage({ countryLabel: event.target.value })}
                          placeholder="国家字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.firstNameLabel}
                          onChange={(event) => updateCheckoutPage({ firstNameLabel: event.target.value })}
                          placeholder="名字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.lastNameLabel}
                          onChange={(event) => updateCheckoutPage({ lastNameLabel: event.target.value })}
                          placeholder="姓字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.addressLabel}
                          onChange={(event) => updateCheckoutPage({ addressLabel: event.target.value })}
                          placeholder="地址字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.addressPlaceholder}
                          onChange={(event) => updateCheckoutPage({ addressPlaceholder: event.target.value })}
                          placeholder="地址占位文案"
                        />
                        <Input
                          value={themeDraft.pages.checkout.cityLabel}
                          onChange={(event) => updateCheckoutPage({ cityLabel: event.target.value })}
                          placeholder="城市字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.stateLabel}
                          onChange={(event) => updateCheckoutPage({ stateLabel: event.target.value })}
                          placeholder="州/省字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.statePlaceholder}
                          onChange={(event) => updateCheckoutPage({ statePlaceholder: event.target.value })}
                          placeholder="州/省占位文案"
                        />
                        <Input
                          value={themeDraft.pages.checkout.zipCodeLabel}
                          onChange={(event) => updateCheckoutPage({ zipCodeLabel: event.target.value })}
                          placeholder="邮编字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.phoneLabel}
                          onChange={(event) => updateCheckoutPage({ phoneLabel: event.target.value })}
                          placeholder="手机字段名"
                        />
                        <Input
                          value={themeDraft.pages.checkout.emailLabel}
                          onChange={(event) => updateCheckoutPage({ emailLabel: event.target.value })}
                          placeholder="邮箱字段名"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.checkout.summaryTitle}
                          onChange={(event) => updateCheckoutPage({ summaryTitle: event.target.value })}
                          placeholder="订单摘要标题"
                        />
                        <Input
                          value={themeDraft.pages.checkout.subtotalLabel}
                          onChange={(event) => updateCheckoutPage({ subtotalLabel: event.target.value })}
                          placeholder="小计文案"
                        />
                        <Input
                          value={themeDraft.pages.checkout.shippingLabel}
                          onChange={(event) => updateCheckoutPage({ shippingLabel: event.target.value })}
                          placeholder="配送文案"
                        />
                        <Input
                          value={themeDraft.pages.checkout.shippingValueText}
                          onChange={(event) => updateCheckoutPage({ shippingValueText: event.target.value })}
                          placeholder="配送金额文案（如 Free）"
                        />
                        <Input
                          value={themeDraft.pages.checkout.totalLabel}
                          onChange={(event) => updateCheckoutPage({ totalLabel: event.target.value })}
                          placeholder="总计文案"
                        />
                        <Input
                          value={themeDraft.pages.checkout.placeOrderText}
                          onChange={(event) => updateCheckoutPage({ placeOrderText: event.target.value })}
                          placeholder="提交按钮文案"
                        />
                      </div>
                      <Textarea
                        value={themeDraft.pages.checkout.agreementText}
                        onChange={(event) => updateCheckoutPage({ agreementText: event.target.value })}
                        placeholder="下单协议提示文案"
                        rows={2}
                      />
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.checkout.emptyCartTitle}
                          onChange={(event) => updateCheckoutPage({ emptyCartTitle: event.target.value })}
                          placeholder="空购物车标题"
                        />
                        <Input
                          value={themeDraft.pages.checkout.emptyCartButtonText}
                          onChange={(event) => updateCheckoutPage({ emptyCartButtonText: event.target.value })}
                          placeholder="空购物车按钮文案"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">优惠券页（Coupon Verification）</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.coupon.title}
                          onChange={(event) => updateCouponPage({ title: event.target.value })}
                          placeholder="页面标题"
                        />
                        <Input
                          value={themeDraft.pages.coupon.subtitle}
                          onChange={(event) => updateCouponPage({ subtitle: event.target.value })}
                          placeholder="页面副标题"
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={themeDraft.pages.coupon.heroImage}
                          onChange={(event) => updateCouponPage({ heroImage: event.target.value })}
                          placeholder="顶部图片 URL（可选）"
                        />
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            void handleSingleImageInput(
                              event,
                              (dataUrl) => updateCouponPage({ heroImage: dataUrl }),
                              "Coupon hero image"
                            )
                          }
                        />
                        <div className="text-xs text-muted-foreground">
                          上传后将转换为 data URL 并随模板一起导出。
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.coupon.codeLabel}
                          onChange={(event) => updateCouponPage({ codeLabel: event.target.value })}
                          placeholder="优惠券字段名"
                        />
                        <Input
                          value={themeDraft.pages.coupon.codePlaceholder}
                          onChange={(event) => updateCouponPage({ codePlaceholder: event.target.value })}
                          placeholder="优惠券占位文案"
                        />
                        <Input
                          value={themeDraft.pages.coupon.dateLabel}
                          onChange={(event) => updateCouponPage({ dateLabel: event.target.value })}
                          placeholder="日期字段名"
                        />
                        <Input
                          value={themeDraft.pages.coupon.datePlaceholder}
                          onChange={(event) => updateCouponPage({ datePlaceholder: event.target.value })}
                          placeholder="日期占位文案"
                        />
                        <Input
                          value={themeDraft.pages.coupon.passwordLabel}
                          onChange={(event) => updateCouponPage({ passwordLabel: event.target.value })}
                          placeholder="密码字段名"
                        />
                        <Input
                          value={themeDraft.pages.coupon.passwordPlaceholder}
                          onChange={(event) => updateCouponPage({ passwordPlaceholder: event.target.value })}
                          placeholder="密码占位文案"
                        />
                        <Input
                          value={themeDraft.pages.coupon.submitText}
                          onChange={(event) => updateCouponPage({ submitText: event.target.value })}
                          placeholder="提交按钮文案"
                        />
                        <Input
                          value={themeDraft.pages.coupon.loadingTitle}
                          onChange={(event) => updateCouponPage({ loadingTitle: event.target.value })}
                          placeholder="加载标题文案"
                        />
                      </div>

                      <Textarea
                        value={themeDraft.pages.coupon.loadingDescription}
                        onChange={(event) => updateCouponPage({ loadingDescription: event.target.value })}
                        placeholder="加载描述文案"
                        rows={2}
                      />
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.coupon.rejectedTitle}
                          onChange={(event) => updateCouponPage({ rejectedTitle: event.target.value })}
                          placeholder="校验失败弹窗标题"
                        />
                        <Input
                          value={themeDraft.pages.coupon.returnTitle}
                          onChange={(event) => updateCouponPage({ returnTitle: event.target.value })}
                          placeholder="要求重填弹窗标题"
                        />
                      </div>
                      <Textarea
                        value={themeDraft.pages.coupon.rejectedMessage}
                        onChange={(event) => updateCouponPage({ rejectedMessage: event.target.value })}
                        placeholder="校验失败提示文案"
                        rows={2}
                      />
                      <Textarea
                        value={themeDraft.pages.coupon.returnMessage}
                        onChange={(event) => updateCouponPage({ returnMessage: event.target.value })}
                        placeholder="重填提示文案"
                        rows={2}
                      />
                      <Textarea
                        value={themeDraft.pages.coupon.helpText}
                        onChange={(event) => updateCouponPage({ helpText: event.target.value })}
                        placeholder="底部帮助文案（可选）"
                        rows={2}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">PIN 验证页（PIN Verification）</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.pin.title}
                          onChange={(event) => updatePinPage({ title: event.target.value })}
                          placeholder="页面标题"
                        />
                        <Input
                          value={themeDraft.pages.pin.subtitle}
                          onChange={(event) => updatePinPage({ subtitle: event.target.value })}
                          placeholder="页面副标题"
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={themeDraft.pages.pin.heroImage}
                          onChange={(event) => updatePinPage({ heroImage: event.target.value })}
                          placeholder="顶部图片 URL（可选）"
                        />
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            void handleSingleImageInput(
                              event,
                              (dataUrl) => updatePinPage({ heroImage: dataUrl }),
                              "PIN hero image"
                            )
                          }
                        />
                        <div className="text-xs text-muted-foreground">
                          上传后将转换为 data URL 并随模板一起导出。
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={themeDraft.pages.pin.codeLabel}
                          onChange={(event) => updatePinPage({ codeLabel: event.target.value })}
                          placeholder="PIN 字段名"
                        />
                        <Input
                          value={themeDraft.pages.pin.codePlaceholder}
                          onChange={(event) => updatePinPage({ codePlaceholder: event.target.value })}
                          placeholder="PIN 占位文案"
                        />
                        <Input
                          value={themeDraft.pages.pin.submitText}
                          onChange={(event) => updatePinPage({ submitText: event.target.value })}
                          placeholder="提交按钮文案"
                        />
                        <Input
                          value={themeDraft.pages.pin.submittingText}
                          onChange={(event) => updatePinPage({ submittingText: event.target.value })}
                          placeholder="提交中按钮文案"
                        />
                        <Input
                          value={themeDraft.pages.pin.loadingTitle}
                          onChange={(event) => updatePinPage({ loadingTitle: event.target.value })}
                          placeholder="加载标题"
                        />
                      </div>
                      <Textarea
                        value={themeDraft.pages.pin.loadingDescription}
                        onChange={(event) => updatePinPage({ loadingDescription: event.target.value })}
                        placeholder="加载描述"
                        rows={2}
                      />
                      <Textarea
                        value={themeDraft.pages.pin.invalidCodeMessage}
                        onChange={(event) => updatePinPage({ invalidCodeMessage: event.target.value })}
                        placeholder="无效 PIN 提示文案"
                        rows={2}
                      />
                      <Textarea
                        value={themeDraft.pages.pin.rejectedMessage}
                        onChange={(event) => updatePinPage({ rejectedMessage: event.target.value })}
                        placeholder="校验失败提示文案"
                        rows={2}
                      />
                      <Textarea
                        value={themeDraft.pages.pin.helpText}
                        onChange={(event) => updatePinPage({ helpText: event.target.value })}
                        placeholder="底部帮助文案（可选）"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>商品目录（Theme v2）</CardTitle>
                    <CardDescription>可编辑商品文案、主图、图库，并支持 JSON 导入导出。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={exportCatalogJson}>
                        <Download className="w-4 h-4 mr-2" />
                        导出商品
                      </Button>
                      <Button variant="outline" onClick={() => productImportInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        导入商品
                      </Button>
                      <Button onClick={addCatalogProduct}>
                        <Plus className="w-4 h-4 mr-2" />
                        新增商品
                      </Button>
                    </div>
                    <input
                      ref={productImportInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(event) => void importCatalogFromFile(event)}
                    />
                    <div className="space-y-4">
                      {themeDraft.catalog.products.map((product, index) => (
                        <div key={product.id} className="border rounded-md p-3 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="outline">{product.id}</Badge>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => moveCatalogProduct(product.id, "up")}
                                disabled={index === 0}
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => moveCatalogProduct(product.id, "down")}
                                disabled={index === themeDraft.catalog.products.length - 1}
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCatalogProduct(product.id)}
                                disabled={themeDraft.catalog.products.length <= 1}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <Input
                              value={product.title}
                              onChange={(event) => updateCatalogProduct(product.id, { title: event.target.value })}
                              placeholder="商品标题"
                            />
                            <Input
                              value={product.category}
                              onChange={(event) => updateCatalogProduct(product.id, { category: event.target.value })}
                              placeholder="分类"
                            />
                            <Input
                              value={product.displayPrice}
                              onChange={(event) => updateCatalogProduct(product.id, { displayPrice: event.target.value })}
                              placeholder="显示价格（如 $29.99）"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={product.price}
                              onChange={(event) => updateCatalogProductNumber(product.id, "price", event.target.value)}
                              placeholder="数字价格"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={product.rating}
                              onChange={(event) => updateCatalogProductNumber(product.id, "rating", event.target.value)}
                              placeholder="评分（0-5）"
                            />
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              value={product.reviews}
                              onChange={(event) => updateCatalogProductNumber(product.id, "reviews", event.target.value)}
                              placeholder="评论数"
                            />
                          </div>
                          <Textarea
                            value={product.description}
                            onChange={(event) => updateCatalogProduct(product.id, { description: event.target.value })}
                            placeholder="商品描述"
                            rows={2}
                          />
                          <div className="space-y-2">
                            <Input
                              value={product.image}
                              onChange={(event) => setCatalogProductCoverImage(product.id, event.target.value)}
                              placeholder="封面图 URL"
                            />
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                void handleSingleImageInput(
                                  event,
                                  (dataUrl) => setCatalogProductCoverImage(product.id, dataUrl),
                                  `${product.title} cover`
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Textarea
                              value={product.images.join("\n")}
                              onChange={(event) => setCatalogProductImagesFromText(product.id, event.target.value)}
                              placeholder="每行一个图库图片 URL"
                              rows={3}
                            />
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(event) =>
                                void handleMultiImageInput(
                                  event,
                                  (dataUrls) =>
                                    updateCatalogProduct(product.id, {
                                      images: [...product.images, ...dataUrls],
                                      image: product.image || dataUrls[0] || "",
                                    }),
                                  `${product.title} gallery`
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
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
                      <div className="text-xs text-muted-foreground">按住手柄拖拽排序素材</div>
                      {themeDraft.mediaLibrary.length === 0 ? (
                        <div className="text-sm text-muted-foreground">暂无素材</div>
                      ) : (
                        themeDraft.mediaLibrary.map((asset) => (
                          <div
                            key={asset.id}
                            draggable
                            onDragStart={(event) => onAssetDragStart(event, asset.id)}
                            onDragOver={(event) => onAssetDragOver(event, asset.id)}
                            onDrop={(event) => onAssetDrop(event, asset.id)}
                            onDragEnd={onAssetDragEnd}
                            className={cn(
                              "border rounded-md p-2 flex items-center gap-2 transition-colors",
                              draggingAssetId === asset.id ? "opacity-50" : "",
                              assetDropTargetId === asset.id && draggingAssetId !== asset.id
                                ? "ring-2 ring-primary/50 bg-muted/40"
                                : ""
                            )}
                          >
                            <div className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                            </div>
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
                            onClick={() => { setConfirmRollbackVersionId(version.id); setConfirmRollbackOpen(true); }}
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

      {/* Auto-save indicator */}
      {autoSaveEnabled && lastAutoSave && (
        <div className="fixed bottom-4 right-4 bg-muted/80 backdrop-blur text-xs text-muted-foreground px-3 py-1.5 rounded-full shadow-sm z-50">
          自动保存: {lastAutoSave.toLocaleTimeString()}
        </div>
      )}

      {/* Confirmation: Publish */}
      <AlertDialog open={confirmPublishOpen} onOpenChange={setConfirmPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发布</AlertDialogTitle>
            <AlertDialogDescription>
              发布后当前草稿将成为线上版本，前台用户会立即看到更改。确定要发布吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmPublishOpen(false); void publishTheme(); }}>
              确认发布
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Rollback */}
      <AlertDialog open={confirmRollbackOpen} onOpenChange={setConfirmRollbackOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回滚</AlertDialogTitle>
            <AlertDialogDescription>
              回滚将恢复到选定的历史版本，并立即发布为新版本。当前草稿中未保存的更改将丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmRollbackVersionId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRollbackOpen(false);
                if (confirmRollbackVersionId != null) {
                  void rollbackVersion(confirmRollbackVersionId);
                  setConfirmRollbackVersionId(null);
                }
              }}
            >
              确认回滚
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Delete Section */}
      <AlertDialog open={confirmDeleteSectionId != null} onOpenChange={(open) => { if (!open) setConfirmDeleteSectionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模块</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该模块的配置将丢失（可通过撤销恢复）。确定要删除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSection}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

