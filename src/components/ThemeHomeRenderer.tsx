import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { products } from "@/data/products";
import {
  applyThemeViewport,
  type ThemePreviewPage,
  type ThemeSection,
  type ThemeTokens,
  type ThemeV2,
  type ThemeViewport,
} from "@/lib/theme-editor";

const widthClassMap: Record<ThemeTokens["contentWidth"], string> = {
  narrow: "max-w-4xl",
  normal: "max-w-6xl",
  wide: "max-w-7xl",
};

const radiusClassMap: Record<ThemeTokens["radius"], string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
};

const surfaceClassMap: Record<ThemeTokens["surface"], string> = {
  default: "",
  soft: "bg-secondary/30",
  outline: "border-y border-border",
};

const fontClassMap: Record<ThemeTokens["fontFamily"], string> = {
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

const titleScaleMap: Record<ThemeTokens["titleScale"], string> = {
  sm: "text-2xl md:text-3xl",
  md: "text-3xl md:text-4xl",
  lg: "text-4xl md:text-5xl",
};

interface RendererContext {
  tokens: ThemeTokens;
  interactive: boolean;
}

interface ThemeHomeRendererProps {
  theme: ThemeV2;
  shopName: string;
  viewport?: ThemeViewport;
  page?: ThemePreviewPage;
  interactive?: boolean;
}

const ThemeHeroSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as {
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    backgroundImage?: string;
  };

  const title = settings.title || "Keep on Growing";
  const subtitle = settings.subtitle || "Premium beard care made for everyday confidence.";
  const ctaText = settings.ctaText || "Shop Now";
  const ctaLink = settings.ctaLink || "/shop";
  const backgroundImage = settings.backgroundImage || "";

  return (
    <section className="relative min-h-[56vh] flex items-center justify-center px-6 py-20 overflow-hidden">
      {backgroundImage ? (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-black/45" />
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 max-w-4xl text-center"
      >
        <h1
          className={cn(
            "heading-italic leading-tight",
            titleScaleMap[ctx.tokens.titleScale],
            backgroundImage ? "text-white" : ""
          )}
        >
          <span style={{ color: backgroundImage ? undefined : ctx.tokens.accentColor }}>{title}</span>
        </h1>
        <p className={cn("mt-4 text-lg", backgroundImage ? "text-white/90" : "text-muted-foreground")}>{subtitle}</p>
        <div className="mt-8">
          {ctx.interactive ? (
            <Button asChild size="lg" className="rounded-none text-lg px-8 py-6" style={{ backgroundColor: ctx.tokens.accentColor }}>
              <Link to={ctaLink}>{ctaText}</Link>
            </Button>
          ) : (
            <Button size="lg" className="rounded-none text-lg px-8 py-6" style={{ backgroundColor: ctx.tokens.accentColor }}>
              {ctaText}
            </Button>
          )}
        </div>
      </motion.div>
    </section>
  );
};

const ThemeProductGridSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const settings = section.settings as {
    title?: string;
    itemsPerPage?: number;
    showFilters?: boolean;
  };

  const title = settings.title || "The Collection";
  const itemsLimit = typeof settings.itemsPerPage === "number" ? settings.itemsPerPage : 8;
  const showFilters = settings.showFilters !== false;
  const categories = ["All", "Beard", "Hair", "Body", "Fragrances"];

  const filteredProducts = useMemo(() => {
    const list =
      selectedCategory === "All"
        ? products
        : products.filter((product) => product.category === selectedCategory);
    return list.slice(0, itemsLimit);
  }, [selectedCategory, itemsLimit]);

  return (
    <section className="py-16 px-6">
      <div className="container mx-auto space-y-10">
        <h2 className={cn("font-semibold text-center", titleScaleMap[ctx.tokens.titleScale])}>{title}</h2>

        {showFilters ? (
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="rounded-full px-6"
                style={selectedCategory === category ? { backgroundColor: ctx.tokens.accentColor } : undefined}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        ) : null}

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          style={{ gap: `${ctx.tokens.cardGap}px` }}
        >
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={`${section.id}-${product.id}`}
              image={product.image}
              title={product.title}
              price={product.displayPrice}
              description={product.description}
              index={index}
              onClick={() => {
                if (!ctx.interactive) return;
                navigate(`/product/${product.id}`);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const ThemeTaglineSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as { text?: string };
  return (
    <section className="py-16 border-t border-b border-border">
      <motion.h2
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className={cn("text-center tracking-wider", titleScaleMap[ctx.tokens.titleScale])}
        style={{ color: ctx.tokens.accentColor }}
      >
        {settings.text || "KEEP ON GROWING"}
      </motion.h2>
    </section>
  );
};

const ThemeBrandStorySection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as {
    kicker?: string;
    title?: string;
    body?: string;
    buttonText?: string;
    buttonLink?: string;
  };

  const bodyText =
    settings.body ||
    "We build reliable, premium grooming products that fit real routines. Every release is focused on comfort, confidence, and daily consistency.";

  return (
    <section className="py-24" style={{ backgroundColor: "#1f1f1f", color: "#faf6ef" }}>
      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <p className="uppercase tracking-[0.2em] text-sm font-medium" style={{ color: ctx.tokens.accentColor }}>
            {settings.kicker || "Our Story"}
          </p>
          <h2 className={cn("leading-tight", titleScaleMap[ctx.tokens.titleScale])}>
            {settings.title || "Crafted for the Modern Gentleman"}
          </h2>
          <p className="leading-relaxed whitespace-pre-line text-[#f8f5ed]/85">{bodyText}</p>
          {ctx.interactive ? (
            <Button asChild variant="outline" className="rounded-none" style={{ borderColor: ctx.tokens.accentColor, color: ctx.tokens.accentColor }}>
              <Link to={settings.buttonLink || "/about"}>{settings.buttonText || "Learn More"}</Link>
            </Button>
          ) : (
            <Button variant="outline" className="rounded-none" style={{ borderColor: ctx.tokens.accentColor, color: ctx.tokens.accentColor }}>
              {settings.buttonText || "Learn More"}
            </Button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="aspect-[4/5] bg-white/10 flex items-center justify-center text-white/30 text-6xl">01</div>
          <div className="aspect-[4/5] bg-white/10 flex items-center justify-center text-white/30 text-6xl">02</div>
        </motion.div>
      </div>
    </section>
  );
};

const ThemeRichTextSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as { heading?: string; body?: string; align?: "left" | "center" | "right" };
  const align = settings.align || "left";
  return (
    <section className="py-16 px-6">
      <div className={cn("container mx-auto", align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left")}>
        <h3 className={cn("font-semibold", titleScaleMap[ctx.tokens.titleScale])}>{settings.heading || "Custom Section"}</h3>
        <p className="mt-4 text-muted-foreground whitespace-pre-line">
          {settings.body || "Add your custom campaign text here."}
        </p>
      </div>
    </section>
  );
};

function renderHomeSection(section: ThemeSection, ctx: RendererContext) {
  if (section.type === "hero") return <ThemeHeroSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "product_grid") return <ThemeProductGridSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "tagline") return <ThemeTaglineSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "brand_story") return <ThemeBrandStorySection key={section.id} section={section} ctx={ctx} />;
  return <ThemeRichTextSection key={section.id} section={section} ctx={ctx} />;
}

function ThemeCollectionPreview({ theme, shopName }: { theme: ThemeV2; shopName: string }) {
  const page = theme.pages.collection;
  return (
    <section className="p-6 space-y-4">
      <div className="rounded-md border bg-muted/30 overflow-hidden">
        {page.bannerImage ? (
          <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${page.bannerImage})` }} />
        ) : (
          <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">Collection banner</div>
        )}
      </div>
      <h2 className="text-2xl font-semibold">{page.title}</h2>
      <p className="text-muted-foreground">{page.subtitle}</p>
      <div className="text-xs text-muted-foreground">Preview for {shopName} collection page</div>
    </section>
  );
}

function ThemeProductPreview({ theme }: { theme: ThemeV2 }) {
  const page = theme.pages.product;
  return (
    <section className="p-6 space-y-4">
      {page.showBreadcrumbs ? <div className="text-xs text-muted-foreground">Home / Shop / Product</div> : null}
      <h2 className="text-2xl font-semibold">{page.title}</h2>
      <p className="text-muted-foreground">{page.subtitle}</p>
      <div className="rounded-md border p-4 bg-muted/20">
        Gallery: <strong>{page.galleryStyle}</strong>
      </div>
      {page.showBenefits ? (
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Clear routine guidance</li>
          <li>Ingredient transparency</li>
          <li>Shipping and return notes</li>
        </ul>
      ) : null}
    </section>
  );
}

function ThemeInfoPreview({ title, subtitle, image, label }: { title: string; subtitle: string; image: string; label: string }) {
  return (
    <section className="p-6 space-y-4">
      <div className="rounded-md border bg-muted/20 overflow-hidden">
        {image ? (
          <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">{label} hero image</div>
        )}
      </div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{subtitle}</p>
    </section>
  );
}

export default function ThemeHomeRenderer({
  theme,
  shopName,
  viewport = "desktop",
  page = "home",
  interactive = true,
}: ThemeHomeRendererProps) {
  const normalized = useMemo(() => applyThemeViewport(theme, viewport), [theme, viewport]);

  const ctx: RendererContext = {
    tokens: normalized.tokens,
    interactive,
  };

  const wrapperStyle: React.CSSProperties = {
    backgroundColor: normalized.tokens.backgroundColor,
    color: normalized.tokens.textColor,
    gap: `${normalized.tokens.sectionGap}px`,
  };

  const previewBody =
    page === "home" ? (
      normalized.sections.length > 0 ? (
        normalized.sections.map((section) => renderHomeSection(section, ctx))
      ) : (
        <div className="py-16 text-center text-muted-foreground">当前视口没有可见的模块。</div>
      )
    ) : page === "collection" ? (
      <ThemeCollectionPreview theme={theme} shopName={shopName} />
    ) : page === "product" ? (
      <ThemeProductPreview theme={theme} />
    ) : page === "support" ? (
      <ThemeInfoPreview
        title={theme.pages.support.title}
        subtitle={theme.pages.support.subtitle}
        image={theme.pages.support.heroImage}
        label="Support"
      />
    ) : (
      <ThemeInfoPreview
        title={theme.pages.company.title}
        subtitle={theme.pages.company.subtitle}
        image={theme.pages.company.heroImage}
        label="Company"
      />
    );

  return (
    <div
      className={cn(
        "mx-auto w-full flex flex-col",
        widthClassMap[normalized.tokens.contentWidth],
        radiusClassMap[normalized.tokens.radius],
        surfaceClassMap[normalized.tokens.surface],
        fontClassMap[normalized.tokens.fontFamily]
      )}
      style={wrapperStyle}
      data-theme-v2="true"
      data-shop-name={shopName}
      data-theme-viewport={viewport}
      data-theme-page={page}
    >
      {previewBody}
    </div>
  );
}
