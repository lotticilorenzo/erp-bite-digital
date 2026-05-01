import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertTriangle,
  Download,
  Loader2,
  Monitor,
  Shield,
  Smartphone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import api, { getErrorMessage } from "@/lib/api";

interface ActiveSession {
  id: string;
  current: boolean;
  ip?: string | null;
  user_agent: string;
  last_active_at: string;
}

interface SessionInventoryResponse {
  mode: string;
  supports_session_inventory: boolean;
  supports_selective_revoke: boolean;
  supports_global_revoke: boolean;
  note?: string;
  sessions: ActiveSession[];
}

function summarizeUserAgent(userAgent: string) {
  const raw = userAgent.trim();
  if (!raw) return "Browser sconosciuto";
  if (/windows/i.test(raw) && /chrome/i.test(raw)) return "Chrome su Windows";
  if (/mac os/i.test(raw) && /safari/i.test(raw)) return "Safari su macOS";
  if (/iphone|android|mobile/i.test(raw)) return raw.length > 72 ? `${raw.slice(0, 72)}...` : raw;
  if (/linux/i.test(raw) && /chrome/i.test(raw)) return "Chrome su Linux";
  return raw.length > 72 ? `${raw.slice(0, 72)}...` : raw;
}

function formatLastActive(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Attiva ora";
  return parsed.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PrivacySettings() {
  const { user, logout } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<SessionInventoryResponse>({
    mode: "stateless_jwt",
    supports_session_inventory: false,
    supports_selective_revoke: false,
    supports_global_revoke: true,
    sessions: [],
  });

  useEffect(() => {
    let active = true;

    const loadSessions = async () => {
      try {
        const { data } = await api.get<SessionInventoryResponse>("/auth/sessions");
        if (!active) return;
        setSessionInfo(data);
      } catch (error) {
        if (!active) return;
        toast.error(getErrorMessage(error, "Impossibile caricare le sessioni attive"));
      } finally {
        if (active) {
          setIsLoadingSessions(false);
        }
      }
    };

    void loadSessions();
    return () => {
      active = false;
    };
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get("/users/me/export");
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute(
        "download",
        `bite_erp_data_${user?.nome}_${new Date().toISOString().split("T")[0]}.json`,
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
      toast.success("Dati esportati con successo");
    } catch (error) {
      toast.error(getErrorMessage(error, "Errore durante l'esportazione"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDisconnectAll = async () => {
    setIsDisconnecting(true);
    try {
      await api.delete("/auth/sessions");
      toast.success("Tutte le sessioni sono state revocate");
      logout();
    } catch (error) {
      toast.error(getErrorMessage(error, "Errore durante la disconnessione"));
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Privacy e Dati
        </h2>
        <p className="text-sm text-muted-foreground">
          Gestisci la tua sicurezza digitale, le sessioni attive e il controllo sui tuoi dati personali.
        </p>
      </div>

      <section className="space-y-6">
        <label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" />
          Sessioni Attive
        </label>

        <div className="space-y-3">
          {isLoadingSessions ? (
            <div className="p-4 rounded-2xl border border-border/50 bg-muted/20 text-sm text-muted-foreground">
              Caricamento sessioni in corso...
            </div>
          ) : (
            sessionInfo.sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                  session.current ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border/50",
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-xl",
                      session.current ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {/iphone|android|mobile/i.test(session.user_agent) ? (
                      <Smartphone className="h-5 w-5" />
                    ) : (
                      <Monitor className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{summarizeUserAgent(session.user_agent)}</p>
                      {session.current && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                          Questa Sessione
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.ip || "IP non disponibile"} - {formatLastActive(session.last_active_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}

          {!isLoadingSessions && sessionInfo.note && (
            <div className="p-4 rounded-2xl border border-border/50 bg-muted/20 text-xs text-muted-foreground">
              {sessionInfo.note}
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 rounded-xl bg-orange-500/20 text-orange-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Revoca tutte le sessioni</p>
              <p className="text-xs text-muted-foreground">
                Invalida tutti i token attivi del tuo account, inclusa la sessione corrente.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleDisconnectAll}
            disabled={isDisconnecting || !sessionInfo.supports_global_revoke}
            className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10 shrink-0"
          >
            {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoca Sessioni"}
          </Button>
        </div>
      </section>

      <section className="space-y-6">
        <label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          Gestione e Portabilita dei Dati
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-4 hover:border-primary/30 transition-colors group">
            <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Download className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Esporta i tuoi dati</p>
              <p className="text-xs text-muted-foreground">
                Scarica un archivio JSON con account, assegnazioni, task e timesheet collegati al tuo profilo.
              </p>
            </div>
            <Button onClick={handleExport} disabled={isExporting} className="w-full mt-2">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inizia Esportazione"}
            </Button>
          </div>

          <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-4 hover:border-red-500/30 transition-colors group">
            <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Elimina Account</p>
              <p className="text-xs text-muted-foreground">
                Workflow enterprise da attivare con retention policy, approvazioni e audit trail dedicato.
              </p>
            </div>
            <Button
              variant="outline"
              disabled
              className="w-full mt-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
            >
              In Configurazione
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
