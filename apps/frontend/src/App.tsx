
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { ProtectedRoute } from "./components/SubscriptionGuard";
import { NetworkStatusBanner } from "./components/NetworkStatusIndicator";
import Index from "./pages/Index";
import Subscription from "./pages/Subscription";
import Login from "./pages/Login";
import Shop from "./pages/Shop";
import ProductCatalog from "./pages/ProductCatalog";
import SellerDashboard from "./pages/SellerDashboard";
import SignupSuccess from "./pages/SignupSuccess";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminAuthProvider>
        <TooltipProvider>
          <div className="min-h-screen w-full bg-background text-foreground">
            <NetworkStatusBanner />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup/success" element={<SignupSuccess />} />
                <Route
                  path="/shop/:handle"
                  element={
                    <ProtectedRoute requireAuth={false} requireSubscription={false}>
                      <Shop />
                    </ProtectedRoute>
                  }
                />
                <Route path="/catalog/:handle" element={<ProductCatalog />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <SellerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
