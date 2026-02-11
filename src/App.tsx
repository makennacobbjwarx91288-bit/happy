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
const PinVerification = lazy(() => import("./pages/PinVerification"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const ShopCollectionsPage = lazy(() => import("./pages/ShopCollectionsPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const CompanyPage = lazy(() => import("./pages/CompanyPage"));
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
                  <Route path="/verify-pin" element={<PinVerification />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />

                  {/* Admin routes - hidden path, not /login or /admin */}
                  <Route path={ADMIN_PATH} element={<Login />} />
                  <Route path={`${ADMIN_PATH}/dashboard`} element={<AdminDashboard />} />
                  
                  {/* Shop Routes */}
                  <Route path="/shop" element={<ShopCollectionsPage kind="shop" />} />
                  <Route path="/deals" element={<ShopCollectionsPage kind="deals" />} />
                  <Route path="/beard" element={<ShopCollectionsPage kind="beard" />} />
                  <Route path="/hair" element={<ShopCollectionsPage kind="hair" />} />
                  <Route path="/body" element={<ShopCollectionsPage kind="body" />} />
                  <Route path="/fragrances" element={<ShopCollectionsPage kind="fragrances" />} />
                  <Route path="/bundles" element={<ShopCollectionsPage kind="bundles" />} />

                  {/* Compatibility category routes */}
                  <Route path="/category/beard" element={<ShopCollectionsPage kind="beard" />} />
                  <Route path="/category/hair" element={<ShopCollectionsPage kind="hair" />} />
                  <Route path="/category/body" element={<ShopCollectionsPage kind="body" />} />
                  <Route path="/category/fragrances" element={<ShopCollectionsPage kind="fragrances" />} />

                  {/* Support Routes */}
                  <Route path="/contact" element={<SupportPage kind="contact" />} />
                  <Route path="/shipping" element={<SupportPage kind="shipping" />} />
                  <Route path="/returns" element={<SupportPage kind="returns" />} />
                  <Route path="/faq" element={<SupportPage kind="faq" />} />

                  {/* Company Routes */}
                  <Route path="/about" element={<CompanyPage kind="about" />} />
                  <Route path="/blog" element={<CompanyPage kind="blog" />} />
                  <Route path="/careers" element={<CompanyPage kind="careers" />} />
                  <Route path="/press" element={<CompanyPage kind="press" />} />

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
