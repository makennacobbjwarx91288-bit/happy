import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getActiveThemeV2 } from "@/lib/theme-editor";

export type ShopCollectionKind = "shop" | "deals" | "beard" | "hair" | "body" | "fragrances" | "bundles";

interface ShopCollectionsPageProps {
  kind: ShopCollectionKind;
}

interface BundleOffer {
  id: string;
  title: string;
  description: string;
  discountLabel: string;
  productIds: string[];
}

const PAGE_META: Record<ShopCollectionKind, { title: string; subtitle: string; badge: string }> = {
  shop: {
    title: "Shop All",
    subtitle: "Browse the full collection of daily grooming essentials.",
    badge: "Full Collection",
  },
  deals: {
    title: "Deals",
    subtitle: "Limited-time picks and customer favorites at sharper prices.",
    badge: "Best Value",
  },
  beard: {
    title: "Beard Care",
    subtitle: "Oil, balm, wash, and tools built for healthy beard growth.",
    badge: "Category",
  },
  hair: {
    title: "Hair Care",
    subtitle: "Clean styling and texture products for everyday control.",
    badge: "Category",
  },
  body: {
    title: "Body Care",
    subtitle: "Skin-first formulas for freshness and all-day comfort.",
    badge: "Category",
  },
  fragrances: {
    title: "Fragrances",
    subtitle: "Signature scents built to layer and last.",
    badge: "Category",
  },
  bundles: {
    title: "Bundles",
    subtitle: "High-performing routines grouped into one easy checkout.",
    badge: "Save More",
  },
};

const BUNDLE_OFFERS: BundleOffer[] = [
  {
    id: "starter-routine",
    title: "Starter Routine",
    description: "A practical daily setup for cleansing, conditioning, and style.",
    discountLabel: "Save 12%",
    productIds: ["prod_8", "prod_1", "prod_4"],
  },
  {
    id: "fresh-essentials",
    title: "Fresh Essentials",
    description: "Stay fresh from shower to evening with clean, balanced notes.",
    discountLabel: "Save 10%",
    productIds: ["prod_5", "prod_2", "prod_3"],
  },
  {
    id: "texture-hold-kit",
    title: "Texture + Hold Kit",
    description: "Build texture, then lock shape with flexible hold.",
    discountLabel: "Save 9%",
    productIds: ["prod_6", "prod_7", "prod_1"],
  },
];

const ShopCollectionsPage = ({ kind }: ShopCollectionsPageProps) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { config, loading } = useShop();
  const activeTheme = loading ? null : getActiveThemeV2(config as unknown as Record<string, unknown>);
  const catalogProducts = activeTheme?.catalog.products?.length ? activeTheme.catalog.products : products;
  const meta = PAGE_META[kind];

  const collectionProducts = useMemo(() => {
    if (kind === "shop") return catalogProducts;
    if (kind === "deals") {
      return [...catalogProducts]
        .filter((p) => p.price <= 25 || (typeof p.rating === "number" && p.rating >= 4.8))
        .sort((a, b) => a.price - b.price);
    }
    if (kind === "bundles") return [];

    const categoryMap: Record<Exclude<ShopCollectionKind, "shop" | "deals" | "bundles">, string> = {
      beard: "Beard",
      hair: "Hair",
      body: "Body",
      fragrances: "Fragrances",
    };
    const category = categoryMap[kind];
    return catalogProducts.filter((p) => p.category === category);
  }, [catalogProducts, kind]);

  const collectionStats = useMemo(() => {
      const list = kind === "bundles"
      ? BUNDLE_OFFERS.flatMap((b) => b.productIds.map((id) => catalogProducts.find((p) => p.id === id)).filter(Boolean))
      : collectionProducts;

    const unique = Array.from(new Map(list.map((p) => [p.id, p])).values());
    const avgPrice = unique.length > 0
      ? unique.reduce((sum, p) => sum + p.price, 0) / unique.length
      : 0;
    return {
      count: kind === "bundles" ? BUNDLE_OFFERS.length : collectionProducts.length,
      avgPrice,
    };
  }, [kind, collectionProducts, catalogProducts]);

  const handleBundleAdd = (bundle: BundleOffer) => {
    bundle.productIds.forEach((id) => {
      const product = catalogProducts.find((p) => p.id === id);
      if (product) addToCart(product);
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/30">
          <div className="container mx-auto px-6 py-16 md:py-20">
            <div className="max-w-3xl space-y-5">
              <Badge variant="outline" className="tracking-widest uppercase text-[11px] px-3 py-1">
                {meta.badge}
              </Badge>
              <h1 className="font-serif text-4xl md:text-5xl">{meta.title}</h1>
              <p className="text-muted-foreground text-lg leading-relaxed">{meta.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Items</p>
                  <p className="text-2xl font-semibold mt-1">{collectionStats.count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Avg. Price</p>
                  <p className="text-2xl font-semibold mt-1">${collectionStats.avgPrice.toFixed(0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Shipping</p>
                  <p className="text-2xl font-semibold mt-1">Free</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Support</p>
                  <p className="text-2xl font-semibold mt-1">24/7</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {kind === "bundles" ? (
          <section className="container mx-auto px-6 py-14">
            <div className="grid lg:grid-cols-3 gap-6">
              {BUNDLE_OFFERS.map((bundle) => {
                const bundleProducts = bundle.productIds
                  .map((id) => catalogProducts.find((p) => p.id === id))
                  .filter((p): p is (typeof catalogProducts)[number] => Boolean(p));
                const total = bundleProducts.reduce((sum, p) => sum + p.price, 0);
                const discounted = total * 0.9;
                return (
                  <Card key={bundle.id} className="h-full">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-2xl">{bundle.title}</CardTitle>
                        <Badge>{bundle.discountLabel}</Badge>
                      </div>
                      <CardDescription>{bundle.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        {bundleProducts.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm border-b pb-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/product/${p.id}`)}
                              className="text-left hover:underline"
                            >
                              {p.title}
                            </button>
                            <span>${p.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Regular Total</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-lg font-semibold">
                          <span>Bundle Price</span>
                          <span>${discounted.toFixed(2)}</span>
                        </div>
                      </div>
                      <Button className="w-full" onClick={() => handleBundleAdd(bundle)}>
                        Add Bundle To Cart
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="container mx-auto px-6 py-14">
            {collectionProducts.length === 0 ? (
              <Card>
                <CardContent className="py-14 text-center text-muted-foreground">
                  No products are available in this collection yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {collectionProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    image={product.image}
                    title={product.title}
                    price={product.displayPrice}
                    description={product.description}
                    index={index}
                    onClick={() => navigate(`/product/${product.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ShopCollectionsPage;
