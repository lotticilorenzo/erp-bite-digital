// HMR Verification: Live reload is active!
import React, { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import { StudioProvider } from "@/context/StudioContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "sonner";

const ClientiPage = React.lazy(() => import("./pages/Clienti"));
const ClienteDetailPage = React.lazy(() => import("./pages/ClienteDetail"));
const ProgettiPage = React.lazy(() => import("./pages/Progetti"));
const ProgettoDetailPage = React.lazy(() => import("./pages/ProgettoDetail"));
const CommessePage = React.lazy(() => import("./pages/Commesse"));
const CommessaDetailPage = React.lazy(() => import("./pages/CommessaDetail"));
const PreventiviPage = React.lazy(() => import("./pages/PreventiviPage"));
const TimesheetPage = React.lazy(() => import("./pages/Timesheet"));
const FatturePage = React.lazy(() => import("./pages/Fatture"));
const CassaPage = React.lazy(() => import("./pages/Cassa"));
const StudioPage = React.lazy(() => import("./pages/Studio"));
const AnalyticsPage = React.lazy(() => import("./pages/Analytics"));
const ReportsPage = React.lazy(() => import("./pages/Reports"));
const PlanningPage = React.lazy(() => import("./pages/Planning"));
const CollaboratoriPage = React.lazy(() => import("./pages/Collaboratori"));
const BudgetPage = React.lazy(() => import("./components/budget/BudgetPage"));
const WikiPage = React.lazy(() => import("./components/wiki/WikiPage"));
const CRMPage = React.lazy(() => import("./pages/CRM"));
const LeadDetailPage = React.lazy(() => import("./pages/LeadDetail"));
const Fornitori = React.lazy(() => import("./pages/Fornitori"));
const SupplierCategoryManager = React.lazy(() => import("./pages/admin/SupplierCategoryManager"));
const TaskTemplatesPage = React.lazy(() => import("./pages/TaskTemplatesPage"));

const SettingsLayout = React.lazy(() => import("./pages/Settings"));
const ProfileSettings = React.lazy(() => import("./pages/settings/ProfileSettings"));
const AccountSettings = React.lazy(() => import("./pages/settings/AccountSettings"));
const AppearanceSettings = React.lazy(() => import("./pages/settings/AppearanceSettings"));
const NotificationSettings = React.lazy(() => import("./pages/settings/NotificationSettings"));
const PrivacySettings = React.lazy(() => import("./pages/settings/PrivacySettings"));
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPassword"));
const PopoutPage = React.lazy(() => import("./pages/PopoutPage"));

import { ThemeProvider } from "@/context/ThemeContext";
import { ChatProvider } from "@/context/ChatContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// Ruoli con accesso limitato al solo Studio OS
const STUDIO_ONLY_ROLES = ["COLLABORATORE", "DIPENDENTE", "FREELANCER"];

function App() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  const isStudioOnlyUser = user ? STUDIO_ONLY_ROLES.includes(user.ruolo?.toUpperCase() ?? "") : false;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ChatProvider>
        <ErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        }>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={isStudioOnlyUser ? "/studio-os" : "/"} />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            <Route
              path="/"
              element={
                user ? (
                  // Redirect automatico: utenti solo-studio vanno a Studio OS
                  isStudioOnlyUser ? (
                    <Navigate to="/studio-os" replace />
                  ) : (
                    <StudioProvider>
                      <DashboardLayout />
                    </StudioProvider>
                  )
                ) : (
                  <Navigate to="/login" />
                )
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="/clienti" element={<ClientiPage />} />
              <Route path="/clienti/:id" element={<ClienteDetailPage />} />
              <Route path="/progetti" element={<ProgettiPage />} />
              <Route path="/progetti/:id" element={<ProgettoDetailPage />} />
              <Route path="/commesse" element={<CommessePage />} />
              <Route path="/commesse/:id" element={<CommessaDetailPage />} />
              <Route path="/preventivi" element={<PreventiviPage />} />
              <Route path="/timesheet" element={<TimesheetPage />} />
              <Route path="/fatture" element={<FatturePage />} />
              <Route path="/cassa" element={<CassaPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/report" element={<ReportsPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/collaboratori" element={<CollaboratoriPage />} />
              <Route path="/fornitori" element={<Fornitori />} />
              <Route path="/budget" element={<BudgetPage />} />
              <Route path="/wiki" element={<WikiPage />} />
              <Route path="/crm" element={<CRMPage />} />
              <Route path="/crm/:id" element={<LeadDetailPage />} />
              <Route path="/admin/categorie-fornitori" element={<SupplierCategoryManager />} />
              <Route path="/task-templates" element={<TaskTemplatesPage />} />
              
              <Route 
                path="/studio-os/*" 
                element={<StudioPage />} 
              />
  
              <Route path="/settings" element={<SettingsLayout />}>
                <Route path="profile" element={<ProfileSettings />} />
                <Route path="account" element={<AccountSettings />} />
                <Route path="appearance" element={<AppearanceSettings />} />
                <Route path="notifications" element={<NotificationSettings />} />
                <Route path="privacy" element={<PrivacySettings />} />
              </Route>
            </Route>
  
            {/* ── Standalone popout window ── */}
            <Route path="/popout" element={user ? <PopoutPage /> : <Navigate to="/login" />} />
  
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AnimatePresence>
        </Suspense>
        </ErrorBoundary>
        <Toaster position="top-right" richColors closeButton />
      </ChatProvider>
    </ThemeProvider>
  );
}

export default App;
