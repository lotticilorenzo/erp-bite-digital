import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/Login";
import { useAuth } from "@/hooks/useAuth";
import { Rocket, Loader2, Layout, Shield, Zap, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen space-y-12 max-w-5xl">
        <header className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Rocket className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Benvenuto, <span className="text-primary italic">{user?.nome}</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl px-4">
            Identità verificata. La Fase 1 è stata implementata con successo.
            Il client API è pronto per la migrazione dei moduli.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {[
            { icon: Zap, label: "Axios Client", status: "Pronto" },
            { icon: Shield, label: "JWT Auth", status: "Attivo" },
            { icon: Layout, label: "Routing", status: "Configurato" },
            { icon: Terminal, label: "React Query", status: "Configurato" },
          ].map((item, i) => (
            <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <item.icon className="w-6 h-6 text-primary" />
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[10px] uppercase tracking-widest text-primary font-bold">{item.status}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col items-center space-y-4">
           <Button onClick={logout} variant="outline" className="border-primary/20 text-primary hover:bg-primary/10 transition-colors">
            Disconnetti
          </Button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
