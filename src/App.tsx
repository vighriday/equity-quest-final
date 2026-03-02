import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MaintenanceMode from "./components/MaintenanceMode";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import Messages from "./pages/Messages";
import TransactionHistory from "./pages/TransactionHistory";
import Admin from "./pages/Admin";
import MarketAnalysis from "./pages/MarketAnalysis";
import TeamManagement from "./pages/TeamManagement";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import LearnMore from "./pages/LearnMore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <MaintenanceMode>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ErrorBoundary><ProtectedRoute><Dashboard /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/market" element={<ErrorBoundary><ProtectedRoute><MarketAnalysis /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/leaderboard" element={<ErrorBoundary><ProtectedRoute><Leaderboard /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/messages" element={<ErrorBoundary><ProtectedRoute><Messages /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/transactions" element={<ErrorBoundary><ProtectedRoute><TransactionHistory /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/history" element={<ErrorBoundary><ProtectedRoute><TransactionHistory /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/teams" element={<ErrorBoundary><ProtectedRoute><TeamManagement /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/admin" element={<ErrorBoundary><ProtectedRoute requireRole="admin"><Admin /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/learn-more" element={<LearnMore />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MaintenanceMode>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
