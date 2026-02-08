import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Tagline from "@/components/Tagline";
import ProductGrid from "@/components/ProductGrid";
import BrandStory from "@/components/BrandStory";
import Footer from "@/components/Footer";
import ThemeHomeRenderer from "@/components/ThemeHomeRenderer";
import { useShop } from "@/context/ShopContext";
import { getActiveThemeV2 } from "@/lib/theme-editor";

const Index = () => {
  const { config } = useShop();
  const activeTheme = getActiveThemeV2(config as unknown as Record<string, unknown>);
  const shopName = config?.name || "Shop";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {activeTheme ? (
          <ThemeHomeRenderer theme={activeTheme} shopName={shopName} />
        ) : (
          <>
            <Hero />
            <Tagline />
            <ProductGrid />
            <BrandStory />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
