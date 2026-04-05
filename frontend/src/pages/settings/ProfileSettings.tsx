import React, { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  User as UserIcon, 
  Mail, 
  FileText, 
  Save,
  Loader2,
  Camera,
  Trash2,
  Download
} from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { UserPerformancePDF } from "@/components/reports/UserPerformancePDF";
import { useTimesheets } from "@/hooks/useTimesheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/common/UserAvatar";
import { startOfYear } from "date-fns";
import api from "@/lib/api";

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-500/10 text-red-500 border-red-500/20",
  PM: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  DIPENDENTE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  FREELANCER: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

export default function ProfileSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userTimesheets = [] } = useTimesheets({ user_id: user?.id });
  
  const [formData, setFormData] = useState({
    nome: user?.nome || "",
    cognome: user?.cognome || "",
    bio: user?.bio || "",
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.avatar_url || null);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // 1. Aggiorna dati testuali
      const response = await api.patch("/users/me", data);
      
      // 2. Se c'è un nuovo file avatar, caricalo
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        await api.post("/users/me/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } 
      // 3. Se l'avatar è stato rimosso
      else if (isRemovingAvatar && user?.avatar_url) {
        await api.delete("/users/me/avatar");
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      setAvatarFile(null);
      setIsRemovingAvatar(false);
      toast.success("Profilo aggiornato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'aggiornamento");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File troppo grande. Massimo 5MB.");
        return;
      }
      setAvatarFile(file);
      setIsRemovingAvatar(false);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setPreviewUrl(null);
    setIsRemovingAvatar(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      nome: user?.nome || "",
      cognome: user?.cognome || "",
      bio: user?.bio || "",
    });
    setAvatarFile(null);
    setPreviewUrl(user?.avatar_url || null);
    setIsRemovingAvatar(false);
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
          <div className="flex flex-col md:flex-row gap-8 items-center border-b border-border/50 pb-8">
            <div className="relative group">
              <div className="relative">
                <UserAvatar 
                  user={previewUrl ? { ...user!, avatar_url: previewUrl } : { ...user!, avatar_url: null }} 
                  size="xl" 
                  className="h-32 w-32 rounded-full border-4 border-primary/20 shadow-xl"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="w-6 h-6 text-white" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Cambia</span>
                  </div>
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            
            <div className="flex flex-col gap-3 items-center md:items-start text-center md:text-left">
              <div className="space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h3 className="text-xl font-bold text-white">{user?.nome} {user?.cognome}</h3>
                  <Badge variant="outline" className={cn("font-bold text-[10px]", roleColors[user?.ruolo || "DIPENDENTE"])}>
                    {user?.ruolo}
                  </Badge>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{user?.email}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[11px] border-border bg-transparent text-muted-foreground hover:text-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Carica nuova foto
                </Button>
                {previewUrl && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-400/10"
                    onClick={handleRemoveAvatar}
                  >
                    <Trash2 className="w-3 h-3 mr-1.5" /> Rimuovi
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">PNG, JPG o WebP. Massimo 5MB. Verrà ritagliata a 200x200px.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</Label>
              <div className="relative">
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Il tuo nome"
                  className="pl-10 h-11 bg-background/50 border-border focus:ring-primary/20"
                />
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cognome" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cognome</Label>
              <div className="relative">
                <Input
                  id="cognome"
                  value={formData.cognome}
                  onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                  placeholder="Il tuo cognome"
                  className="pl-10 h-11 bg-background/50 border-border focus:ring-primary/20"
                />
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="bio" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bio</Label>
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
                className="w-full min-h-[120px] bg-background/50 border border-border rounded-xl p-4 pt-11 text-sm focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none shadow-inner"
              />
              <FileText className="absolute left-4 top-4 h-4.5 w-4.5 text-muted-foreground/60" />
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 rounded-2xl bg-primary/5 border border-primary/20 shadow-inner">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Performance & Analisi
              </h3>
              <p className="text-sm text-muted-foreground">
                Scarica il tuo report personalizzato con KPI, ore lavorate e allocazione sui clienti.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <PDFDownloadLink
                document={
                  <UserPerformancePDF 
                    user={user!} 
                    timesheets={userTimesheets} 
                    periodo={`Anno Corrente (${new Date().getFullYear()})`}
                    startDate={startOfYear(new Date())}
                    endDate={new Date()}
                  />
                }
                fileName={`Report_Performance_${user?.nome}_${user?.cognome}_${new Date().getFullYear()}.pdf`}
              >
                {({ loading }) => (
                  <Button 
                    type="button"
                    disabled={loading}
                    className="w-full md:w-auto h-11 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 gap-2 font-black uppercase text-[10px] tracking-widest"
                  >
                    <Download className="w-4 h-4" />
                    {loading ? "Generazione..." : "Scarica Report Personale"}
                  </Button>
                )}
              </PDFDownloadLink>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-8">
          <Button type="button" variant="ghost" onClick={resetForm} className="text-muted-foreground">
            Annulla
          </Button>
          <Button type="submit" disabled={updateProfileMutation.isPending} className="gap-2 px-8 shadow-lg shadow-primary/20 h-11 font-bold">
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
