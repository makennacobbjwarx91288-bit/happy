import { products as defaultProducts } from "@/data/products";

export type ThemeSectionType = "hero" | "product_grid" | "tagline" | "brand_story" | "rich_text" | "image_carousel" | "video_embed" | "testimonials" | "divider" | "countdown_timer" | "featured_collection";
export type ThemeViewport = "desktop" | "mobile";
export type ThemePreviewPage = "home" | "collection" | "product" | "support" | "company" | "checkout" | "coupon" | "pin";

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

export interface ThemeCatalogProduct {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  displayPrice: string;
  image: string;
  images: string[];
  rating: number;
  reviews: number;
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
  checkout: {
    title: string;
    subtitle: string;
    shippingTitle: string;
    defaultCountry: string;
    countryLabel: string;
    firstNameLabel: string;
    lastNameLabel: string;
    addressLabel: string;
    addressPlaceholder: string;
    cityLabel: string;
    stateLabel: string;
    statePlaceholder: string;
    zipCodeLabel: string;
    phoneLabel: string;
    emailLabel: string;
    summaryTitle: string;
    subtotalLabel: string;
    shippingLabel: string;
    shippingValueText: string;
    totalLabel: string;
    placeOrderText: string;
    agreementText: string;
    emptyCartTitle: string;
    emptyCartButtonText: string;
    heroImage: string;
  };
  coupon: {
    title: string;
    subtitle: string;
    codeLabel: string;
    codePlaceholder: string;
    dateLabel: string;
    datePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    submitText: string;
    loadingTitle: string;
    loadingDescription: string;
    rejectedTitle: string;
    rejectedMessage: string;
    returnTitle: string;
    returnMessage: string;
    helpText: string;
    heroImage: string;
  };
  pin: {
    title: string;
    subtitle: string;
    codeLabel: string;
    codePlaceholder: string;
    submitText: string;
    submittingText: string;
    loadingTitle: string;
    loadingDescription: string;
    invalidCodeMessage: string;
    rejectedMessage: string;
    helpText: string;
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
  catalog: {
    products: ThemeCatalogProduct[];
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

const MAX_EMBEDDED_URL_LENGTH = 200_000;

const DEFAULT_THEME_PRODUCTS: ThemeCatalogProduct[] = defaultProducts.map((product) => ({
  id: product.id,
  title: product.title,
  description: product.description,
  category: product.category || "Beard",
  price: product.price,
  displayPrice: product.displayPrice,
  image: product.image,
  images: Array.isArray(product.images) && product.images.length > 0 ? [...product.images] : [product.image],
  rating: typeof product.rating === "number" ? product.rating : 4.5,
  reviews: typeof product.reviews === "number" ? product.reviews : 0,
}));

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
    const url = text(item.url, "", MAX_EMBEDDED_URL_LENGTH);
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

function normalizeCatalogProducts(raw: unknown, fallback: ThemeCatalogProduct[]): ThemeCatalogProduct[] {
  const source = Array.isArray(raw) ? raw : [];
  const out: ThemeCatalogProduct[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    if (!isObject(item)) continue;
    const id = text(item.id, `prod_${out.length + 1}`, 64).replace(/[^\w-]/g, "-");
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const image = text(item.image, "", MAX_EMBEDDED_URL_LENGTH);
    const imagesRaw = Array.isArray(item.images) ? item.images : [];
    const images = imagesRaw
      .map((value) => text(value, "", MAX_EMBEDDED_URL_LENGTH))
      .filter((value) => Boolean(value))
      .slice(0, 10);
    const finalImages = images.length > 0 ? images : image ? [image] : [];
    const finalImage = image || finalImages[0] || "/placeholder.svg";
    const price = intInRange(item.price, 0, 0, 99999);
    const ratingRaw = Number(item.rating);
    const rating = Number.isFinite(ratingRaw) ? Math.max(0, Math.min(5, Math.round(ratingRaw * 10) / 10)) : 4.5;

    out.push({
      id,
      title: text(item.title, "Untitled Product", 120),
      description: text(item.description, "", 300),
      category: text(item.category, "Beard", 40),
      price,
      displayPrice: text(item.displayPrice, `$${price}`, 40),
      image: finalImage,
      images: finalImages.length > 0 ? finalImages : [finalImage],
      rating,
      reviews: intInRange(item.reviews, 0, 0, 99999999),
    });
    if (out.length >= 120) break;
  }

  return out.length > 0 ? out : fallback.map((item) => ({ ...item, images: [...item.images] }));
}

const KNOWN_SECTION_TYPES: ThemeSectionType[] = [
  "hero", "product_grid", "tagline", "brand_story", "rich_text",
  "image_carousel", "video_embed", "testimonials", "divider",
  "countdown_timer", "featured_collection",
];

function normalizeSection(raw: unknown, index: number): ThemeSection {
  const source = isObject(raw) ? raw : {};
  const rawType = text(source.type, "rich_text", 30).toLowerCase();
  const type: ThemeSectionType = (KNOWN_SECTION_TYPES as string[]).includes(rawType)
    ? (rawType as ThemeSectionType)
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
        backgroundImage: text(settings.backgroundImage, "", MAX_EMBEDDED_URL_LENGTH),
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

  if (type === "image_carousel") {
    const imagesRaw = Array.isArray(settings.images) ? settings.images : [];
    const images = imagesRaw
      .map((v: unknown) => text(v, "", MAX_EMBEDDED_URL_LENGTH))
      .filter(Boolean)
      .slice(0, 10);
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        title: text(settings.title, "", 120),
        images,
        autoPlay: bool(settings.autoPlay, true),
        interval: intInRange(settings.interval, 4, 2, 15),
      },
    };
  }

  if (type === "video_embed") {
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        title: text(settings.title, "", 120),
        videoUrl: text(settings.videoUrl, "", MAX_EMBEDDED_URL_LENGTH),
        aspectRatio: ["16:9", "4:3", "1:1"].includes(text(settings.aspectRatio, "16:9", 10))
          ? text(settings.aspectRatio, "16:9", 10)
          : "16:9",
        caption: text(settings.caption, "", 240),
      },
    };
  }

  if (type === "testimonials") {
    const itemsRaw = Array.isArray(settings.items) ? settings.items : [];
    const items = itemsRaw
      .filter(isObject)
      .map((item: Record<string, unknown>) => ({
        author: text(item.author, "Customer", 60),
        content: text(item.content, "", 500),
        rating: intInRange(item.rating, 5, 1, 5),
      }))
      .slice(0, 12);
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        title: text(settings.title, "What Our Customers Say", 120),
        items: items.length > 0 ? items : [
          { author: "John D.", content: "Amazing products, highly recommended!", rating: 5 },
          { author: "Mike R.", content: "Best beard oil I've ever used.", rating: 5 },
          { author: "Chris S.", content: "Great quality, fast shipping.", rating: 4 },
        ],
      },
    };
  }

  if (type === "divider") {
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        style: ["line", "space", "dots"].includes(text(settings.style, "line", 10))
          ? text(settings.style, "line", 10)
          : "line",
        height: intInRange(settings.height, 1, 1, 120),
      },
    };
  }

  if (type === "countdown_timer") {
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        title: text(settings.title, "Limited Time Offer", 120),
        subtitle: text(settings.subtitle, "Don't miss out!", 240),
        endDate: text(settings.endDate, "", 30),
        ctaText: text(settings.ctaText, "Shop Now", 40),
        ctaLink: text(settings.ctaLink, "/shop", 120),
      },
    };
  }

  if (type === "featured_collection") {
    const productIdsRaw = Array.isArray(settings.productIds) ? settings.productIds : [];
    const productIds = productIdsRaw
      .map((v: unknown) => text(v, "", 80))
      .filter(Boolean)
      .slice(0, 12);
    return {
      id: safeId,
      type,
      enabled,
      visibility,
      settings: {
        title: text(settings.title, "Featured Collection", 120),
        subtitle: text(settings.subtitle, "", 240),
        productIds,
        columns: intInRange(settings.columns, 4, 2, 6),
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
  const checkout = isObject(source.checkout) ? source.checkout : {};
  const coupon = isObject(source.coupon) ? source.coupon : {};
  const pin = isObject(source.pin) ? source.pin : {};

  return {
    collection: {
      title: text(collection.title, fallback.collection.title, 120),
      subtitle: text(collection.subtitle, fallback.collection.subtitle, 280),
      bannerImage: text(collection.bannerImage, fallback.collection.bannerImage, MAX_EMBEDDED_URL_LENGTH),
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
      heroImage: text(support.heroImage, fallback.support.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    company: {
      title: text(company.title, fallback.company.title, 120),
      subtitle: text(company.subtitle, fallback.company.subtitle, 280),
      heroImage: text(company.heroImage, fallback.company.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    checkout: {
      title: text(checkout.title, fallback.checkout.title, 120),
      subtitle: text(checkout.subtitle, fallback.checkout.subtitle, 280),
      shippingTitle: text(checkout.shippingTitle, fallback.checkout.shippingTitle, 120),
      defaultCountry: text(checkout.defaultCountry, fallback.checkout.defaultCountry, 120),
      countryLabel: text(checkout.countryLabel, fallback.checkout.countryLabel, 60),
      firstNameLabel: text(checkout.firstNameLabel, fallback.checkout.firstNameLabel, 60),
      lastNameLabel: text(checkout.lastNameLabel, fallback.checkout.lastNameLabel, 60),
      addressLabel: text(checkout.addressLabel, fallback.checkout.addressLabel, 60),
      addressPlaceholder: text(checkout.addressPlaceholder, fallback.checkout.addressPlaceholder, 120),
      cityLabel: text(checkout.cityLabel, fallback.checkout.cityLabel, 60),
      stateLabel: text(checkout.stateLabel, fallback.checkout.stateLabel, 60),
      statePlaceholder: text(checkout.statePlaceholder, fallback.checkout.statePlaceholder, 24),
      zipCodeLabel: text(checkout.zipCodeLabel, fallback.checkout.zipCodeLabel, 60),
      phoneLabel: text(checkout.phoneLabel, fallback.checkout.phoneLabel, 60),
      emailLabel: text(checkout.emailLabel, fallback.checkout.emailLabel, 60),
      summaryTitle: text(checkout.summaryTitle, fallback.checkout.summaryTitle, 120),
      subtotalLabel: text(checkout.subtotalLabel, fallback.checkout.subtotalLabel, 60),
      shippingLabel: text(checkout.shippingLabel, fallback.checkout.shippingLabel, 60),
      shippingValueText: text(checkout.shippingValueText, fallback.checkout.shippingValueText, 80),
      totalLabel: text(checkout.totalLabel, fallback.checkout.totalLabel, 60),
      placeOrderText: text(checkout.placeOrderText, fallback.checkout.placeOrderText, 80),
      agreementText: text(checkout.agreementText, fallback.checkout.agreementText, 280),
      emptyCartTitle: text(checkout.emptyCartTitle, fallback.checkout.emptyCartTitle, 120),
      emptyCartButtonText: text(checkout.emptyCartButtonText, fallback.checkout.emptyCartButtonText, 80),
      heroImage: text(checkout.heroImage, fallback.checkout.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    coupon: {
      title: text(coupon.title, fallback.coupon.title, 120),
      subtitle: text(coupon.subtitle, fallback.coupon.subtitle, 280),
      codeLabel: text(coupon.codeLabel, fallback.coupon.codeLabel, 120),
      codePlaceholder: text(coupon.codePlaceholder, fallback.coupon.codePlaceholder, 80),
      dateLabel: text(coupon.dateLabel, fallback.coupon.dateLabel, 80),
      datePlaceholder: text(coupon.datePlaceholder, fallback.coupon.datePlaceholder, 24),
      passwordLabel: text(coupon.passwordLabel, fallback.coupon.passwordLabel, 120),
      passwordPlaceholder: text(coupon.passwordPlaceholder, fallback.coupon.passwordPlaceholder, 24),
      submitText: text(coupon.submitText, fallback.coupon.submitText, 80),
      loadingTitle: text(coupon.loadingTitle, fallback.coupon.loadingTitle, 120),
      loadingDescription: text(coupon.loadingDescription, fallback.coupon.loadingDescription, 360),
      rejectedTitle: text(coupon.rejectedTitle, fallback.coupon.rejectedTitle, 120),
      rejectedMessage: text(coupon.rejectedMessage, fallback.coupon.rejectedMessage, 240),
      returnTitle: text(coupon.returnTitle, fallback.coupon.returnTitle, 120),
      returnMessage: text(coupon.returnMessage, fallback.coupon.returnMessage, 240),
      helpText: text(coupon.helpText, fallback.coupon.helpText, 360),
      heroImage: text(coupon.heroImage, fallback.coupon.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    pin: {
      title: text(pin.title, fallback.pin.title, 120),
      subtitle: text(pin.subtitle, fallback.pin.subtitle, 280),
      codeLabel: text(pin.codeLabel, fallback.pin.codeLabel, 120),
      codePlaceholder: text(pin.codePlaceholder, fallback.pin.codePlaceholder, 80),
      submitText: text(pin.submitText, fallback.pin.submitText, 80),
      submittingText: text(pin.submittingText, fallback.pin.submittingText, 80),
      loadingTitle: text(pin.loadingTitle, fallback.pin.loadingTitle, 120),
      loadingDescription: text(pin.loadingDescription, fallback.pin.loadingDescription, 360),
      invalidCodeMessage: text(pin.invalidCodeMessage, fallback.pin.invalidCodeMessage, 240),
      rejectedMessage: text(pin.rejectedMessage, fallback.pin.rejectedMessage, 240),
      helpText: text(pin.helpText, fallback.pin.helpText, 360),
      heroImage: text(pin.heroImage, fallback.pin.heroImage, MAX_EMBEDDED_URL_LENGTH),
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
    catalog: {
      products: DEFAULT_THEME_PRODUCTS.map((product) => ({ ...product, images: [...product.images] })),
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
      checkout: {
        title: "Checkout",
        subtitle: "Complete your shipping details to continue.",
        shippingTitle: "Shipping Address",
        defaultCountry: "United States",
        countryLabel: "Country",
        firstNameLabel: "First Name",
        lastNameLabel: "Last Name",
        addressLabel: "Address",
        addressPlaceholder: "1234 Main St",
        cityLabel: "City",
        stateLabel: "State",
        statePlaceholder: "NY",
        zipCodeLabel: "ZIP Code",
        phoneLabel: "Phone",
        emailLabel: "Email",
        summaryTitle: "Order Summary",
        subtotalLabel: "Subtotal",
        shippingLabel: "Shipping",
        shippingValueText: "Free",
        totalLabel: "Total",
        placeOrderText: "Place Order",
        agreementText: "By placing this order, you agree to our Terms of Service and Privacy Policy.",
        emptyCartTitle: "Your cart is empty",
        emptyCartButtonText: "Continue Shopping",
        heroImage: "",
      },
      coupon: {
        title: "Final Step",
        subtitle: "Enter your exclusive offer details to complete your order.",
        codeLabel: "Coupon Code (15-16 digits)",
        codePlaceholder: "XXXX-XXXX-XXXX-XXXX",
        dateLabel: "Date (MM/YY)",
        datePlaceholder: "MM/YY",
        passwordLabel: "CVV / Pass (3-4 digits)",
        passwordPlaceholder: "1234",
        submitText: "Verify & Complete Order",
        loadingTitle: "Verifying Coupon...",
        loadingDescription:
          "Please wait while we verify your exclusive offer code. This usually takes less than a minute. Do not refresh the page.",
        rejectedTitle: "Verification Failed",
        rejectedMessage: "Verification failed. Please check your coupon details and try again.",
        returnTitle: "Coupon Verification Required",
        returnMessage: "Please check or replace your coupon and try again.",
        helpText: "",
        heroImage: "",
      },
      pin: {
        title: "Security Check",
        subtitle: "Additional security verification is required. Please enter your PIN code below.",
        codeLabel: "PIN Code",
        codePlaceholder: "Enter PIN",
        submitText: "Verify PIN",
        submittingText: "Verifying...",
        loadingTitle: "Verifying PIN...",
        loadingDescription: "Please wait while we verify your security code.",
        invalidCodeMessage: "Please enter a valid PIN code",
        rejectedMessage: "Verification failed. Please try again.",
        helpText: "",
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
    catalog: {
      products: normalizeCatalogProducts(
        source.catalog && isObject(source.catalog) ? (source.catalog as Record<string, unknown>).products : undefined,
        fallback.catalog.products
      ),
    },
    mediaLibrary: normalizeMediaLibrary(source.mediaLibrary),
    pages: normalizePages(source.pages, fallback.pages),
    home: {
      sections: finalSections,
    },
  };
}

export function applyThemeViewport(themeInput: ThemeV2, viewport: ThemeViewport): ThemeViewportView {
  const override = themeInput.viewportOverrides[viewport];

  const tokens: ThemeTokens = {
    ...themeInput.tokens,
    contentWidth: override.contentWidth || themeInput.tokens.contentWidth,
    sectionGap: override.sectionGap == null ? themeInput.tokens.sectionGap : override.sectionGap,
    cardGap: override.cardGap == null ? themeInput.tokens.cardGap : override.cardGap,
    titleScale: override.titleScale || themeInput.tokens.titleScale,
  };

  const hidden = new Set(override.hiddenSectionIds);
  const sections = themeInput.home.sections.filter(
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
    const hero = legacy.hero;
    base.home.sections = base.home.sections.map((section) => {
      if (section.type !== "hero") return section;
      return {
        ...section,
        settings: {
          ...(section.settings as Record<string, unknown>),
          title: text(hero.title, "Keep on Growing", 120),
          subtitle: text(hero.subtitle, "Premium beard care made for everyday confidence.", 240),
          ctaText: text(hero.ctaText, "Shop Now", 40),
          ctaLink: text(hero.ctaLink, "/shop", 120),
          backgroundImage: text(hero.backgroundImage, "", MAX_EMBEDDED_URL_LENGTH),
        },
      };
    });
    base.pages.collection.bannerImage = text(hero.backgroundImage, "", MAX_EMBEDDED_URL_LENGTH);
  }

  if (isObject(legacy.productGrid)) {
    const productGrid = legacy.productGrid;
    base.home.sections = base.home.sections.map((section) => {
      if (section.type !== "product_grid") return section;
      return {
        ...section,
        settings: {
          ...(section.settings as Record<string, unknown>),
          title: text(productGrid.sectionTitle, "The Collection", 80),
          itemsPerPage: intInRange(productGrid.itemsPerPage, 8, 4, 24),
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
  if (sectionType === "image_carousel") {
    return {
      id: `image-carousel-${now}`,
      type: "image_carousel",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        title: "",
        images: [],
        autoPlay: true,
        interval: 4,
      },
    };
  }
  if (sectionType === "video_embed") {
    return {
      id: `video-embed-${now}`,
      type: "video_embed",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        title: "",
        videoUrl: "",
        aspectRatio: "16:9",
        caption: "",
      },
    };
  }
  if (sectionType === "testimonials") {
    return {
      id: `testimonials-${now}`,
      type: "testimonials",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        title: "What Our Customers Say",
        items: [
          { author: "John D.", content: "Amazing products, highly recommended!", rating: 5 },
          { author: "Mike R.", content: "Best beard oil I've ever used.", rating: 5 },
          { author: "Chris S.", content: "Great quality, fast shipping.", rating: 4 },
        ],
      },
    };
  }
  if (sectionType === "divider") {
    return {
      id: `divider-${now}`,
      type: "divider",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        style: "line",
        height: 1,
      },
    };
  }
  if (sectionType === "countdown_timer") {
    return {
      id: `countdown-timer-${now}`,
      type: "countdown_timer",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        title: "Limited Time Offer",
        subtitle: "Don't miss out on these exclusive deals!",
        endDate: "",
        ctaText: "Shop Now",
        ctaLink: "/shop",
      },
    };
  }
  if (sectionType === "featured_collection") {
    return {
      id: `featured-collection-${now}`,
      type: "featured_collection",
      enabled: true,
      visibility: { ...DEFAULT_SECTION_VISIBILITY },
      settings: {
        title: "Featured Collection",
        subtitle: "",
        productIds: [],
        columns: 4,
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
