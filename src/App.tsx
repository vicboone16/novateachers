import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppAccessProvider } from "@/contexts/AppAccessContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { ActiveClassroomProvider } from "@/contexts/ActiveClassroomContext";
import { WalkthroughProvider } from "@/contexts/WalkthroughContext";

import { AppAccessGuard } from "@/components/AppAccessGuard";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Lazy-loaded pages for code splitting
const WorkspaceSelector = lazy(() => import("@/pages/WorkspaceSelector"));
const Students = lazy(() => import("@/pages/Students"));
const StudentDetail = lazy(() => import("@/pages/StudentDetail"));
const TriggerTracker = lazy(() => import("@/pages/TriggerTracker"));
const IEPWriter = lazy(() => import("@/pages/IEPWriter"));
const IEPReader = lazy(() => import("@/pages/IEPReader"));
const Settings = lazy(() => import("@/pages/Settings"));
const ClassroomManager = lazy(() => import("@/pages/ClassroomManager"));
const JoinInvite = lazy(() => import("@/pages/JoinInvite"));
const GenerateInvite = lazy(() => import("@/pages/GenerateInvite"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const WeeklyDataSummary = lazy(() => import("@/components/WeeklyDataSummary").then(m => ({ default: m.WeeklyDataSummary })));
const InstallApp = lazy(() => import("@/pages/InstallApp"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const GuestDataCollection = lazy(() => import("@/pages/GuestDataCollection"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const DataCollection = lazy(() => import("@/pages/DataCollection"));
const TeacherGuide = lazy(() => import("@/pages/TeacherGuide"));
const ClassroomView = lazy(() => import("@/pages/ClassroomView"));
const ClassroomBoard = lazy(() => import("@/pages/ClassroomBoard"));
const Threads = lazy(() => import("@/pages/Threads"));
const CoreDiagnostics = lazy(() => import("@/pages/CoreDiagnostics"));
const NotificationSettings = lazy(() => import("@/pages/NotificationSettings"));
const StudentPortalEnhanced = lazy(() => import("@/pages/StudentPortalEnhanced"));
const ParentSnapshot = lazy(() => import("@/pages/ParentSnapshot"));
const ExternalParentPortal = lazy(() => import("@/pages/ExternalParentPortal"));
const RewardsPage = lazy(() => import("@/pages/RewardsPage"));
const ClassroomFeed = lazy(() => import("@/pages/ClassroomFeed"));
const BoardConfig = lazy(() => import("@/pages/BoardConfig"));
const ParentReports = lazy(() => import("@/pages/ParentReports"));
const GameBoardPage = lazy(() => import("@/pages/GameBoard"));
const GameSettings = lazy(() => import("@/pages/GameSettings"));
const ClassroomLive = lazy(() => import("@/pages/ClassroomLive"));
const AvatarUnlocks = lazy(() => import("@/pages/AvatarUnlocks"));
const PointRulesManager = lazy(() => import("@/pages/PointRulesManager"));
const FeatureTour = lazy(() => import("@/pages/FeatureTour"));
const FAQTutorial = lazy(() => import("@/pages/FAQTutorial"));
const LaunchReadiness = lazy(() => import("@/pages/LaunchReadiness"));
const ParentView = lazy(() => import("@/pages/ParentView"));
const ClassroomInsights = lazy(() => import("@/pages/ClassroomInsights"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

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
          <ActiveClassroomProvider>
            <WalkthroughProvider>
              <WorkspaceRoutes />
            </WalkthroughProvider>
          </ActiveClassroomProvider>
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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/workspace" element={<WorkspaceSelector />} />

        {!currentWorkspace && workspaces.length > 1 && (
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        )}

        <Route element={<AppLayout />}>
          <Route path="/classroom" element={<ClassroomView />} />
          <Route path="/game-board" element={<GameBoardPage />} />
          <Route path="/game-settings" element={<GameSettings />} />
          <Route path="/avatar-unlocks" element={<AvatarUnlocks />} />
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
          <Route path="/rewards" element={<RewardsPage />} />
          <Route path="/feed" element={<ClassroomFeed />} />
          <Route path="/board-config" element={<BoardConfig />} />
          <Route path="/parent-reports" element={<ParentReports />} />
          <Route path="/threads" element={<Threads />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/point-rules" element={<PointRulesManager />} />
          <Route path="/launch-readiness" element={<LaunchReadiness />} />
          <Route path="/classroom-insights" element={<ClassroomInsights />} />
          <Route path="/diagnostics" element={<CoreDiagnostics />} />
          <Route path="/notifications" element={<NotificationSettings />} />
          <Route path="/install" element={<InstallApp />} />
          
          <Route path="/" element={<Navigate to="/classroom" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/guest/:code" element={<GuestDataCollection />} />
              <Route path="/board/:slug" element={<ClassroomBoard />} />
              <Route path="/board" element={<ClassroomBoard />} />
              <Route path="/portal/:token" element={<StudentPortalEnhanced />} />
              <Route path="/portal" element={<StudentPortalEnhanced />} />
              <Route path="/class/:slug/live" element={<ClassroomLive />} />
              <Route path="/snapshot/:token" element={<ParentSnapshot />} />
              <Route path="/external/parent/:token" element={<ExternalParentPortal />} />
              <Route path="/tour" element={<FeatureTour />} />
              <Route path="/faq" element={<FAQTutorial />} />
              <Route path="/parent-view" element={<ParentView />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
