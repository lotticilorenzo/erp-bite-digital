import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import { StudioProvider } from "@/context/StudioContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

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
const GanttPage = React.lazy(() => import("./pages/GanttPage"));
const BudgetPage = React.lazy(() => import("./components/budget/BudgetPage"));
const WikiPage = React.lazy(() => import("./components/wiki/WikiPage"));
import Fornitori from "./pages/Fornitori";
import SupplierCategoryManager from "./pages/admin/SupplierCategoryManager";

const SettingsLayout = React.lazy(() => import("./pages/Settings"));
const ProfileSettings = React.lazy(() => import("./pages/settings/ProfileSettings"));
const AccountSettings = React.lazy(() => import("./pages/settings/AccountSettings"));
const AppearanceSettings = React.lazy(() => import("./pages/settings/AppearanceSettings"));
const NotificationSettings = React.lazy(() => import("./pages/settings/NotificationSettings"));
const PrivacySettings = React.lazy(() => import("./pages/settings/PrivacySettings"));
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPassword"));

import { ThemeProvider } from "@/context/ThemeContext";

function App() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      }>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        <Route
          path="/"
          element={
            user ? (
              <StudioProvider>
                <DashboardLayout />
              </StudioProvider>
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
          <Route path="/fornitori" element={<Fornitori />} />
          <Route path="/gantt" element={<GanttPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/wiki" element={<WikiPage />} />
          <Route path="/admin/categorie-fornitori" element={<SupplierCategoryManager />} />
          
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

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
    </ThemeProvider>
  );
}

export default App;
