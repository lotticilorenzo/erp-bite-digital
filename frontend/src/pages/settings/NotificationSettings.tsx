import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Moon, 
  Save, 
  Loader2,
  Clock,
  Briefcase,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface NotificationPrefs {
  email: {
    urgent: boolean;
    reports: boolean;
    mentions: boolean;
  };
  push: {
    urgent: boolean;
    chat: boolean;
    reminders: boolean;
  };
  dnd: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

const defaultPrefs: NotificationPrefs = {
  email: { urgent: true, reports: true, mentions: true },
  push: { urgent: true, chat: true, reminders: true },
  dnd: { enabled: false, start: "22:00", end: "08:00" }
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    return (user?.preferences?.notifications as NotificationPrefs) || defaultPrefs;
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (newPrefs: NotificationPrefs) => {
      const response = await axios.patch("/api/v1/users/me", {
        preferences: {
          ...user?.preferences,
          notifications: newPrefs
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      toast.success("Preferenze notifiche salvate");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante il salvataggio");
    },
  });

  const Toggle = ({ checked, onChange, label, icon: Icon }: any) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-background/40 border border-border/50 hover:border-primary/50 transition-colors group">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          checked ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-10 pb-10">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notifiche e Avvisi
        </h2>
        <p className="text-sm text-muted-foreground">
          Configura come desideri ricevere gli aggiornamenti sulle commesse e le attività del team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Notifiche Email */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Notifiche Email
          </label>
          <div className="space-y-2">
            <Toggle 
              checked={prefs.email.urgent}
              onChange={(v: boolean) => setPrefs({...prefs, email: {...prefs.email, urgent: v}})}
              label="Task Urgenti"
              icon={AlertCircle}
            />
            <Toggle 
              checked={prefs.email.reports}
              onChange={(v: boolean) => setPrefs({...prefs, email: {...prefs.email, reports: v}})}
              label="Report Settimanali"
              icon={Briefcase}
            />
            <Toggle 
              checked={prefs.email.mentions}
              onChange={(v: boolean) => setPrefs({...prefs, email: {...prefs.email, mentions: v}})}
              label="Menzioni e Feedback"
              icon={MessageSquare}
            />
          </div>
        </div>

        {/* Notifiche Desktop/Push */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notifiche Push
          </label>
          <div className="space-y-2">
            <Toggle 
              checked={prefs.push.urgent}
              onChange={(v: boolean) => setPrefs({...prefs, push: {...prefs.push, urgent: v}})}
              label="Scadenze Imminenti"
              icon={AlertCircle}
            />
            <Toggle 
              checked={prefs.push.chat}
              onChange={(v: boolean) => setPrefs({...prefs, push: {...prefs.push, chat: v}})}
              label="Messaggi Chat"
              icon={MessageSquare}
            />
            <Toggle 
              checked={prefs.push.reminders}
              onChange={(v: boolean) => setPrefs({...prefs, push: {...prefs.push, reminders: v}})}
              label="Promemoria Timer"
              icon={Clock}
            />
          </div>
        </div>
      </div>

      {/* Non Disturbare */}
      <section className="space-y-6">
        <label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" />
          Modalità Non Disturbare
        </label>
        
        <div className={cn(
          "p-6 rounded-2xl border transition-all duration-300 space-y-6",
          prefs.dnd.enabled ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border/50"
        )}>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Silenzia tutte le notifiche</p>
              <p className="text-xs text-muted-foreground">Inibisce le notifiche push durante le ore specificate.</p>
            </div>
            <button
              onClick={() => setPrefs({...prefs, dnd: {...prefs.dnd, enabled: !prefs.dnd.enabled}})}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                prefs.dnd.enabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                prefs.dnd.enabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          {prefs.dnd.enabled && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <Label>Inizio</Label>
                <Input 
                  type="time" 
                  value={prefs.dnd.start} 
                  onChange={(e) => setPrefs({...prefs, dnd: {...prefs.dnd, start: e.target.value}})}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Fine</Label>
                <Input 
                  type="time" 
                  value={prefs.dnd.end} 
                  onChange={(e) => setPrefs({...prefs, dnd: {...prefs.dnd, end: e.target.value}})}
                  className="bg-background"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button 
          onClick={() => updatePrefsMutation.mutate(prefs)}
          disabled={updatePrefsMutation.isPending}
          className="gap-2"
        >
          {updatePrefsMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salva Notifiche
        </Button>
      </div>
    </div>
  );
}
