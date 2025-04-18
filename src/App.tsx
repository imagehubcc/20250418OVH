
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import ServersPage from "./pages/ServersPage";
import QueuePage from "./pages/QueuePage";
import NewTaskPage from "./pages/NewTaskPage";
import HistoryPage from "./pages/HistoryPage";
import ConsolePage from "./pages/ConsolePage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          } />
          <Route path="/servers" element={
            <AppLayout>
              <ServersPage />
            </AppLayout>
          } />
          <Route path="/queue" element={
            <AppLayout>
              <QueuePage />
            </AppLayout>
          } />
          <Route path="/queue/new" element={
            <AppLayout>
              <NewTaskPage />
            </AppLayout>
          } />
          <Route path="/history" element={
            <AppLayout>
              <HistoryPage />
            </AppLayout>
          } />
          <Route path="/console" element={
            <AppLayout>
              <ConsolePage />
            </AppLayout>
          } />
          <Route path="/settings" element={
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
