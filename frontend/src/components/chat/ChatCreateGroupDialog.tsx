import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import type { User } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatCreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}

const MAX_GROUP_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function ChatCreateGroupDialog({ open, onOpenChange, users }: ChatCreateGroupDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createGroupChannel, uploadFile } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupName, setGroupName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupImageFile, setGroupImageFile] = useState<File | null>(null);
  const [groupImagePreviewUrl, setGroupImagePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGroupName('');
    setMemberSearch('');
    setSelectedMemberIds([]);
    setGroupImageFile(null);
    setGroupImagePreviewUrl(null);
    setIsSubmitting(false);
  }, [open]);

  useEffect(() => {
    return () => {
      if (groupImagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(groupImagePreviewUrl);
      }
    };
  }, [groupImagePreviewUrl]);

  const availableUsers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return users.filter((candidate) => {
      if (candidate.id === user?.id) return false;
      if (!query) return true;
      return `${candidate.nome} ${candidate.cognome}`.toLowerCase().includes(query)
        || candidate.ruolo?.toLowerCase().includes(query);
    });
  }, [memberSearch, user?.id, users]);

  const selectedMembers = useMemo(() => {
    const selectedIds = new Set(selectedMemberIds);
    return users.filter((candidate) => selectedIds.has(candidate.id));
  }, [selectedMemberIds, users]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleGroupImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("Il logo del gruppo deve essere un'immagine");
      return;
    }
    if (file.size > MAX_GROUP_IMAGE_SIZE_BYTES) {
      toast.error('Logo troppo grande. Massimo 5 MB.');
      return;
    }

    if (groupImagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(groupImagePreviewUrl);
    }

    setGroupImageFile(file);
    setGroupImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveGroupImage = () => {
    if (groupImagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(groupImagePreviewUrl);
    }
    setGroupImageFile(null);
    setGroupImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Inserisci un nome per il gruppo');
      return;
    }
    if (selectedMemberIds.length === 0) {
      toast.error('Seleziona almeno un altro membro');
      return;
    }

    setIsSubmitting(true);
    try {
      let logoUrl: string | null = null;
      if (groupImageFile) {
        const uploadResponse = await uploadFile(groupImageFile);
        logoUrl = uploadResponse.url;
      }

      const createdChannel = await createGroupChannel({
        nome: groupName.trim(),
        logo_url: logoUrl,
        member_ids: selectedMemberIds,
      });

      if (createdChannel) {
        toast.success('Gruppo creato con successo');
        navigate(`/studio-os?channel=${createdChannel.id}`);
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Impossibile creare il gruppo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-border/60 bg-card/95 text-white backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Nuovo gruppo</DialogTitle>
          <DialogDescription>
            Scegli nome, logo opzionale e i collaboratori da includere nella nuova chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="space-y-3">
              <Label>Logo gruppo</Label>
              <button
                type="button"
                className="group relative flex h-40 w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border/60 bg-background/40"
                onClick={() => fileInputRef.current?.click()}
              >
                {groupImagePreviewUrl ? (
                  <img src={groupImagePreviewUrl} alt="Anteprima logo gruppo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Immagine opzionale</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleGroupImageChange}
              />
              {groupImagePreviewUrl && (
                <Button type="button" variant="ghost" className="w-full" onClick={handleRemoveGroupImage}>
                  <X className="mr-2 h-4 w-4" />
                  Rimuovi immagine
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-group-name">Nome gruppo</Label>
                <Input
                  id="new-group-name"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Es. Team Creativo Retainer"
                />
              </div>

              <div className="rounded-2xl border border-border/50 bg-background/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Partecipanti</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                    Tu
                  </span>
                  {selectedMembers.map((member) => (
                    <span
                      key={member.id}
                      className="inline-flex items-center rounded-full bg-card/8 px-3 py-1 text-[11px] font-bold"
                    >
                      {member.nome} {member.cognome}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-member-search">Aggiungi membri</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="group-member-search"
                    className="pl-10"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Cerca per nome o ruolo"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/30">
            <ScrollArea className="h-72">
              <div className="divide-y divide-border/30">
                {availableUsers.map((candidate) => {
                  const isSelected = selectedMemberIds.includes(candidate.id);
                  return (
                    <label
                      key={candidate.id}
                      className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-card/5"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMember(candidate.id)}
                      />
                      <Avatar className="h-11 w-11 rounded-2xl border border-border/50">
                        <AvatarImage src={candidate.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {candidate.nome[0]}{candidate.cognome[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black uppercase tracking-wide">
                          {candidate.nome} {candidate.cognome}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                          {candidate.ruolo}
                        </p>
                      </div>
                      {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                    </label>
                  );
                })}

                {availableUsers.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nessun collaboratore trovato con questa ricerca.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleCreateGroup}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crea gruppo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
