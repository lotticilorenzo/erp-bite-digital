import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Shield, 
  Monitor, 
  Smartphone, 
  LogOut, 
  Download, 
  Trash2, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from "axios";

const sessions = [
  { 
    id: 1, 
    device: "Chrome on Windows 11", 
    location: "Milano, Italia", 
    ip: "151.12.3.45", 
    current: true,
    lastActive: "Ora"
  },
  { 
    id: 2, 
    device: "Safari on iPhone 15", 
    location: "Roma, Italia", 
    ip: "93.44.5.67", 
    current: false,
    lastActive: "2 ore fa"
  }
];

export default function PrivacySettings() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await axios.get("/api/v1/users/me/export");
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `bite_erp_data_${user?.nome}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success("Dati esportati con successo");
    } catch (err) {
      toast.error("Errore durante l'esportazione");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDisconnectAll = async () => {
    setIsDisconnecting(true);
    // Mock call to /auth/sessions
    try {
      await axios.delete("/api/v1/auth/sessions");
      toast.success("Disconnesso da tutti i dispositivi");
      // Per demo, non slogghiamo l'utente corrente ma mostriamo il toast
    } catch (err) {
      toast.error("Errore durante la disconnessione");
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

      {/* Sessioni Attive */}
      <section className="space-y-6">
        <label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" />
          Sessioni Attive
        </label>

        <div className="space-y-3">
          {sessions.map((session) => (
            <div 
              key={session.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                session.current ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border/50"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  session.current ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {session.device.includes("iPhone") ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{session.device}</p>
                    {session.current && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                        Questa Sessione
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{session.location} • {session.ip} • {session.lastActive}</p>
                </div>
              </div>
              {!session.current && (
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500">
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 rounded-xl bg-orange-500/20 text-orange-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Disconnetti tutti gli altri dispositivi</p>
              <p className="text-xs text-muted-foreground">Chiudi tutte le sessioni tranne quella attuale per sicurezza.</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleDisconnectAll} 
            disabled={isDisconnecting}
            className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10 shrink-0"
          >
            {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnetti Tutti"}
          </Button>
        </div>
      </section>

      {/* Controllo Dati */}
      <section className="space-y-6">
        <label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          Gestione e Portabilità dei Dati
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Esporta */}
          <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-4 hover:border-primary/30 transition-colors group">
            <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Download className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Esporta i tuoi dati</p>
              <p className="text-xs text-muted-foreground">Scarica un archivio JSON con tutte le tue informazioni e preferenze.</p>
            </div>
            <Button 
              onClick={handleExport} 
              disabled={isExporting}
              className="w-full mt-2"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inizia Esportazione"}
            </Button>
          </div>

          {/* Elimina */}
          <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-4 hover:border-red-500/30 transition-colors group">
            <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Elimina Account</p>
              <p className="text-xs text-muted-foreground">Azione irreversibile che cancella i tuoi dati personali dal sistema.</p>
            </div>
            <Button 
              variant="outline"
              className="w-full mt-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
            >
              Richiedi Eliminazione
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
