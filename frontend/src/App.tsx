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
const PricingFloorPage = React.lazy(() => import("./pages/PricingFloor"));
const ProiezioneCassaPage = React.lazy(() => import("./pages/ProiezioneCassa"));
const PLGestionalePage = React.lazy(() => import("./pages/PLGestionale"));
const ScadenzarioFiscalePage = React.lazy(() => import("./pages/ScadenzarioFiscale"));
const ImpostazioniFinanzaPage = React.lazy(() => import("./pages/ImpostazioniFinanza"));
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
const ContenutiPage = React.lazy(() => import("./pages/ContenutiPage"));
const RegoleRiconciliazionePageLazy = React.lazy(() => import("./pages/RegoleRiconciliazione"));
const PianificazioneDetailPage = React.lazy(() => import("./pages/PianificazioneDetail"));

const SettingsLayout = React.lazy(() => import("./pages/Settings"));
const ProfileSettings = React.lazy(() => import("./pages/settings/ProfileSettings"));
const AccountSettings = React.lazy(() => import("./pages/settings/AccountSettings"));
const AppearanceSettings = React.lazy(() => import("./pages/settings/AppearanceSettings"));
const NotificationSettings = React.lazy(() => import("./pages/settings/NotificationSettings"));
const PrivacySettings = React.lazy(() => import("./pages/settings/PrivacySettings"));
const AuditSettings = React.lazy(() => import("./pages/settings/AuditSettings"));
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPassword"));
const PopoutPage = React.lazy(() => import("./pages/PopoutPage"));

import { ThemeProvider } from "@/context/ThemeContext";
import { ChatProvider } from "@/context/ChatContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { hasFinanceAccess, isStudioOnlyRole, normalizeRole } from "@/lib/access";

const Spinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
    <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
  </div>
);

function App() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner />;

  const role = normalizeRole(user?.ruolo);
  const isStudioOnlyUser = isStudioOnlyRole(role);
  const isFinanceUser = hasFinanceAccess(role);

  // Guard: redirige gli utenti studio-only a Studio OS.
  const renderERPOnly = (element: React.ReactNode) =>
    isStudioOnlyUser ? <Navigate to="/studio-os" replace /> : element;

  // Guard: redirige i non-admin fuori dalla sezione finanziaria.
  const renderFinanceOnly = (element: React.ReactNode) =>
    isFinanceUser ? element : <Navigate to={isStudioOnlyUser ? "/studio-os" : "/"} replace />;

  return (
    <ThemeProvider>
      <ChatProvider>
        <ErrorBoundary>
          <Suspense fallback={<Spinner />}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                {/* Route pubbliche */}
                <Route
                  path="/login"
                  element={!user ? <LoginPage /> : <Navigate to={isStudioOnlyUser ? "/studio-os" : "/"} />}
                />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/*
                 * Layout principale: richiede autenticazione e rende il DashboardLayout
                 * per TUTTI i ruoli (sidebar si adatta via AppSidebar in base al ruolo).
                 * Fix bug precedente: il parent NON redirige più studio-only a /studio-os
                 * perché /studio-os/* è un figlio di questo layout — ciò causava un loop
                 * infinito. Il redirect per studio-only è ora sull'index route e sulle
                 * singole ERP route via renderERPOnly.
                 */}
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
                  {/* Index: studio-only → Studio OS, tutti gli altri → Dashboard */}
                  <Route index element={isStudioOnlyUser ? <Navigate to="/studio-os" replace /> : <DashboardPage />} />

                  {/* Studio OS — accessibile a TUTTI gli utenti autenticati */}
                  <Route path="/studio-os/*" element={<StudioPage />} />

                  {/* Settings — accessibili a TUTTI gli utenti autenticati */}
                  <Route path="/settings" element={<SettingsLayout />}>
                    <Route path="profile" element={<ProfileSettings />} />
                    <Route path="account" element={<AccountSettings />} />
                    <Route path="appearance" element={<AppearanceSettings />} />
                    <Route path="notifications" element={<NotificationSettings />} />
                    <Route path="privacy" element={<PrivacySettings />} />
                    <Route path="audit" element={<AuditSettings />} />
                  </Route>

                  {/* ── Route ERP: bloccate per utenti studio-only ─────────── */}
                  <Route path="/clienti" element={renderERPOnly(<ClientiPage />)} />
                  <Route path="/clienti/:id" element={renderERPOnly(<ClienteDetailPage />)} />
                  <Route path="/progetti" element={renderERPOnly(<ProgettiPage />)} />
                  <Route path="/progetti/:id" element={renderERPOnly(<ProgettoDetailPage />)} />
                  <Route path="/commesse" element={renderERPOnly(<CommessePage />)} />
                  <Route path="/commesse/:id" element={renderERPOnly(<CommessaDetailPage />)} />
                  <Route path="/pianificazioni/:id" element={renderERPOnly(<PianificazioneDetailPage />)} />
                  <Route path="/preventivi" element={renderERPOnly(<PreventiviPage />)} />
                  <Route path="/timesheet" element={renderERPOnly(<TimesheetPage />)} />
                  <Route path="/planning" element={renderERPOnly(<PlanningPage />)} />
                  <Route path="/collaboratori" element={renderERPOnly(<CollaboratoriPage />)} />
                  <Route path="/wiki" element={renderERPOnly(<WikiPage />)} />
                  <Route path="/crm" element={renderERPOnly(<CRMPage />)} />
                  <Route path="/crm/:id" element={renderERPOnly(<LeadDetailPage />)} />
                  <Route path="/contenuti" element={renderERPOnly(<ContenutiPage />)} />
                  <Route path="/task-templates" element={renderERPOnly(<TaskTemplatesPage />)} />

                  {/* ── Route Finance: solo ADMIN e DEVELOPER ──────────────── */}
                  <Route path="/fatture" element={renderFinanceOnly(<FatturePage />)} />
                  <Route path="/cassa" element={renderFinanceOnly(<CassaPage />)} />
                  <Route path="/cassa/regole" element={renderFinanceOnly(<RegoleRiconciliazionePageLazy />)} />
                  <Route path="/analytics" element={renderFinanceOnly(<AnalyticsPage />)} />
                  <Route path="/report" element={renderFinanceOnly(<ReportsPage />)} />
                  <Route path="/pricing-floor" element={renderFinanceOnly(<PricingFloorPage />)} />
                  <Route path="/proiezione-cassa" element={renderFinanceOnly(<ProiezioneCassaPage />)} />
                  <Route path="/pl-gestionale" element={renderFinanceOnly(<PLGestionalePage />)} />
                  <Route path="/scadenzario-fiscale" element={renderFinanceOnly(<ScadenzarioFiscalePage />)} />
                  <Route path="/impostazioni-finanza" element={renderFinanceOnly(<ImpostazioniFinanzaPage />)} />
                  <Route path="/fornitori" element={renderFinanceOnly(<Fornitori />)} />
                  <Route path="/fornitori/:id" element={renderFinanceOnly(<Fornitori />)} />
                  <Route path="/budget" element={renderFinanceOnly(<BudgetPage />)} />
                  <Route path="/admin/categorie-fornitori" element={renderFinanceOnly(<SupplierCategoryManager />)} />
                </Route>

                {/* Standalone popout window */}
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
