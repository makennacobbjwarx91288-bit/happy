import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCart, Product } from "@/context/CartContext";
import { useToast } from "@/components/ui/use-toast";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

const ProductDetailModal = ({ isOpen, onClose, product }: ProductDetailModalProps) => {
  const { addToCart } = useCart();
  const { toast } = useToast();

  if (!product) return null;

  const handleAddToCart = () => {
    addToCart(product);
    toast({
      title: "Added to cart",
      description: `${product.title} has been added to your cart.`,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Product Image */}
          <div className="aspect-square bg-light-sage">
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Product Details */}
          <div className="p-8 flex flex-col justify-center">
            <DialogHeader className="text-left mb-6">
              <DialogTitle className="font-serif text-3xl mb-2">
                {product.title}
              </DialogTitle>
              <p className="text-2xl font-medium text-foreground">
                {product.displayPrice}
              </p>
            </DialogHeader>

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {product.description}
            </p>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Premium quality ingredients sourced from around the world. 
                Handcrafted in small batches for exceptional results.
              </p>

              <div className="flex flex-col gap-3 pt-4">
                <Button 
                  size="lg" 
                  className="w-full bg-charcoal text-cream hover:bg-charcoal/90"
                  onClick={handleAddToCart}
                >
                  Add to Cart
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full border-charcoal text-charcoal hover:bg-charcoal hover:text-cream"
                >
                  Subscribe & Save 15%
                </Button>
              </div>

              <div className="pt-6 border-t border-border mt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Features
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• All-natural ingredients</li>
                  <li>• Cruelty-free & vegan</li>
                  <li>• Made in the USA</li>
                  <li>• 30-day satisfaction guarantee</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;
