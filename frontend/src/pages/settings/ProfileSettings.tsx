import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { 
  User as UserIcon, 
  Mail, 
  FileText, 
  Save,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-500/10 text-red-500 border-red-500/20",
  PM: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  DIPENDENTE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  FREELANCER: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

export default function ProfileSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nome: user?.nome || "",
    cognome: user?.cognome || "",
    bio: user?.bio || "",
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await axios.patch("/api/v1/users/me", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      toast.success("Profilo aggiornato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'aggiornamento");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Profilo Personale</h2>
        <p className="text-sm text-muted-foreground">
          Gestisci le tue informazioni pubbliche (all'interno del team) e la tua biografia.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-6 p-6 rounded-2xl bg-muted/30 border border-border/50">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="h-20 w-20 rounded-2xl bg-primary/20 flex items-center justify-center border-2 border-primary/30 relative group overflow-hidden">
               <UserIcon className="h-10 w-10 text-primary" />
               <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                 <span className="text-[10px] font-bold text-white">CAMBIA</span>
               </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{user?.nome} {user?.cognome}</h3>
                <Badge variant="outline" className={cn("font-bold text-[10px]", roleColors[user?.ruolo || "DIPENDENTE"])}>
                  {user?.ruolo}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <div className="relative">
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Il tuo nome"
                  className="pl-10"
                />
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cognome">Cognome</Label>
              <div className="relative">
                <Input
                  id="cognome"
                  value={formData.cognome}
                  onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                  placeholder="Il tuo cognome"
                  className="pl-10"
                />
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className={cn(
                "text-[10px] font-medium",
                formData.bio.length > 180 ? "text-orange-500" : "text-muted-foreground"
              )}>
                {formData.bio.length} / 200
              </span>
            </div>
            <div className="relative">
              <textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, 200) })}
                placeholder="Raccontaci qualcosa di te..."
                className="w-full min-h-[100px] bg-background border border-input rounded-xl p-3 pt-10 text-sm focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
              />
              <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => setFormData({
            nome: user?.nome || "",
            cognome: user?.cognome || "",
            bio: user?.bio || "",
          })}>
            Annulla
          </Button>
          <Button type="submit" disabled={updateProfileMutation.isPending} className="gap-2">
            {updateProfileMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salva Modifiche
          </Button>
        </div>
      </form>
    </div>
  );
}
