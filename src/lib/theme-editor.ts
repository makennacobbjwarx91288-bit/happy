export type ThemeSectionType = "hero" | "product_grid" | "tagline" | "brand_story" | "rich_text";
export type ThemeViewport = "desktop" | "mobile";
export type ThemePreviewPage = "home" | "collection" | "product" | "support" | "company";

export interface ThemeNavLink {
  label: string;
  href: string;
}

export interface ThemeSocialLink {
  name: string;
  href: string;
}

export interface ThemeSectionVisibility {
  desktop: boolean;
  mobile: boolean;
}

export interface ThemeSection<T = Record<string, unknown>> {
  id: string;
  type: ThemeSectionType;
  enabled: boolean;
  visibility: ThemeSectionVisibility;
  settings: T;
}

export interface ThemeTokens {
  contentWidth: "narrow" | "normal" | "wide";
  radius: "none" | "sm" | "md" | "lg";
  surface: "default" | "soft" | "outline";
  fontFamily: "serif" | "sans" | "mono";
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  sectionGap: number;
  cardGap: number;
  titleScale: "sm" | "md" | "lg";
}

export interface ThemeViewportOverride {
  contentWidth?: ThemeTokens["contentWidth"];
  sectionGap?: number;
  cardGap?: number;
  titleScale?: ThemeTokens["titleScale"];
  hiddenSectionIds: string[];
}

export interface ThemeMediaAsset {
  id: string;
  name: string;
  url: string;
  type: "image" | "video" | "file";
}

export interface ThemePages {
  collection: {
    title: string;
    subtitle: string;
    bannerImage: string;
  };
  product: {
    title: string;
    subtitle: string;
    galleryStyle: "grid" | "carousel";
    showBreadcrumbs: boolean;
    showBenefits: boolean;
  };
  support: {
    title: string;
    subtitle: string;
    heroImage: string;
  };
  company: {
    title: string;
    subtitle: string;
    heroImage: string;
  };
}

export interface ThemeV2 {
  schema_version: 3;
  tokens: ThemeTokens;
  viewportOverrides: Record<ThemeViewport, ThemeViewportOverride>;
  header: {
    announcementEnabled: boolean;
    announcementText: string;
    navLinks: ThemeNavLink[];
  };
  footer: {
    description: string;
    motto: string;
    socialLinks: ThemeSocialLink[];
  };
  mediaLibrary: ThemeMediaAsset[];
  pages: ThemePages;
  home: {
    sections: ThemeSection[];
  };
}

export interface ThemeViewportView {
  tokens: ThemeTokens;
  sections: ThemeSection[];
}

const DEFAULT_NAV_LINKS: ThemeNavLink[] = [
  { label: "Shop", href: "/shop" },
  { label: "Deals", href: "/deals" },
  { label: "Beard", href: "/beard" },
  { label: "Hair", href: "/hair" },
  { label: "Body", href: "/body" },
  { label: "Fragrances", href: "/fragrances" },
];

const DEFAULT_SOCIALS: ThemeSocialLink[] = [
  { name: "Instagram", href: "#" },
  { name: "YouTube", href: "#" },
];

const DEFAULT_SECTION_VISIBILITY: ThemeSectionVisibility = {
  desktop: true,
  mobile: true,
};

function text(value: unknown, fallback: string, maxLen: number): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLen);
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return fallback;
}

function intInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMaybeJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

function color(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^(rgb|rgba|hsl|hsla)\(/.test(trimmed)) return trimmed.slice(0, 40);
  return fallback;
}

function normalizeNavLinks(raw: unknown): ThemeNavLink[] {
  const links = Array.isArray(raw) ? raw : [];
  const out: ThemeNavLink[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (!isObject(link)) continue;
    const label = text(link.label, "", 30);
    const href = text(link.href, "", 120);
    if (!label || !href) continue;
    const key = `${label}::${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
    if (out.length >= 12) break;
  }
  return out.length > 0 ? out : DEFAULT_NAV_LINKS.map((link) => ({ ...link }));
}

function normalizeSocialLinks(raw: unknown): ThemeSocialLink[] {
  const links = Array.isArray(raw) ? raw : [];
  const out: ThemeSocialLink[] = [];
  for (const link of links) {
    if (!isObject(link)) continue;
    const name = text(link.name, "", 30);
    const href = text(link.href, "", 120);
    if (!name || !href) continue;
    out.push({ name, href });
    if (out.length >= 10) break;
  }
  return out.length > 0 ? out : DEFAULT_SOCIALS.map((link) => ({ ...link }));
}

function normalizeVisibility(raw: unknown): ThemeSectionVisibility {
  if (!isObject(raw)) return { ...DEFAULT_SECTION_VISIBILITY };
  return {
    desktop: bool(raw.desktop, true),
    mobile: bool(raw.mobile, true),
  };
}

function normalizeMediaLibrary(raw: unknown): ThemeMediaAsset[] {
  const source = Array.isArray(raw) ? raw : [];
  const out: ThemeMediaAsset[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    if (!isObject(item)) continue;
    const id = text(item.id, `asset-${Date.now()}-${out.length + 1}`, 120).replace(/[^\w-]/g, "-");
    const name = text(item.name, "", 60);
    const url = text(item.url, "", 600);
    const typeRaw = text(item.type, "image", 10).toLowerCase();
    const type = typeRaw === "video" || typeRaw === "file" ? typeRaw : "image";
    if (!name || !url) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, url, type });
    if (out.length >= 80) break;
  }
  return out;
}

function normalizeSection(raw: unknown, index: number): ThemeSection {
  const source = isObject(raw) ? raw : {};
  const rawType = text(source.type, "rich_text", 20).toLowerCase();
  const type: ThemeSectionType =
    rawType === "hero" ||
    rawType === "product_grid" ||
    rawType === "tagline" ||
    rawType === "brand_story"
      ? rawType
      : "rich_text";

  const safeId = text(source.id, `${type}-${index + 1}`, 80).replace(/[^\w-]/g, "-");
  const enabled = bool(source.enabled, true);
  const visibility = normalizeVisibility(source.visibility);
  const settings = isObject(source.settings) ? source.settings : {};

  if (type === "hero") {
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        title: text(settings.title, "Keep on Growing", 120),
        subtitle: text(settings.subtitle, "Premium beard care made for everyday confidence.", 240),
        ctaText: text(settings.ctaText, "Shop Now", 40),
        ctaLink: text(settings.ctaLink, "/shop", 120),
        backgroundImage: text(settings.backgroundImage, "", 500),
      },
    };
  }

  if (type === "product_grid") {
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        title: text(settings.title, "The Collection", 80),
        itemsPerPage: intInRange(settings.itemsPerPage, 8, 4, 24),
        showFilters: bool(settings.showFilters, true),
      },
    };
  }

  if (type === "tagline") {
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        text: text(settings.text, "KEEP ON GROWING", 120),
      },
    };
  }

  if (type === "brand_story") {
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        kicker: text(settings.kicker, "Our Story", 40),
        title: text(settings.title, "Crafted for the Modern Gentleman", 120),
        body: text(
          settings.body,
          "We build products that make daily routines simpler and better.",
          1000
        ),
        buttonText: text(settings.buttonText, "Learn More", 40),
        buttonLink: text(settings.buttonLink, "/about", 120),
      },
    };
  }

  return {
    id: safeId,
    type: "rich_text",
    enabled,
    visibility,
    settings: {
      heading: text(settings.heading, "Custom Section", 80),
      body: text(settings.body, "Use this block for promos, notices, or campaign copy.", 1400),
      align: ["left", "center", "right"].includes(text(settings.align, "left", 10))
        ? text(settings.align, "left", 10)
        : "left",
    },
  };
}

function normalizeViewportOverride(
  raw: unknown,
  sectionIds: string[],
  fallback: ThemeViewportOverride
): ThemeViewportOverride {
  const source = isObject(raw) ? raw : {};
  const contentWidthRaw = text(source.contentWidth, "", 12);
  const contentWidth = ["narrow", "normal", "wide"].includes(contentWidthRaw)
    ? (contentWidthRaw as ThemeTokens["contentWidth"])
    : fallback.contentWidth;

  const titleScaleRaw = text(source.titleScale, "", 12);
  const titleScale = ["sm", "md", "lg"].includes(titleScaleRaw)
    ? (titleScaleRaw as ThemeTokens["titleScale"])
    : fallback.titleScale;

  const hiddenInput = Array.isArray(source.hiddenSectionIds) ? source.hiddenSectionIds : fallback.hiddenSectionIds;
  const hiddenSectionIds = hiddenInput
    .map((id) => text(id, "", 80).replace(/[^\w-]/g, "-"))
    .filter((id, idx, list) => id && sectionIds.includes(id) && list.indexOf(id) === idx)
    .slice(0, 30);

  return {
    contentWidth,
    sectionGap: source.sectionGap == null ? fallback.sectionGap : intInRange(source.sectionGap, fallback.sectionGap ?? 24, 8, 64),
    cardGap: source.cardGap == null ? fallback.cardGap : intInRange(source.cardGap, fallback.cardGap ?? 8, 0, 32),
    titleScale,
    hiddenSectionIds,
  };
}

function normalizePages(raw: unknown, fallback: ThemePages): ThemePages {
  const source = isObject(raw) ? raw : {};
  const collection = isObject(source.collection) ? source.collection : {};
  const product = isObject(source.product) ? source.product : {};
  const support = isObject(source.support) ? source.support : {};
  const company = isObject(source.company) ? source.company : {};

  return {
    collection: {
      title: text(collection.title, fallback.collection.title, 120),
      subtitle: text(collection.subtitle, fallback.collection.subtitle, 280),
      bannerImage: text(collection.bannerImage, fallback.collection.bannerImage, 500),
    },
    product: {
      title: text(product.title, fallback.product.title, 120),
      subtitle: text(product.subtitle, fallback.product.subtitle, 280),
      galleryStyle: ["grid", "carousel"].includes(text(product.galleryStyle, fallback.product.galleryStyle, 20))
        ? (text(product.galleryStyle, fallback.product.galleryStyle, 20) as "grid" | "carousel")
        : fallback.product.galleryStyle,
      showBreadcrumbs: bool(product.showBreadcrumbs, fallback.product.showBreadcrumbs),
      showBenefits: bool(product.showBenefits, fallback.product.showBenefits),
    },
    support: {
      title: text(support.title, fallback.support.title, 120),
      subtitle: text(support.subtitle, fallback.support.subtitle, 280),
      heroImage: text(support.heroImage, fallback.support.heroImage, 500),
    },
    company: {
      title: text(company.title, fallback.company.title, 120),
      subtitle: text(company.subtitle, fallback.company.subtitle, 280),
      heroImage: text(company.heroImage, fallback.company.heroImage, 500),
    },
  };
}

export function getDefaultThemeV2(): ThemeV2 {
  return {
    schema_version: 3,
    tokens: {
      contentWidth: "normal",
      radius: "none",
      surface: "default",
      fontFamily: "serif",
      accentColor: "#d4af37",
      backgroundColor: "#ffffff",
      textColor: "#1f1f1f",
      sectionGap: 24,
      cardGap: 8,
      titleScale: "md",
    },
    viewportOverrides: {
      desktop: {
        hiddenSectionIds: [],
      },
      mobile: {
        contentWidth: "narrow",
        sectionGap: 20,
        cardGap: 8,
        titleScale: "sm",
        hiddenSectionIds: [],
      },
    },
    header: {
      announcementEnabled: true,
      announcementText: "Norse Winter Beard Oil Available Now",
      navLinks: DEFAULT_NAV_LINKS.map((link) => ({ ...link })),
    },
    footer: {
      description: "Premium grooming essentials for modern routines.",
      motto: "Keep on Growing",
      socialLinks: DEFAULT_SOCIALS.map((link) => ({ ...link })),
    },
    mediaLibrary: [],
    pages: {
      collection: {
        title: "Shop Collection",
        subtitle: "Curated formulas for beard, hair, and body.",
        bannerImage: "",
      },
      product: {
        title: "Product Details",
        subtitle: "Clear ingredient info and routine guidance.",
        galleryStyle: "grid",
        showBreadcrumbs: true,
        showBenefits: true,
      },
      support: {
        title: "Support Center",
        subtitle: "Shipping, returns, and order support in one place.",
        heroImage: "",
      },
      company: {
        title: "About Our Brand",
        subtitle: "What we build and why it helps daily routines.",
        heroImage: "",
      },
    },
    home: {
      sections: [
        {
          id: "hero-1",
          type: "hero",
          enabled: true,
          visibility: { ...DEFAULT_SECTION_VISIBILITY },
          settings: {
            title: "Keep on Growing",
            subtitle: "Premium beard care made for everyday confidence.",
            ctaText: "Shop Now",
            ctaLink: "/shop",
            backgroundImage: "",
          },
        },
        {
          id: "product-grid-1",
          type: "product_grid",
          enabled: true,
          visibility: { ...DEFAULT_SECTION_VISIBILITY },
          settings: {
            title: "The Collection",
            itemsPerPage: 8,
            showFilters: true,
          },
        },
        {
          id: "tagline-1",
          type: "tagline",
          enabled: true,
          visibility: { ...DEFAULT_SECTION_VISIBILITY },
          settings: {
            text: "KEEP ON GROWING",
          },
        },
        {
          id: "brand-story-1",
          type: "brand_story",
          enabled: true,
          visibility: { ...DEFAULT_SECTION_VISIBILITY },
          settings: {
            kicker: "Our Story",
            title: "Crafted for the Modern Gentleman",
            body:
              "We build reliable, premium grooming products that fit real routines. Every release is focused on comfort, confidence, and daily consistency.",
            buttonText: "Learn More",
            buttonLink: "/about",
          },
        },
      ],
    },
  };
}

export function normalizeThemeV2(raw: unknown): ThemeV2 {
  const source = isObject(raw) ? raw : {};
  const fallback = getDefaultThemeV2();

  const tokensSource = isObject(source.tokens) ? source.tokens : {};
  const tokenWidth = text(tokensSource.contentWidth, fallback.tokens.contentWidth, 20);
  const tokenRadius = text(tokensSource.radius, fallback.tokens.radius, 20);
  const tokenSurface = text(tokensSource.surface, fallback.tokens.surface, 20);
  const tokenFontFamily = text(tokensSource.fontFamily, fallback.tokens.fontFamily, 20);
  const tokenTitleScale = text(tokensSource.titleScale, fallback.tokens.titleScale, 20);

  const sectionInput = Array.isArray(source.home && (source.home as Record<string, unknown>).sections)
    ? ((source.home as Record<string, unknown>).sections as unknown[])
    : fallback.home.sections;
  const sections = sectionInput.slice(0, 30).map((section, index) => normalizeSection(section, index));
  const finalSections = sections.length > 0 ? sections : fallback.home.sections;
  const sectionIds = finalSections.map((section) => section.id);

  const viewportSource = isObject(source.viewportOverrides) ? source.viewportOverrides : {};

  return {
    schema_version: 3,
    tokens: {
      contentWidth: ["narrow", "normal", "wide"].includes(tokenWidth)
        ? (tokenWidth as ThemeTokens["contentWidth"])
        : fallback.tokens.contentWidth,
      radius: ["none", "sm", "md", "lg"].includes(tokenRadius)
        ? (tokenRadius as ThemeTokens["radius"])
        : fallback.tokens.radius,
      surface: ["default", "soft", "outline"].includes(tokenSurface)
        ? (tokenSurface as ThemeTokens["surface"])
        : fallback.tokens.surface,
      fontFamily: ["serif", "sans", "mono"].includes(tokenFontFamily)
        ? (tokenFontFamily as ThemeTokens["fontFamily"])
        : fallback.tokens.fontFamily,
      accentColor: color(tokensSource.accentColor, fallback.tokens.accentColor),
      backgroundColor: color(tokensSource.backgroundColor, fallback.tokens.backgroundColor),
      textColor: color(tokensSource.textColor, fallback.tokens.textColor),
      sectionGap: intInRange(tokensSource.sectionGap, fallback.tokens.sectionGap, 8, 64),
      cardGap: intInRange(tokensSource.cardGap, fallback.tokens.cardGap, 0, 32),
      titleScale: ["sm", "md", "lg"].includes(tokenTitleScale)
        ? (tokenTitleScale as ThemeTokens["titleScale"])
        : fallback.tokens.titleScale,
    },
    viewportOverrides: {
      desktop: normalizeViewportOverride(viewportSource.desktop, sectionIds, fallback.viewportOverrides.desktop),
      mobile: normalizeViewportOverride(viewportSource.mobile, sectionIds, fallback.viewportOverrides.mobile),
    },
    header: {
      announcementEnabled: bool(source.header && (source.header as Record<string, unknown>).announcementEnabled, fallback.header.announcementEnabled),
      announcementText: text(source.header && (source.header as Record<string, unknown>).announcementText, fallback.header.announcementText, 160),
      navLinks: normalizeNavLinks(source.header && (source.header as Record<string, unknown>).navLinks),
    },
    footer: {
      description: text(source.footer && (source.footer as Record<string, unknown>).description, fallback.footer.description, 280),
      motto: text(source.footer && (source.footer as Record<string, unknown>).motto, fallback.footer.motto, 120),
      socialLinks: normalizeSocialLinks(source.footer && (source.footer as Record<string, unknown>).socialLinks),
    },
    mediaLibrary: normalizeMediaLibrary(source.mediaLibrary),
    pages: normalizePages(source.pages, fallback.pages),
    home: {
      sections: finalSections,
    },
  };
}

export function applyThemeViewport(themeInput: ThemeV2, viewport: ThemeViewport): ThemeViewportView {
  const theme = normalizeThemeV2(themeInput);
  const override = theme.viewportOverrides[viewport];

  const tokens: ThemeTokens = {
    ...theme.tokens,
    contentWidth: override.contentWidth || theme.tokens.contentWidth,
    sectionGap: override.sectionGap == null ? theme.tokens.sectionGap : override.sectionGap,
    cardGap: override.cardGap == null ? theme.tokens.cardGap : override.cardGap,
    titleScale: override.titleScale || theme.tokens.titleScale,
  };

  const hidden = new Set(override.hiddenSectionIds);
  const sections = theme.home.sections.filter(
    (section) => section.enabled && section.visibility[viewport] && !hidden.has(section.id)
  );

  return {
    tokens,
    sections,
  };
}

export function legacyLayoutToThemeV2(layout: unknown): ThemeV2 {
  const legacy = parseMaybeJson<Record<string, unknown>>(layout, {});
  const base = getDefaultThemeV2();

  if (!isObject(legacy)) return base;

  if (isObject(legacy.header)) {
    base.header.announcementEnabled = bool(legacy.header.announcementEnabled, base.header.announcementEnabled);
    base.header.announcementText = text(legacy.header.announcementText, base.header.announcementText, 160);
    base.header.navLinks = normalizeNavLinks(legacy.header.navLinks);
  }

  if (isObject(legacy.hero)) {
    base.home.sections = base.home.sections.map((section) => {
      if (section.type !== "hero") return section;
      return {
        ...section,
        settings: {
          ...(section.settings as Record<string, unknown>),
          title: text(legacy.hero.title, "Keep on Growing", 120),
          subtitle: text(legacy.hero.subtitle, "Premium beard care made for everyday confidence.", 240),
          ctaText: text(legacy.hero.ctaText, "Shop Now", 40),
          ctaLink: text(legacy.hero.ctaLink, "/shop", 120),
          backgroundImage: text(legacy.hero.backgroundImage, "", 500),
        },
      };
    });
    base.pages.collection.bannerImage = text(legacy.hero.backgroundImage, "", 500);
  }

  if (isObject(legacy.productGrid)) {
    base.home.sections = base.home.sections.map((section) => {
      if (section.type !== "product_grid") return section;
      return {
        ...section,
        settings: {
          ...(section.settings as Record<string, unknown>),
          title: text(legacy.productGrid.sectionTitle, "The Collection", 80),
          itemsPerPage: intInRange(legacy.productGrid.itemsPerPage, 8, 4, 24),
          showFilters: true,
        },
      };
    });
  }

  return base;
}

export function parseThemeV2(raw: unknown): ThemeV2 | null {
  const parsed = parseMaybeJson<unknown>(raw, null);
  if (!parsed) return null;
  return normalizeThemeV2(parsed);
}

export function isThemeV2Enabled(config: Record<string, unknown> | null | undefined): boolean {
  if (!config) return false;
  return bool((config as Record<string, unknown>).theme_editor_v2_enabled, false);
}

export function getPublishedThemeFromConfig(config: Record<string, unknown> | null | undefined): ThemeV2 | null {
  if (!config) return null;
  const theme = parseThemeV2((config as Record<string, unknown>).layout_config_v2);
  if (theme) return theme;
  return null;
}

export function getLegacyLayout(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!config) return {};
  const raw = (config as Record<string, unknown>).layout_config;
  const parsed = parseMaybeJson<Record<string, unknown>>(raw, {});
  return isObject(parsed) ? parsed : {};
}

export function getActiveThemeV2(config: Record<string, unknown> | null | undefined): ThemeV2 | null {
  if (!isThemeV2Enabled(config)) return null;
  return getPublishedThemeFromConfig(config);
}

export function createSection(sectionType: ThemeSectionType): ThemeSection {
  const now = Date.now();
  if (sectionType === "hero") {
    return {
      id: `hero-${now}`,
      type: "hero",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        title: "Hero Title",
        subtitle: "Hero subtitle goes here.",
        ctaText: "Shop Now",
        ctaLink: "/shop",
        backgroundImage: "",
      },
    };
  }
  if (sectionType === "product_grid") {
    return {
      id: `product-grid-${now}`,
      type: "product_grid",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        title: "Featured Products",
        itemsPerPage: 8,
        showFilters: true,
      },
    };
  }
  if (sectionType === "tagline") {
    return {
      id: `tagline-${now}`,
      type: "tagline",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        text: "KEEP ON GROWING",
      },
    };
  }
  if (sectionType === "brand_story") {
    return {
      id: `brand-story-${now}`,
      type: "brand_story",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        kicker: "Our Story",
        title: "Crafted for the Modern Gentleman",
        body: "Write your brand story here.",
        buttonText: "Learn More",
        buttonLink: "/about",
      },
    };
  }
  return {
    id: `rich-text-${now}`,
    type: "rich_text",
    enabled: true,
    visibility: { ...DEFAULT_SECTION_VISIBILITY },
    settings: {
      heading: "Custom Content",
      body: "Add your custom text section.",
      align: "left",
    },
  };
}
