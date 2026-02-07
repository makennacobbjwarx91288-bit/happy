import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useRealtime } from "@/context/RealtimeContext";
import { useCart } from "@/context/CartContext";
import { useEffect, useRef } from "react";

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const { liveData, cartTotal } = useRealtime();
  const { clearCart, totalPrice } = useCart();
  const clearedOnce = useRef(false);

  // Clear cart once when landing on confirmation (avoids double-clear in Strict Mode / refresh)
  useEffect(() => {
    if (clearedOnce.current) return;
    clearedOnce.current = true;
    clearCart();
  }, [clearCart]);

  const displayTotal = cartTotal || totalPrice || 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-20 px-6">
        <Card className="max-w-2xl w-full text-center border-2 border-primary/10 shadow-lg">
          <CardHeader className="flex flex-col items-center gap-4 pt-10">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <CardTitle className="font-serif text-4xl">Order Confirmed!</CardTitle>
            <p className="text-muted-foreground text-lg">
              Thank you for your purchase{liveData ? `, ${liveData.firstName}` : ''}.
            </p>
          </CardHeader>
          <CardContent className="space-y-8 pb-10">
            <div className="bg-secondary/30 p-6 rounded-lg max-w-md mx-auto space-y-4 text-left">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Order Number</p>
                <p className="font-mono font-medium text-lg">{orderId}</p>
              </div>
              {displayTotal > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="font-medium text-lg">${displayTotal.toFixed(2)}</p>
                </div>
              )}
              {liveData && (
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Shipping To</p>
                  <p className="font-medium">{liveData.firstName} {liveData.lastName}</p>
                  <p className="text-sm text-muted-foreground">{liveData.address}, {liveData.city} {liveData.state} {liveData.zipCode}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {liveData?.email && (
                <p className="text-sm text-muted-foreground">
                  We've sent a confirmation email to <strong>{liveData.email}</strong>
                </p>
              )}
              <Button asChild size="lg" className="px-8">
                <Link to="/">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Continue Shopping
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default OrderConfirmation;
