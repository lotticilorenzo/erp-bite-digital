import { useState, useMemo } from "react";
import { Search, Plus, MoreVertical, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatSidebarProps {
  channels: any[];
  users: any[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onStartDirectChat: (userId: string) => void;
  onlineUsers?: Set<string>;
  unreadCounts?: Record<string, number>;
  className?: string;
}

export function ChatSidebar({
  channels,
  users,
  activeChannelId,
  onSelectChannel,
  onStartDirectChat,
  onlineUsers = new Set(),
  unreadCounts = {},
  className
}: ChatSidebarProps) {
  const [category, setCategory] = useState<'all' | 'projects' | 'team'>('all');
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChannels = useMemo(() => {
    let list = channels;
    if (category === 'all') list = channels.filter(c => c.tipo === 'GENERAL' || c.tipo === 'GROUP' || c.tipo === 'DIRECT' || !c.tipo);
    if (category === 'projects') list = channels.filter(c => c.tipo === 'PROJECT');
    if (category === 'team') return []; // team tab shows users list instead

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.nome?.toLowerCase().includes(q) || c.last_message?.toLowerCase().includes(q));
    }
    return list;
  }, [channels, category, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u: any) =>
      `${u.nome} ${u.cognome}`.toLowerCase().includes(q) || u.ruolo?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className={cn("flex flex-col h-full bg-card/10 border-l border-border/10 pb-20 md:pb-0", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/10 bg-muted/5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black tracking-tighter uppercase italic opacity-80">Chat Hub</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <MoreVertical size={18} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Cerca chat..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-10 bg-background/30 border-border/10 rounded-xl focus-visible:ring-primary/20"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
              onClick={() => setSearchQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 p-3 bg-muted/20 shrink-0 border-b border-border/10 relative z-10">
        {[
          { id: 'all', label: 'Tutti' },
          { id: 'projects', label: 'Progetti' },
          { id: 'team', label: 'Team' }
        ].map(tab => {
          // Count total unread for tab badge
          const tabUnread = tab.id === 'all'
            ? Object.entries(unreadCounts).reduce((sum, [, n]) => sum + n, 0)
            : 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setCategory(tab.id as any); }}
              className={cn(
                "flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer relative",
                category === tab.id
                  ? "bg-primary text-primary-foreground shadow-[0_4px_12px_hsl(var(--primary)/0.3)] scale-[1.02]"
                  : "bg-background/40 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-border/5"
              )}
            >
              {tab.label}
              {tabUnread > 0 && tab.id === 'all' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-black text-white flex items-center justify-center shadow-lg">
                  {tabUnread > 9 ? '9+' : tabUnread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
        {category === 'team' ? (
          /* Collaborators list */
          <div className="animate-in fade-in duration-300">
            <p className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
              Collaboratori {searchQuery ? `(${filteredUsers.length})` : ''}
            </p>
            {filteredUsers.length === 0 ? (
              <p className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic text-center">
                Nessun collaboratore trovato.
              </p>
            ) : (
              filteredUsers.map((user: any) => {
                const isOnline = onlineUsers.has(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => onStartDirectChat(user.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] border-b border-border/5 transition-all group"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10 rounded-xl border border-border/20 group-hover:scale-105 transition-transform">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-muted text-[10px] font-black uppercase">
                          {user.nome[0]}{user.cognome[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                        isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-muted-foreground/30"
                      )} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[11px] font-black uppercase text-foreground/80 tracking-tight leading-none mb-1">
                        {user.nome} {user.cognome}
                      </p>
                      <p className={cn(
                        "text-[9px] font-bold uppercase tracking-widest",
                        isOnline ? "text-emerald-400" : "text-muted-foreground/50"
                      )}>
                        {isOnline ? "Online" : user.ruolo}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* Channels list */
          <div className="animate-in fade-in duration-300">
            {searchQuery && (
              <p className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                {filteredChannels.length} risultat{filteredChannels.length === 1 ? 'o' : 'i'}
              </p>
            )}
            {filteredChannels.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">
                  {searchQuery ? 'Nessun risultato trovato.' : 'Nessun canale trovato.'}
                </p>
              </div>
            )}

            {filteredChannels.map((channel) => {
              const isActive = activeChannelId === channel.id;
              const unread = unreadCounts[channel.id] || 0;

              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 transition-all border-b border-border/5 relative group",
                    isActive ? "bg-primary/5 border-r-2 border-r-primary" : "hover:bg-white/[0.02]"
                  )}
                >
                  <Avatar className="h-10 w-10 rounded-xl border border-border/20 shadow-sm group-hover:scale-105 transition-transform shrink-0">
                    <AvatarImage src={channel.logo_url} />
                    <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">
                      {channel.tipo === 'GENERAL' ? <Users size={16} /> : (channel.nome[0] + (channel.nome[1] || ''))}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn(
                        "text-[11px] font-black truncate tracking-tight transition-colors uppercase",
                        isActive ? "text-primary" : unread > 0 ? "text-foreground" : "text-foreground/70"
                      )}>
                        {channel.nome}
                      </span>
                      {channel.last_message_at && (
                        <span className="text-[9px] text-muted-foreground/50 font-medium shrink-0 ml-1">
                          {format(new Date(channel.last_message_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        "text-[10px] truncate italic leading-tight",
                        unread > 0 ? "text-foreground/70 font-bold not-italic" : "text-muted-foreground/60 opacity-80"
                      )}>
                        {channel.last_message || (channel.tipo === 'GENERAL' ? 'Benvenuto nel team!' : 'Inizia la conversazione...')}
                      </p>
                      {unread > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-primary text-[9px] font-black text-white flex items-center justify-center px-1 shadow-lg shadow-primary/30">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/10 bg-muted/10 shrink-0 sticky bottom-16 md:bottom-20 z-10 backdrop-blur-md">
        <Button className="w-full h-10 bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/30 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-primary hover:scale-[1.02] active:scale-95 transition-all">
          <Plus size={16} />
          <span>Nuovo Gruppo</span>
        </Button>
      </div>
    </div>
  );
}
