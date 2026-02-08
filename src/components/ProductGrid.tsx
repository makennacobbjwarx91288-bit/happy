import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "./ProductCard";
import { products } from "@/data/products";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopContext";

const categories = ["All", "Beard", "Hair", "Body", "Fragrances"];

const ProductGrid = () => {
  const navigate = useNavigate();
  const { config } = useShop();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const gridConfig = config?.layout_config?.productGrid || {};
  const sectionTitle = gridConfig.sectionTitle;
  const itemsLimit = gridConfig.itemsPerPage || 100;

  const handleProductClick = (id: string) => {
    navigate(`/product/${id}`);
  };

  const filteredProducts = (selectedCategory === "All" 
    ? products 
    : products.filter(p => p.category === selectedCategory)).slice(0, itemsLimit);

  return (
    <section className="py-16 px-6">
      <div className="container mx-auto space-y-12">
        {sectionTitle && (
          <h2 className="text-3xl font-serif font-bold text-center mb-8">{sectionTitle}</h2>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-4">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full px-6 transition-all duration-300 ${
                selectedCategory === category 
                  ? "bg-foreground text-background" 
                  : "hover:bg-foreground/5"
              }`}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              image={product.image}
              title={product.title}
              price={product.displayPrice}
              description={product.description}
              index={index}
              onClick={() => handleProductClick(product.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductGrid;
