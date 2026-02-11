import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { products } from "@/data/products";
import {
  applyThemeViewport,
  type ThemeCatalogProduct,
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
  productList: ThemeCatalogProduct[];
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
        ? ctx.productList
        : ctx.productList.filter((product) => product.category === selectedCategory);
    return list.slice(0, itemsLimit);
  }, [ctx.productList, selectedCategory, itemsLimit]);

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

const ThemeImageCarouselSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as { title?: string; images?: string[]; autoPlay?: boolean; interval?: number };
  const images = Array.isArray(settings.images) ? settings.images.filter(Boolean) : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const interval = (settings.interval || 4) * 1000;

  useEffect(() => {
    if (!settings.autoPlay || images.length <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, interval);
    return () => clearInterval(id);
  }, [images.length, settings.autoPlay, interval]);

  if (images.length === 0) {
    return (
      <section className="py-16 px-6">
        <div className="container mx-auto text-center text-muted-foreground">
          {settings.title && <h3 className={cn("font-semibold mb-4", titleScaleMap[ctx.tokens.titleScale])}>{settings.title}</h3>}
          <div className="h-64 border-2 border-dashed rounded-md flex items-center justify-center">
            Add images to this carousel
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-6">
      <div className="container mx-auto">
        {settings.title && <h3 className={cn("font-semibold text-center mb-8", titleScaleMap[ctx.tokens.titleScale])}>{settings.title}</h3>}
        <div className="relative overflow-hidden rounded-md" style={{ aspectRatio: "16/7" }}>
          {images.map((url, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${url})` }}
              initial={false}
              animate={{ opacity: i === activeIndex ? 1 : 0 }}
              transition={{ duration: 0.6 }}
            />
          ))}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={cn("w-2.5 h-2.5 rounded-full transition-all", i === activeIndex ? "scale-125" : "bg-white/50")}
                  style={i === activeIndex ? { backgroundColor: ctx.tokens.accentColor } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const ThemeVideoEmbedSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as { title?: string; videoUrl?: string; aspectRatio?: string; caption?: string };
  const videoUrl = settings.videoUrl || "";
  const aspectRatio = settings.aspectRatio || "16:9";
  const aspectClass = aspectRatio === "4:3" ? "aspect-[4/3]" : aspectRatio === "1:1" ? "aspect-square" : "aspect-video";

  const embedUrl = useMemo(() => {
    if (!videoUrl) return "";
    const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return videoUrl;
  }, [videoUrl]);

  return (
    <section className="py-16 px-6">
      <div className="container mx-auto max-w-4xl">
        {settings.title && <h3 className={cn("font-semibold text-center mb-8", titleScaleMap[ctx.tokens.titleScale])}>{settings.title}</h3>}
        {embedUrl ? (
          <div className={cn("w-full overflow-hidden rounded-md", aspectClass)}>
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={settings.title || "Video"}
            />
          </div>
        ) : (
          <div className={cn("w-full border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground", aspectClass)}>
            Add a video URL
          </div>
        )}
        {settings.caption && <p className="mt-4 text-center text-sm text-muted-foreground">{settings.caption}</p>}
      </div>
    </section>
  );
};

const ThemeTestimonialsSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as {
    title?: string;
    items?: { author: string; content: string; rating: number }[];
  };
  const items = Array.isArray(settings.items) ? settings.items : [];

  return (
    <section className="py-16 px-6">
      <div className="container mx-auto">
        <h3 className={cn("font-semibold text-center mb-10", titleScaleMap[ctx.tokens.titleScale])}>
          {settings.title || "What Our Customers Say"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="border rounded-md p-6 space-y-3"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} style={{ color: s < item.rating ? ctx.tokens.accentColor : "#d4d4d4" }}>&#9733;</span>
                ))}
              </div>
              <p className="text-sm leading-relaxed">{item.content}</p>
              <p className="text-xs font-medium text-muted-foreground">— {item.author}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ThemeDividerSection = ({ section }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as { style?: string; height?: number };
  const style = settings.style || "line";
  const height = settings.height || 1;

  if (style === "space") {
    return <div style={{ height: `${height}px` }} />;
  }

  if (style === "dots") {
    return (
      <div className="py-8 flex items-center justify-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="px-6">
      <div className="container mx-auto">
        <hr className="border-border" style={{ borderWidth: `${Math.min(height, 4)}px` }} />
      </div>
    </div>
  );
};

const ThemeCountdownSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const settings = section.settings as {
    title?: string;
    subtitle?: string;
    endDate?: string;
    ctaText?: string;
    ctaLink?: string;
  };
  const navigate = useNavigate();

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!settings.endDate) return;
    const target = new Date(settings.endDate).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [settings.endDate]);

  const unitBoxes = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <section className="py-16 px-6" style={{ backgroundColor: ctx.tokens.accentColor + "10" }}>
      <div className="container mx-auto text-center space-y-6">
        <h3 className={cn("font-semibold", titleScaleMap[ctx.tokens.titleScale])}>{settings.title || "Limited Time Offer"}</h3>
        {settings.subtitle && <p className="text-muted-foreground">{settings.subtitle}</p>}

        {settings.endDate ? (
          <div className="flex justify-center gap-4">
            {unitBoxes.map((u) => (
              <div key={u.label} className="border rounded-md p-3 min-w-[72px]">
                <div className="text-2xl font-bold" style={{ color: ctx.tokens.accentColor }}>
                  {String(u.value).padStart(2, "0")}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{u.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Set an end date to display the countdown</div>
        )}

        {settings.ctaText && (
          <div>
            {ctx.interactive ? (
              <Button
                size="lg"
                className="rounded-none px-8"
                style={{ backgroundColor: ctx.tokens.accentColor }}
                onClick={() => navigate(settings.ctaLink || "/shop")}
              >
                {settings.ctaText}
              </Button>
            ) : (
              <Button size="lg" className="rounded-none px-8" style={{ backgroundColor: ctx.tokens.accentColor }}>
                {settings.ctaText}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const ThemeFeaturedCollectionSection = ({ section, ctx }: { section: ThemeSection; ctx: RendererContext }) => {
  const navigate = useNavigate();
  const settings = section.settings as {
    title?: string;
    subtitle?: string;
    productIds?: string[];
    columns?: number;
  };
  const columns = settings.columns || 4;

  const displayProducts = useMemo(() => {
    const productIds = Array.isArray(settings.productIds) ? settings.productIds : [];
    if (productIds.length === 0) return ctx.productList.slice(0, columns);
    return productIds
      .map((id) => ctx.productList.find((p) => p.id === id))
      .filter((p): p is ThemeCatalogProduct => Boolean(p));
  }, [settings.productIds, ctx.productList, columns]);

  return (
    <section className="py-16 px-6">
      <div className="container mx-auto space-y-8">
        <div className="text-center">
          <h3 className={cn("font-semibold", titleScaleMap[ctx.tokens.titleScale])}>{settings.title || "Featured Collection"}</h3>
          {settings.subtitle && <p className="mt-2 text-muted-foreground">{settings.subtitle}</p>}
        </div>
        <div
          className="grid grid-cols-1 sm:grid-cols-2"
          style={{ gap: `${ctx.tokens.cardGap}px`, gridTemplateColumns: `repeat(${Math.min(columns, 6)}, minmax(0, 1fr))` }}
        >
          {displayProducts.map((product, index) => (
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

function renderHomeSection(section: ThemeSection, ctx: RendererContext) {
  if (section.type === "hero") return <ThemeHeroSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "product_grid") return <ThemeProductGridSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "tagline") return <ThemeTaglineSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "brand_story") return <ThemeBrandStorySection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "image_carousel") return <ThemeImageCarouselSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "video_embed") return <ThemeVideoEmbedSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "testimonials") return <ThemeTestimonialsSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "divider") return <ThemeDividerSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "countdown_timer") return <ThemeCountdownSection key={section.id} section={section} ctx={ctx} />;
  if (section.type === "featured_collection") return <ThemeFeaturedCollectionSection key={section.id} section={section} ctx={ctx} />;
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

function ThemeCheckoutPreview({ theme }: { theme: ThemeV2 }) {
  const page = theme.pages.checkout;
  return (
    <section className="p-6 space-y-6">
      {page.heroImage ? (
        <div className="rounded-md border overflow-hidden">
          <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${page.heroImage})` }} />
        </div>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{page.title}</h2>
        <p className="text-muted-foreground">{page.subtitle}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-md border p-4 space-y-3 bg-muted/10">
          <p className="text-sm font-medium">{page.shippingTitle}</p>
          <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
            {page.countryLabel}: {page.defaultCountry}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
              {page.firstNameLabel}
            </div>
            <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
              {page.lastNameLabel}
            </div>
          </div>
          <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
            {page.addressPlaceholder || page.addressLabel}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
              {page.cityLabel}
            </div>
            <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
              {page.statePlaceholder || page.stateLabel}
            </div>
            <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
              {page.zipCodeLabel}
            </div>
          </div>
          <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
            {page.phoneLabel}
          </div>
          <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
            {page.emailLabel}
          </div>
        </div>

        <div className="rounded-md border p-4 space-y-4 bg-muted/20">
          <p className="font-medium">{page.summaryTitle}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{page.subtotalLabel}</span>
              <span>$99.00</span>
            </div>
            <div className="flex justify-between">
              <span>{page.shippingLabel}</span>
              <span>{page.shippingValueText}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>{page.totalLabel}</span>
              <span>$99.00</span>
            </div>
          </div>
          <Button className="w-full">{page.placeOrderText}</Button>
          <p className="text-xs text-muted-foreground">{page.agreementText}</p>
        </div>
      </div>
    </section>
  );
}

function ThemePinPreview({ theme }: { theme: ThemeV2 }) {
  const page = theme.pages.pin;
  return (
    <section className="p-6">
      <div className="max-w-lg mx-auto space-y-4">
        {page.heroImage ? (
          <div className="rounded-md border overflow-hidden">
            <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${page.heroImage})` }} />
          </div>
        ) : null}

        <div className="rounded-md border p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">{page.title}</h2>
            <p className="text-muted-foreground">{page.subtitle}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">{page.codeLabel}</p>
            <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">
              {page.codePlaceholder}
            </div>
          </div>

          <Button className="w-full">{page.submitText}</Button>
          <div className="text-[11px] text-muted-foreground space-y-1">
            <p>{page.loadingTitle}</p>
            <p>{page.invalidCodeMessage}</p>
            <p>{page.rejectedMessage}</p>
          </div>
          {page.helpText ? <p className="text-xs text-muted-foreground">{page.helpText}</p> : null}
        </div>
      </div>
    </section>
  );
}

function ThemeCouponPreview({ theme }: { theme: ThemeV2 }) {
  const page = theme.pages.coupon;
  return (
    <section className="p-6">
      <div className="max-w-xl mx-auto space-y-4">
        {page.heroImage ? (
          <div className="rounded-md border overflow-hidden">
            <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${page.heroImage})` }} />
          </div>
        ) : null}

        <div className="rounded-md border p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">{page.title}</h2>
            <p className="text-muted-foreground">{page.subtitle}</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{page.codeLabel}</p>
              <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">{page.codePlaceholder}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{page.dateLabel}</p>
                <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">{page.datePlaceholder}</div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{page.passwordLabel}</p>
                <div className="h-10 rounded border bg-background px-3 flex items-center text-sm text-muted-foreground">{page.passwordPlaceholder}</div>
              </div>
            </div>
            <Button className="w-full">{page.submitText}</Button>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p>{page.rejectedTitle}: {page.rejectedMessage}</p>
              <p>{page.returnTitle}: {page.returnMessage}</p>
            </div>
            {page.helpText ? <p className="text-xs text-muted-foreground">{page.helpText}</p> : null}
          </div>
        </div>
      </div>
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
  const catalogProducts = theme.catalog.products.length > 0 ? theme.catalog.products : products;

  const ctx: RendererContext = {
    tokens: normalized.tokens,
    interactive,
    productList: catalogProducts,
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
    ) : page === "checkout" ? (
      <ThemeCheckoutPreview theme={theme} />
    ) : page === "coupon" ? (
      <ThemeCouponPreview theme={theme} />
    ) : page === "pin" ? (
      <ThemePinPreview theme={theme} />
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


