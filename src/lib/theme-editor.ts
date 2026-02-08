export type ThemeSectionType = "hero" | "product_grid" | "tagline" | "brand_story" | "rich_text";

export interface ThemeNavLink {
  label: string;
  href: string;
}

export interface ThemeSocialLink {
  name: string;
  href: string;
}

export interface ThemeSection<T = Record<string, unknown>> {
  id: string;
  type: ThemeSectionType;
  enabled: boolean;
  settings: T;
}

export interface ThemeTokens {
  contentWidth: "narrow" | "normal" | "wide";
  radius: "none" | "sm" | "md" | "lg";
  surface: "default" | "soft" | "outline";
}

export interface ThemeV2 {
  schema_version: 2;
  tokens: ThemeTokens;
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
  home: {
    sections: ThemeSection[];
  };
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

function normalizeNavLinks(raw: unknown): ThemeNavLink[] {
  const links = Array.isArray(raw) ? raw : [];
  const out: ThemeNavLink[] = [];
  for (const link of links) {
    if (!isObject(link)) continue;
    const label = text(link.label, "", 30);
    const href = text(link.href, "", 120);
    if (!label || !href) continue;
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
  const settings = isObject(source.settings) ? source.settings : {};

  if (type === "hero") {
    return {
      id: safeId,
      type,
      enabled,
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
    settings: {
      heading: text(settings.heading, "Custom Section", 80),
      body: text(settings.body, "Use this block for promos, notices, or campaign copy.", 1400),
      align: ["left", "center", "right"].includes(text(settings.align, "left", 10))
        ? text(settings.align, "left", 10)
        : "left",
    },
  };
}

export function getDefaultThemeV2(): ThemeV2 {
  return {
    schema_version: 2,
    tokens: {
      contentWidth: "normal",
      radius: "none",
      surface: "default",
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
    home: {
      sections: [
        {
          id: "hero-1",
          type: "hero",
          enabled: true,
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
          settings: {
            text: "KEEP ON GROWING",
          },
        },
        {
          id: "brand-story-1",
          type: "brand_story",
          enabled: true,
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

  const tokenWidth = text(source.tokens && (source.tokens as Record<string, unknown>).contentWidth, fallback.tokens.contentWidth, 20);
  const tokenRadius = text(source.tokens && (source.tokens as Record<string, unknown>).radius, fallback.tokens.radius, 20);
  const tokenSurface = text(source.tokens && (source.tokens as Record<string, unknown>).surface, fallback.tokens.surface, 20);

  const sectionInput = Array.isArray(source.home && (source.home as Record<string, unknown>).sections)
    ? ((source.home as Record<string, unknown>).sections as unknown[])
    : fallback.home.sections;
  const sections = sectionInput.slice(0, 30).map((section, index) => normalizeSection(section, index));

  return {
    schema_version: 2,
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
    home: {
      sections: sections.length > 0 ? sections : fallback.home.sections,
    },
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
    settings: {
      heading: "Custom Content",
      body: "Add your custom text section.",
      align: "left",
    },
  };
}
