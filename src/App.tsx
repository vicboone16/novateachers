import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppAccessProvider } from "@/contexts/AppAccessContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";

import { AppAccessGuard } from "@/components/AppAccessGuard";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import WorkspaceSelector from "@/pages/WorkspaceSelector";
import Students from "@/pages/Students";
import StudentDetail from "@/pages/StudentDetail";
import TriggerTracker from "@/pages/TriggerTracker";
import IEPWriter from "@/pages/IEPWriter";
import IEPReader from "@/pages/IEPReader";
import Settings from "@/pages/Settings";
import ClassroomManager from "@/pages/ClassroomManager";
import JoinInvite from "@/pages/JoinInvite";
import GenerateInvite from "@/pages/GenerateInvite";
import Inbox from "@/pages/Inbox";
import { WeeklyDataSummary } from "@/components/WeeklyDataSummary";
import NotFound from "@/pages/NotFound";
import InstallApp from "@/pages/InstallApp";
import ResetPassword from "@/pages/ResetPassword";
import GuestDataCollection from "@/pages/GuestDataCollection";
import AdminDashboard from "@/pages/AdminDashboard";
import DataCollection from "@/pages/DataCollection";
import TeacherGuide from "@/pages/TeacherGuide";
import ClassroomView from "@/pages/ClassroomView";
import CoreDiagnostics from "@/pages/CoreDiagnostics";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <AppAccessProvider>
      <AppAccessGuard>
        <WorkspaceProvider>
          <WorkspaceRoutes />
        </WorkspaceProvider>
      </AppAccessGuard>
    </AppAccessProvider>
  );
};

const WorkspaceRoutes = () => {
  const { currentWorkspace, workspaces, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Workspace selector — shown when multiple workspaces or navigated to */}
      <Route path="/workspace" element={<WorkspaceSelector />} />

      {/* If no workspace selected yet and multiple exist, redirect to selector */}
      {!currentWorkspace && workspaces.length > 1 && (
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      )}

      {/* Main app routes */}
      <Route element={<AppLayout />}>
        <Route path="/classroom" element={<ClassroomView />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/tracker" element={<TriggerTracker />} />
        <Route path="/collect" element={<DataCollection />} />
        <Route path="/data-summary" element={<WeeklyDataSummary />} />
        <Route path="/guide" element={<TeacherGuide />} />
        <Route path="/iep" element={<IEPWriter />} />
        <Route path="/iep-reader" element={<IEPReader />} />
        <Route path="/classrooms" element={<ClassroomManager />} />
        <Route path="/join" element={<JoinInvite />} />
        <Route path="/invites" element={<GenerateInvite />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/diagnostics" element={<CoreDiagnostics />} />
        <Route path="/install" element={<InstallApp />} />
        <Route path="/" element={<Navigate to="/classroom" replace />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/guest/:code" element={<GuestDataCollection />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
