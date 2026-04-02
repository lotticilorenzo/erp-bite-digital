import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import ClientiPage from "@/pages/Clienti";
import ProgettiPage from "@/pages/Progetti";
import ProgettoDetailPage from "@/pages/ProgettoDetail";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import GenericPlaceholder from "@/components/GenericPlaceholder";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clienti"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ClientiPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/progetti"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ProgettiPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/progetti/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ProgettoDetailPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/commesse"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <GenericPlaceholder title="Commesse" />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/timesheet"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <GenericPlaceholder title="Timesheet" />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/studio-os"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <GenericPlaceholder title="Studio OS" />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
