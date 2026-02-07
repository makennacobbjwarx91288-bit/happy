import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Tagline from "@/components/Tagline";
import ProductGrid from "@/components/ProductGrid";
import BrandStory from "@/components/BrandStory";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Tagline />
        <ProductGrid />
        <BrandStory />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
