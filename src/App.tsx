import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { CartProvider } from "./context/CartContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { ShopProvider, useShop } from "./context/ShopContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { AdminLocaleProvider } from "./context/AdminLocaleContext";
import ScrollToTop from "./components/ScrollToTop";
import { Loader2 } from "lucide-react";

// Lazy Load Pages for better performance
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const CouponVerification = lazy(() => import("./pages/CouponVerification"));
const SMSVerification = lazy(() => import("./pages/SMSVerification"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const BlockedPage = lazy(() => import("./pages/BlockedPage"));

const queryClient = new QueryClient();

// Admin path: 兼容 __ADMIN_PATH__（构建注入）+ VITE_ADMIN_PATH + 默认值，与 ShopContext 一致
declare const __ADMIN_PATH__: string | undefined;
const RAW_ADMIN =
  (typeof __ADMIN_PATH__ !== "undefined" && __ADMIN_PATH__) ||
  (import.meta.env?.VITE_ADMIN_PATH as string | undefined) ||
  "/manage-admin";
const ADMIN_PATH = ("/" + String(RAW_ADMIN).replace(/^\/|\/$/g, "")).replace(/\/+/g, "/") || "/manage-admin";

// Export for other components to use
export { ADMIN_PATH };

// Loading Fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const AppContent = () => {
  const { blocked } = useShop();
  if (blocked) return <Suspense fallback={<PageLoader />}><BlockedPage /></Suspense>;
  return (
    <RealtimeProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AdminAuthProvider>
              <AdminLocaleProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/verify-coupon" element={<CouponVerification />} />
                  <Route path="/verify-sms" element={<SMSVerification />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />

                  {/* Admin routes - hidden path, not /login or /admin */}
                  <Route path={ADMIN_PATH} element={<Login />} />
                  <Route path={`${ADMIN_PATH}/dashboard`} element={<AdminDashboard />} />
                  
                  {/* Shop Routes */}
                  <Route path="/shop" element={<PlaceholderPage title="Shop All" />} />
                  <Route path="/deals" element={<PlaceholderPage title="Deals" />} />
                  <Route path="/beard" element={<PlaceholderPage title="Beard Care" />} />
                  <Route path="/hair" element={<PlaceholderPage title="Hair Care" />} />
                  <Route path="/body" element={<PlaceholderPage title="Body Care" />} />
                  <Route path="/fragrances" element={<PlaceholderPage title="Fragrances" />} />
                  <Route path="/bundles" element={<PlaceholderPage title="Bundles" />} />

                  {/* Support Routes */}
                  <Route path="/contact" element={<PlaceholderPage title="Contact Us" />} />
                  <Route path="/shipping" element={<PlaceholderPage title="Shipping Policy" />} />
                  <Route path="/returns" element={<PlaceholderPage title="Returns & Exchanges" />} />
                  <Route path="/faq" element={<PlaceholderPage title="FAQ" />} />

                  {/* Company Routes */}
                  <Route path="/about" element={<PlaceholderPage title="About Us" />} />
                  <Route path="/blog" element={<PlaceholderPage title="Blog" />} />
                  <Route path="/careers" element={<PlaceholderPage title="Careers" />} />
                  <Route path="/press" element={<PlaceholderPage title="Press" />} />

                  {/* Catch-all: NOT FOUND */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AdminLocaleProvider>
            </AdminAuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </RealtimeProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ShopProvider>
      <Suspense fallback={<PageLoader />}>
        <AppContent />
      </Suspense>
    </ShopProvider>
  </QueryClientProvider>
);

export default App;
