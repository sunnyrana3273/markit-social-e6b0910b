import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Communities from "./pages/Communities";
import CourseCommunity from "./pages/CourseCommunity";
import Friends from "./pages/Friends";
import StudySession from "./pages/StudySession";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Upload from "./pages/Upload";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
          <Route path="/app" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/community/:communityId" element={<CourseCommunity />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/session/:sessionId" element={<StudySession />} />
          <Route path="/session/new" element={<StudySession />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
  </QueryClientProvider>
);

export default App;
