import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CallProvider } from "@/contexts/CallContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Communities from "./pages/Communities";
import CourseCommunity from "./pages/CourseCommunity";
import Friends from "./pages/Friends";
import Rewards from "./pages/Rewards";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Upload from "./pages/Upload";
import DocumentEditor from "./pages/DocumentEditor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes default staleTime
      gcTime: 10 * 60 * 1000, // 10 minutes default cache time (formerly cacheTime)
      retry: 1, // Retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch on window focus by default
    },
  },
});

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/app" element={<ProtectedRoute><CallProvider><Dashboard /></CallProvider></ProtectedRoute>} />
          <Route path="/app/rewards" element={<ProtectedRoute><CallProvider><Rewards /></CallProvider></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><CallProvider><Upload /></CallProvider></ProtectedRoute>} />
          <Route path="/document/:fileId" element={<ProtectedRoute><CallProvider><DocumentEditor /></CallProvider></ProtectedRoute>} />
          <Route path="/communities" element={<ProtectedRoute><CallProvider><Communities /></CallProvider></ProtectedRoute>} />
          <Route path="/community/:communityId" element={<ProtectedRoute><CallProvider><CourseCommunity /></CallProvider></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><CallProvider><Friends /></CallProvider></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
