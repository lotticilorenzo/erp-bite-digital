import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, FileText, Loader2, Trash2, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/common/UserAvatar';

interface ChatProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export function ChatProfileDialog({ open, onOpenChange }: ChatProfileDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    bio: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormData({
      nome: user?.nome || '',
      cognome: user?.cognome || '',
      bio: user?.bio || '',
    });
    setAvatarFile(null);
    setPreviewUrl(user?.avatar_url || null);
    setIsRemovingAvatar(false);
  }, [open, user]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const profileResponse = await api.patch('/users/me', formData);
      let avatarUrl = profileResponse.data.avatar_url ?? user?.avatar_url ?? null;

      if (avatarFile) {
        const avatarFormData = new FormData();
        avatarFormData.append('file', avatarFile);
        const avatarResponse = await api.post('/users/me/avatar', avatarFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        avatarUrl = avatarResponse.data.avatar_url;
      } else if (isRemovingAvatar && user?.avatar_url) {
        await api.delete('/users/me/avatar');
        avatarUrl = null;
      }

      return {
        ...profileResponse.data,
        avatar_url: avatarUrl,
      };
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user'], updatedUser);
      void queryClient.invalidateQueries({ queryKey: ['chat-users'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      toast.success('Profilo aggiornato');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'aggiornamento del profilo");
    },
  });

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("Seleziona un'immagine PNG, JPG o WebP");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error('Immagine troppo grande. Massimo 5 MB.');
      return;
    }

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setAvatarFile(file);
    setIsRemovingAvatar(false);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setAvatarFile(null);
    setPreviewUrl(null);
    setIsRemovingAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateProfileMutation.mutate();
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/60 bg-card/95 text-white backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Il mio profilo</DialogTitle>
          <DialogDescription>
            Aggiorna rapidamente nome, bio e immagine profilo senza uscire dalla chat.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 rounded-2xl border border-border/50 bg-background/40 p-5 md:flex-row md:items-center">
            <div className="relative">
              <UserAvatar
                user={previewUrl ? { ...user, avatar_url: previewUrl } : user}
                size="xl"
                className="h-24 w-24 rounded-full border-4 border-primary/20"
              />
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity hover:opacity-100"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <p className="text-base font-black uppercase tracking-wide">
                  {user?.nome} {user?.cognome}
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  {user?.ruolo}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border/50 bg-transparent"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Cambia immagine
                </Button>
                {previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                    onClick={handleRemoveAvatar}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Rimuovi
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chat-profile-name">Nome</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="chat-profile-name"
                  className="pl-10"
                  value={formData.nome}
                  onChange={(event) => setFormData((prev) => ({ ...prev, nome: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chat-profile-surname">Cognome</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="chat-profile-surname"
                  className="pl-10"
                  value={formData.cognome}
                  onChange={(event) => setFormData((prev) => ({ ...prev, cognome: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="chat-profile-bio">Bio</Label>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {formData.bio.length}/200
              </span>
            </div>
            <div className="relative">
              <FileText className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
              <textarea
                id="chat-profile-bio"
                className="min-h-[120px] w-full rounded-2xl border border-input bg-background px-4 pb-4 pl-11 pt-4 text-sm outline-none transition-colors focus:border-primary"
                value={formData.bio}
                maxLength={200}
                onChange={(event) => setFormData((prev) => ({ ...prev, bio: event.target.value }))}
                placeholder="Scrivi una breve bio visibile al team"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salva profilo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
