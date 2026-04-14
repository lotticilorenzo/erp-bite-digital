import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Users,
  UserPlus,
  UserMinus,
  Shield,
  Crown,
  Info,
  Hash,
  Check,
} from "lucide-react";

interface Member {
  user_id: string;
  ruolo: string;
  user?: { id: string; nome: string; cognome: string; ruolo: string; avatar_url?: string };
}

interface Channel {
  id: string;
  nome: string;
  tipo: string;
  descrizione?: string;
  logo_url?: string;
  membri?: Member[];
  created_at?: string;
}

interface ChatGroupInfoPanelProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatGroupInfoPanel({ channel, isOpen, onClose }: ChatGroupInfoPanelProps) {
  const { user } = useAuth();
  const isAdmin = (user as any)?.ruolo === "ADMIN";
  const queryClient = useQueryClient();
  const [addingMode, setAddingMode] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());

  // All users available to add
  const { data: allUsers } = useQuery({
    queryKey: ["chat-users"],
    queryFn: async () => {
      const res = await axios.get("/chat/users");
      return res.data;
    },
    enabled: isOpen && addingMode,
  });

  const currentMemberIds = new Set(
    (channel.membri || []).map((m) => m.user_id)
  );

  const availableToAdd = (allUsers || []).filter(
    (u: any) => !currentMemberIds.has(u.id)
  );

  // Add members mutation
  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      await axios.post(
        `/chat/channels/${channel.id}/members?action=add`,
        userIds
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
      setAddingMode(false);
      setSelectedToAdd(new Set());
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await axios.post(
        `/chat/channels/${channel.id}/members?action=remove`,
        [userId]
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
    },
  });

  const toggleSelectAdd = (uid: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const tipoLabel: Record<string, string> = {
    GENERAL: "Chat Generale",
    PROJECT: "Chat Progetto",
    GROUP: "Gruppo",
    DIRECT: "Chat Diretta",
  };

  return (
    <div
      className={cn(
        "absolute right-0 top-0 bottom-0 z-30 flex flex-col bg-card border-l border-border/40 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden",
        isOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none"
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-primary" />
          <span className="text-xs font-black uppercase tracking-[0.25em] text-foreground">
            Info Gruppo
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          {/* Channel Identity */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/20 text-3xl font-black text-primary">
              {channel.logo_url ? (
                <img
                  src={channel.logo_url}
                  alt=""
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                channel.tipo === "DIRECT" ? (
                  <Users size={32} className="text-primary opacity-60" />
                ) : (
                  channel.nome?.[0]?.toUpperCase() || "#"
                )
              )}
            </div>
            <div className="text-center">
              <h3 className="font-black text-base uppercase tracking-widest text-foreground">
                {channel.nome}
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">
                <Hash size={10} />
                {tipoLabel[channel.tipo] || channel.tipo}
              </span>
            </div>
          </div>

          {channel.descrizione && (
            <div className="p-3 bg-muted/30 rounded-2xl border border-border/30">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {channel.descrizione}
              </p>
            </div>
          )}

          {/* Members Section */}
          {channel.tipo !== "DIRECT" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Membri · {(channel.membri || []).length}
                  </span>
                </div>
                {isAdmin && !addingMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl"
                    onClick={() => setAddingMode(true)}
                  >
                    <UserPlus size={12} className="mr-1" />
                    Aggiungi
                  </Button>
                )}
              </div>

              {/* Add members mode */}
              {addingMode && isAdmin && (
                <div className="mb-4 bg-muted/20 border border-border/30 rounded-2xl overflow-hidden">
                  <div className="p-3 border-b border-border/20 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      Seleziona utenti da aggiungere
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-lg"
                      onClick={() => {
                        setAddingMode(false);
                        setSelectedToAdd(new Set());
                      }}
                    >
                      <X size={12} />
                    </Button>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    {availableToAdd.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-4 uppercase font-black tracking-widest">
                        Tutti gli utenti sono già nel gruppo
                      </p>
                    ) : (
                      availableToAdd.map((u: any) => (
                        <button
                          key={u.id}
                          onClick={() => toggleSelectAdd(u.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all hover:bg-primary/5",
                            selectedToAdd.has(u.id) && "bg-primary/10"
                          )}
                        >
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarFallback className="text-[10px] font-black bg-primary/10 text-primary">
                              {u.nome?.[0]}{u.cognome?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-left text-xs font-bold truncate">
                            {u.nome} {u.cognome}
                          </span>
                          {selectedToAdd.has(u.id) && (
                            <Check size={14} className="text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {selectedToAdd.size > 0 && (
                    <div className="p-3 border-t border-border/20">
                      <Button
                        className="w-full h-9 text-xs font-black uppercase tracking-widest rounded-xl bg-primary hover:bg-primary/90"
                        onClick={() =>
                          addMembersMutation.mutate(Array.from(selectedToAdd))
                        }
                        disabled={addMembersMutation.isPending}
                      >
                        <UserPlus size={13} className="mr-1.5" />
                        Aggiungi {selectedToAdd.size} utent{selectedToAdd.size === 1 ? "e" : "i"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Members list */}
              <div className="space-y-1">
                {(channel.membri || []).map((member) => {
                  const u = member.user;
                  const isOwner = member.ruolo === "ADMIN";
                  const isSelf = u?.id === (user as any)?.id;

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 group/member transition-all"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="w-8 h-8">
                          {u?.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <AvatarFallback className="text-[10px] font-black bg-primary/10 text-primary">
                              {u?.nome?.[0]}{u?.cognome?.[0]}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        {isOwner && (
                          <Crown
                            size={10}
                            className="absolute -top-1 -right-1 text-yellow-400 fill-yellow-400"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">
                          {u?.nome} {u?.cognome}
                          {isSelf && (
                            <span className="ml-1 text-[9px] text-primary font-black uppercase">
                              (Tu)
                            </span>
                          )}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1">
                          {u?.ruolo === "ADMIN" ? (
                            <>
                              <Shield size={8} className="text-violet-400" />
                              Admin
                            </>
                          ) : (
                            u?.ruolo?.toLowerCase()
                          )}
                        </p>
                      </div>

                      {/* Remove button (admin only, can't remove self from general) */}
                      {isAdmin && !isSelf && channel.tipo !== "GENERAL" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-xl opacity-0 group-hover/member:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={() => removeMemberMutation.mutate(member.user_id)}
                          disabled={removeMemberMutation.isPending}
                          title="Rimuovi dal gruppo"
                        >
                          <UserMinus size={12} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Channel type for DIRECT chats */}
          {channel.tipo === "DIRECT" && (
            <div className="text-center py-4 opacity-40">
              <p className="text-[10px] font-black uppercase tracking-[0.25em]">
                Chat privata diretta
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
