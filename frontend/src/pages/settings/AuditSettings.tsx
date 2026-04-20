import { ShieldCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { useAuth } from "@/hooks/useAuth";

export default function AuditSettings() {
  const { user } = useAuth();
  const canView = user?.ruolo === "ADMIN" || user?.ruolo === "DEVELOPER";

  if (!canView) {
    return <Navigate to="/settings/profile" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-white">Audit Trail</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Storico modifiche globale per accountability e debugging operativo.
        </p>
      </div>

      <AuditLogTable title="Storico Modifiche" defaultLimit={100} />
    </div>
  );
}
