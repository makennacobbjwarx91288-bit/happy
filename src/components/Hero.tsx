import { motion } from "framer-motion";
import { useShop } from "@/context/ShopContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getActiveThemeV2, getLegacyLayout } from "@/lib/theme-editor";

const Hero = () => {
  const { config } = useShop();
  const shopName = config?.name || "Shop";
  const themeV2 = getActiveThemeV2(config as unknown as Record<string, unknown>);
  const legacyLayout = getLegacyLayout(config as unknown as Record<string, unknown>);

  const heroSection = themeV2?.home.sections.find((section) => section.type === "hero");
  const legacyHeroRaw =
    legacyLayout && typeof legacyLayout === "object" && !Array.isArray(legacyLayout)
      ? legacyLayout["hero"]
      : null;
  const legacyHero =
    legacyHeroRaw && typeof legacyHeroRaw === "object" && !Array.isArray(legacyHeroRaw)
      ? (legacyHeroRaw as Record<string, unknown>)
      : {};
  const heroConfig: Record<string, unknown> =
    heroSection?.settings && typeof heroSection.settings === "object" && !Array.isArray(heroSection.settings)
      ? (heroSection.settings as Record<string, unknown>)
      : legacyHero;

  const title =
    typeof heroConfig["title"] === "string"
      ? heroConfig["title"]
      : `${shopName} is a fragrance house`;
  const subtitle =
    typeof heroConfig["subtitle"] === "string"
      ? heroConfig["subtitle"]
      : "disguised as a beard care company.";
  const bgImage =
    typeof heroConfig["backgroundImage"] === "string" ? heroConfig["backgroundImage"] : "";
  const ctaText =
    typeof heroConfig["ctaText"] === "string" ? heroConfig["ctaText"] : "";
  const ctaLink =
    typeof heroConfig["ctaLink"] === "string" ? heroConfig["ctaLink"] : "/shop";

  return (
    <section className="relative min-h-[70vh] flex items-center justify-center px-6 py-20 overflow-hidden">
      {/* Background Image */}
      {bgImage && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgImage})` }}
        >
          <div className="absolute inset-0 bg-black/40" /> {/* Overlay */}
        </div>
      )}

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-4xl text-center"
      >
        <h1 className={`heading-italic text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-tight ${bgImage ? 'text-white' : ''}`}>
          <span className="text-highlight">{title}</span>
          <br />
          <span className="text-highlight mt-2 inline-block">{subtitle}</span>
        </h1>
        
        {ctaText && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-8"
          >
            <Button asChild size="lg" className="rounded-none text-lg px-8 py-6">
              <Link to={ctaLink}>{ctaText}</Link>
            </Button>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
};

export default Hero;
