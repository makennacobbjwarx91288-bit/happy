import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useShop } from "@/context/ShopContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { products } from "@/data/products";
import { Separator } from "@/components/ui/separator";
import { Star, Truck, ShieldCheck, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const ProductDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { config } = useShop();
  const shopName = config?.name || "Shop";
  const [product, setProduct] = useState<any>(null);
  const [activeImage, setActiveImage] = useState<string>("");

  useEffect(() => {
    // Find product or default to first one if not found
    const found = products.find(p => p.id === id) || products[0];
    setProduct(found);
    
    // Set active image to the first one in the images array or fallback to main image
    if (found.images && found.images.length > 0) {
        setActiveImage(found.images[0]);
    } else {
        setActiveImage(found.image);
    }
  }, [id]);

  if (!product) return <div>Loading...</div>;

  // Render stars helper
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
        <Star 
            key={i} 
            className={`w-4 h-4 ${i < Math.floor(rating) ? "fill-yellow-500 text-yellow-500" : "fill-gray-200 text-gray-200"}`} 
        />
    ));
  };

  // Mock extended data that would usually come from API
  const extendedData = {
    features: [
      "Smells like charred white oak and vintage leather",
      "Featuring skin and hair-nourishing ingredients",
      "Shea butter, mango butter, and activated charcoal",
      "Cleanses without leaving skin feeling dry"
    ],
    faqs: [
      {
        q: "HOW DO I USE THE UTILITY BAR?",
        a: "Apply directly to wet or damp skin. Or, use with a loofah or washcloth. Rinse. Can be used as face wash, beard wash, shampoo bar, or shave soap."
      },
      {
        q: "WILL THE UTILITY BAR LEAVE MY SKIN DRY?",
        a: "Think all bar soaps leave your skin dry? Think again. Beard Atelier Utility Bars are made with natural ingredients like mango butter and coconut oil to nourish skin."
      },
      {
        q: "HOW LONG WILL EACH UTILITY BAR LAST?",
        a: "Beard Atelier Utility Bars are cured for a minimum of three weeks and are 5 oz, larger than average bars. They typically last 2-4 weeks with daily use."
      }
    ],
    fragrance: {
      family: "Woody, Amber, Resinous",
      type: "Warm & Complex",
      notes: "Top: Saffron, Cardamom | Mid: Whiskey, Oud | Base: Amber, Moss, Patchouli"
    },
    ingredients: "Elaeis Guineensis (Palm) Oil, Butyrospermum Parkii (Shea) Butter, Mangifera Indica (Mango) Seed Butter, Cocos Nucifera (Coconut) Oil, Ricinus Communis (Castor) Seed Oil, Activated Charcoal, Parfum (Fragrance)."
  };

  const galleryImages = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <div className="min-h-screen bg-background animate-in fade-in duration-500">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Left Column - Image Gallery */}
          <div className="space-y-4">
             <div className="bg-[#f3f3f3] aspect-square rounded-lg overflow-hidden relative group">
                <img 
                  src={activeImage} 
                  alt={product.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold tracking-wider uppercase">
                  Best Seller
                </div>
             </div>
             
             {/* Thumbnails */}
             {galleryImages.length > 1 && (
                 <div className="grid grid-cols-4 gap-4">
                     {galleryImages.map((img: string, idx: number) => (
                         <div 
                            key={idx} 
                            className={cn(
                                "aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all",
                                activeImage === img ? "border-foreground" : "border-transparent hover:border-border"
                            )}
                            onClick={() => setActiveImage(img)}
                         >
                             <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                         </div>
                     ))}
                 </div>
             )}
          </div>

          {/* Right Column - Info */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex">
                  {renderStars(product.rating || 5)}
                </div>
                <span className="text-muted-foreground underline">{product.reviews ? product.reviews.toLocaleString() : "2,453"} Reviews</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight text-foreground">
                {product.title}
              </h1>
              
              <div className="text-2xl font-medium">
                ${product.price} <span className="text-sm text-muted-foreground font-normal ml-2">per unit</span>
              </div>

              <div className="prose prose-stone text-muted-foreground leading-relaxed">
                <p>{product.description}</p>
                <p className="mt-4">
                  Bold Fortune Utility Bars smell like charred white oak and vintage leather coupled with hits of saffron and oud. Featuring skin and hair-nourishing ingredients — shea butter, mango butter, and activated charcoal.
                </p>
              </div>
            </div>

            <div className="space-y-4">
               <Button 
                 onClick={() => addToCart(product)}
                 className="w-full h-14 text-lg bg-foreground hover:bg-foreground/90 text-background rounded-none transition-all uppercase tracking-widest"
               >
                 Add to Cart - ${product.price}
               </Button>
               <p className="text-center text-xs text-muted-foreground">
                 Free shipping on orders over $30 • 100% Satisfaction Guarantee
               </p>
            </div>

            <Separator className="my-8" />

            {/* Accordion Sections */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="faq">
                <AccordionTrigger className="text-lg font-serif">UTILITY BAR FAQs</AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground">
                  {extendedData.faqs.map((faq, i) => (
                    <div key={i}>
                      <strong className="block text-foreground mb-1">{faq.q}</strong>
                      <p>{faq.a}</p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="fragrance">
                <AccordionTrigger className="text-lg font-serif">FRAGRANCE NOTES</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="block font-bold text-xs uppercase text-muted-foreground mb-1">Family</span>
                      {extendedData.fragrance.family}
                    </div>
                    <div>
                      <span className="block font-bold text-xs uppercase text-muted-foreground mb-1">Type</span>
                      {extendedData.fragrance.type}
                    </div>
                    <div className="col-span-2">
                      <span className="block font-bold text-xs uppercase text-muted-foreground mb-1">Notes</span>
                      {extendedData.fragrance.notes}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ingredients">
                <AccordionTrigger className="text-lg font-serif">INGREDIENTS</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {extendedData.ingredients}
                  <p className="mt-2 text-xs italic">
                    NO: SLS / SLES / PARABENS / SILICONES / PHTHALATES
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="shipping">
                <AccordionTrigger className="text-lg font-serif">SHIPPING, RETURNS & GUARANTEES</AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground">
                  <div className="flex gap-4 items-start">
                    <ShieldCheck className="w-6 h-6 shrink-0" />
                    <div>
                      <h4 className="font-bold text-foreground">{shopName} Assurance</h4>
                      <p className="text-sm">If you don't love {shopName} product or the fragrance you purchased, we'll buy it back or exchange it for another fragrance—no questions asked.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <RefreshCw className="w-6 h-6 shrink-0" />
                    <div>
                      <h4 className="font-bold text-foreground">Returns</h4>
                      <p className="text-sm">We offer full refunds (including shipping) as long as our payment processor allows it (usually up to 120 days).</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
