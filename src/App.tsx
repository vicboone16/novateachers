import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { BackendGuard } from "@/components/BackendGuard";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Students from "@/pages/Students";
import StudentDetail from "@/pages/StudentDetail";
import TriggerTracker from "@/pages/TriggerTracker";
import IEPWriter from "@/pages/IEPWriter";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/students" element={<Students />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/tracker" element={<TriggerTracker />} />
          <Route path="/iep" element={<IEPWriter />} />
          <Route path="/" element={<Navigate to="/students" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </WorkspaceProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BackendGuard>
            <ProtectedRoutes />
          </BackendGuard>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
