import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { products } from "@/data/products";
import type { ThemeSection, ThemeV2 } from "@/lib/theme-editor";

const widthClassMap: Record<ThemeV2["tokens"]["contentWidth"], string> = {
  narrow: "max-w-4xl",
  normal: "max-w-6xl",
  wide: "max-w-7xl",
};

const radiusClassMap: Record<ThemeV2["tokens"]["radius"], string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
};

const surfaceClassMap: Record<ThemeV2["tokens"]["surface"], string> = {
  default: "",
  soft: "bg-secondary/30",
  outline: "border-y border-border",
};

interface ThemeHomeRendererProps {
  theme: ThemeV2;
  shopName: string;
}

const ThemeHeroSection = ({ section }: { section: ThemeSection }) => {
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
    <section className="relative min-h-[60vh] flex items-center justify-center px-6 py-20 overflow-hidden">
      {backgroundImage ? (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-black/45" />
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-4xl text-center"
      >
        <h1
          className={cn(
            "heading-italic text-4xl md:text-5xl lg:text-6xl leading-tight",
            backgroundImage ? "text-white" : ""
          )}
        >
          <span className="text-highlight">{title}</span>
          <br />
          <span className="text-highlight mt-2 inline-block">{subtitle}</span>
        </h1>
        <div className="mt-8">
          <Button asChild size="lg" className="rounded-none text-lg px-8 py-6">
            <Link to={ctaLink}>{ctaText}</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
};

const ThemeProductGridSection = ({ section }: { section: ThemeSection }) => {
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
        <h2 className="text-3xl font-serif font-bold text-center">{title}</h2>

        {showFilters ? (
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="rounded-full px-6"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={`${section.id}-${product.id}`}
              image={product.image}
              title={product.title}
              price={product.displayPrice}
              description={product.description}
              index={index}
              onClick={() => navigate(`/product/${product.id}`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const ThemeTaglineSection = ({ section }: { section: ThemeSection }) => {
  const settings = section.settings as { text?: string };
  return (
    <section className="py-16 border-t border-b border-border">
      <motion.h2
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center font-serif text-3xl md:text-4xl lg:text-5xl tracking-wider"
      >
        {settings.text || "KEEP ON GROWING"}
      </motion.h2>
    </section>
  );
};

const ThemeBrandStorySection = ({ section }: { section: ThemeSection }) => {
  const settings = section.settings as {
    kicker?: string;
    title?: string;
    body?: string;
    buttonText?: string;
    buttonLink?: string;
  };

  return (
    <section className="py-24 bg-charcoal text-cream">
      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <p className="text-warm-gold uppercase tracking-[0.2em] text-sm font-medium">
            {settings.kicker || "Our Story"}
          </p>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight">
            {settings.title || "Crafted for the Modern Gentleman"}
          </h2>
          <p className="text-cream/80 leading-relaxed whitespace-pre-line">
            {settings.body ||
              "We build reliable, premium grooming products that fit real routines. Every release is focused on comfort, confidence, and daily consistency."}
          </p>
          <Button asChild variant="outline" className="rounded-none border-warm-gold text-warm-gold">
            <Link to={settings.buttonLink || "/about"}>
              {settings.buttonText || "Learn More"}
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="aspect-[4/5] bg-cream/10 flex items-center justify-center text-cream/30 font-serif text-6xl">
            01
          </div>
          <div className="aspect-[4/5] bg-cream/10 flex items-center justify-center text-cream/30 font-serif text-6xl">
            02
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const ThemeRichTextSection = ({ section }: { section: ThemeSection }) => {
  const settings = section.settings as { heading?: string; body?: string; align?: "left" | "center" | "right" };
  const align = settings.align || "left";
  return (
    <section className="py-16 px-6">
      <div className={cn("container mx-auto", align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left")}>
        <h3 className="font-serif text-3xl">{settings.heading || "Custom Section"}</h3>
        <p className="mt-4 text-muted-foreground whitespace-pre-line">
          {settings.body || "Add your custom campaign text here."}
        </p>
      </div>
    </section>
  );
};

function renderSection(section: ThemeSection) {
  if (!section.enabled) return null;

  if (section.type === "hero") return <ThemeHeroSection key={section.id} section={section} />;
  if (section.type === "product_grid") return <ThemeProductGridSection key={section.id} section={section} />;
  if (section.type === "tagline") return <ThemeTaglineSection key={section.id} section={section} />;
  if (section.type === "brand_story") return <ThemeBrandStorySection key={section.id} section={section} />;
  return <ThemeRichTextSection key={section.id} section={section} />;
}

export default function ThemeHomeRenderer({ theme, shopName }: ThemeHomeRendererProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        widthClassMap[theme.tokens.contentWidth],
        radiusClassMap[theme.tokens.radius],
        surfaceClassMap[theme.tokens.surface]
      )}
      data-theme-v2="true"
      data-shop-name={shopName}
    >
      {theme.home.sections.map((section) => renderSection(section))}
    </div>
  );
}
