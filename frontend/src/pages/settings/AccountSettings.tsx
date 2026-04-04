import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { 
  KeyRound, 
  Globe, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Save,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const passwordRequirements = [
  { id: 'length', label: 'Almeno 8 caratteri', regex: /.{8,}/ },
  { id: 'number', label: 'Almeno un numero', regex: /[0-9]/ },
  { id: 'special', label: 'Almeno un carattere speciale (!@#$%^&*)', regex: /[!@#$%^&*]/ },
];

export default function AccountSettings() {
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [regional, setRegional] = useState(() => {
    const saved = localStorage.getItem("bite_erp_regional_settings");
    return saved ? JSON.parse(saved) : {
      currency: "EUR",
      dateFormat: "DD/MM/YYYY",
      timeZone: "Europe/Rome"
    };
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      // In un backend reale verificheremmo anche la password corrente
      // Per ora usiamo PATCH /users/me
      const response = await axios.patch("/api/v1/users/me", {
        password: data.new
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Password aggiornata correttamente");
      setPasswords({ current: "", new: "", confirm: "" });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante il cambio password");
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error("Le password non coincidono");
      return;
    }
    if (!passwordRequirements.every(req => req.regex.test(passwords.new))) {
      toast.error("La password non soddisfa i requisiti di sicurezza");
      return;
    }
    changePasswordMutation.mutate(passwords);
  };

  const handleRegionalSave = () => {
    localStorage.setItem("bite_erp_regional_settings", JSON.stringify(regional));
    toast.success("Impostazioni regionali salvate");
    window.dispatchEvent(new Event('regional-settings-changed'));
  };

  return (
    <div className="space-y-10 pb-10">
      {/* Sezione Sicurezza */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Sicurezza Account
          </h2>
          <p className="text-sm text-muted-foreground">
            Proteggi il tuo account aggiornando regolarmente la password.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-8 p-6 rounded-2xl bg-muted/30 border border-border/50">
          <div className="grid gap-6">
             {/* Password Corrente (Placeholder se serve verifica) */}
            <div className="space-y-2">
              <Label htmlFor="current">Password Corrente</Label>
              <div className="relative">
                <Input
                  id="current"
                  type={showPassword ? "text" : "password"}
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                />
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="new">Nuova Password</Label>
                <div className="relative">
                  <Input
                    id="new"
                    type={showPassword ? "text" : "password"}
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    placeholder="Nuova password"
                    className="pl-10"
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Conferma Password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    placeholder="Conferma password"
                    className="pl-10"
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Requisiti */}
            <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-background/50 border border-border/50">
              {passwordRequirements.map((req) => {
                const isValid = req.regex.test(passwords.new);
                return (
                  <div key={req.id} className="flex items-center gap-2 text-[11px] font-medium">
                    {isValid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                    <span className={cn(isValid ? "text-green-500" : "text-muted-foreground")}>
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={changePasswordMutation.isPending || !passwords.new || passwords.new !== passwords.confirm}
              className="gap-2"
            >
              {changePasswordMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Aggiorna Password
            </Button>
          </div>
        </form>
      </section>

      {/* Sezione Regionali */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Preferenze Regionali
          </h2>
          <p className="text-sm text-muted-foreground">
            Scegli come visualizzare i dati finanziari e le date nel sistema.
          </p>
        </div>

        <div className="space-y-6 p-6 rounded-2xl bg-muted/30 border border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Valuta Principale</Label>
              <select 
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                value={regional.currency}
                onChange={(e) => setRegional({...regional, currency: e.target.value})}
              >
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar (US$)</option>
                <option value="GBP">Pound (£)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Formato Data</Label>
              <select 
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                value={regional.dateFormat}
                onChange={(e) => setRegional({...regional, dateFormat: e.target.value})}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (Italia)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fuso Orario</Label>
              <select 
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                value={regional.timeZone}
                onChange={(e) => setRegional({...regional, timeZone: e.target.value})}
              >
                <option value="Europe/Rome">Europe/Rome (CET)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button onClick={handleRegionalSave} className="gap-2">
              <Save className="h-4 w-4" />
              Salva Preferenze
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
