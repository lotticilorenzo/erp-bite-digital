import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Plus, Search, UserCircle2, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types';
import type { ChatChannel } from '@/types/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ChatCreateGroupDialog } from './ChatCreateGroupDialog';
import { ChatProfileDialog } from './ChatProfileDialog';

interface ChatSidebarProps {
  channels: ChatChannel[];
  users: User[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onStartDirectChat: (userId: string) => void;
  onlineUsers?: Set<string>;
  unreadCounts?: Record<string, number>;
  category: 'all' | 'projects' | 'team';
  onCategoryChange: (cat: 'all' | 'projects' | 'team') => void;
  className?: string;
}

export function ChatSidebar({
  channels,
  users,
  activeChannelId,
  onSelectChannel,
  onStartDirectChat,
  onlineUsers = new Set<string>(),
  unreadCounts = {},
  category,
  onCategoryChange,
  className,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const filteredChannels = useMemo(() => {
    let list = channels;
    if (category === 'all') {
      list = channels.filter((channel) => channel.tipo === 'GENERAL' || channel.tipo === 'GROUP' || channel.tipo === 'DIRECT' || !channel.tipo);
    }
    if (category === 'projects') {
      list = channels.filter((channel) => channel.tipo === 'PROJECT');
    }
    if (category === 'team') return [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((channel) =>
        channel.nome?.toLowerCase().includes(query)
        || channel.last_message?.toLowerCase().includes(query)
      );
    }

    return list;
  }, [category, channels, searchQuery]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((candidate) => {
      if (candidate.id === currentUser?.id) return false;
      if (!query) return true;
      return `${candidate.nome} ${candidate.cognome}`.toLowerCase().includes(query)
        || candidate.ruolo?.toLowerCase().includes(query);
    });
  }, [currentUser?.id, searchQuery, users]);

  return (
    <>
      <div className={cn('flex h-full flex-col border-l border-border/10 bg-card/10', className)}>
        <div className="shrink-0 border-b border-border/10 bg-muted/5 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black uppercase italic tracking-tighter opacity-80">Chat Hub</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border/60 bg-card/95">
                <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => setIsProfileOpen(true)}>
                  <UserCircle2 className="mr-2 h-4 w-4" />
                  Il mio profilo
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => setIsCreateGroupOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Nuovo gruppo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => navigate('/settings/profile')}>
                  Apri impostazioni profilo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Cerca chat..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 rounded-xl border-border/10 bg-background/30 pl-9 pr-8 focus-visible:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 gap-2 border-b border-border/10 bg-muted/20 p-3">
          {[
            { id: 'all', label: 'Tutti' },
            { id: 'projects', label: 'Progetti' },
            { id: 'team', label: 'Team' },
          ].map((tab) => {
            const tabUnread = tab.id === 'all'
              ? Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)
              : 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCategoryChange(tab.id as 'all' | 'projects' | 'team');
                }}
                className={cn(
                  'relative flex-1 cursor-pointer rounded-xl py-2 text-[11px] font-black uppercase tracking-widest transition-all',
                  category === tab.id
                    ? 'scale-[1.02] bg-primary text-primary-foreground shadow-[0_4px_12px_hsl(var(--primary)/0.3)]'
                    : 'border border-border/5 bg-background/40 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                )}
              >
                {tab.label}
                {tabUnread > 0 && tab.id === 'all' && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-white shadow-lg">
                    {tabUnread > 9 ? '9+' : tabUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {category === 'team' ? (
            <div className="animate-in fade-in duration-300">
              <p className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                Collaboratori {searchQuery ? `(${filteredUsers.length})` : ''}
              </p>
              {filteredUsers.length === 0 ? (
                <p className="px-4 py-6 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">
                  Nessun collaboratore trovato.
                </p>
              ) : (
                filteredUsers.map((candidate) => {
                  const activeChannel = channels.find((channel) => channel.id === activeChannelId);
                  const isUserActive = activeChannel?.tipo === 'DIRECT'
                    && activeChannel.membri?.some((member) => member.user_id === candidate.id);
                  const isOnline = onlineUsers.has(candidate.id);

                  return (
                    <button
                      key={candidate.id}
                      onClick={() => onStartDirectChat(candidate.id)}
                      className={cn(
                        'group relative flex w-full items-center gap-3 border-b border-border/5 p-4 transition-all',
                        isUserActive ? 'bg-primary/5 border-r-2 border-r-primary' : 'hover:bg-white/[0.02]'
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10 rounded-xl border border-border/20 transition-transform group-hover:scale-105">
                          <AvatarImage src={candidate.avatar_url || undefined} />
                          <AvatarFallback className="bg-muted text-[10px] font-black uppercase">
                            {candidate.nome[0]}{candidate.cognome[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                            isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-muted-foreground/30'
                          )}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="mb-1 text-[11px] font-black uppercase leading-none tracking-tight text-foreground/80">
                          {candidate.nome} {candidate.cognome}
                        </p>
                        <p className={cn(
                          'text-[9px] font-bold uppercase tracking-widest',
                          isOnline ? 'text-emerald-400' : 'text-muted-foreground/50'
                        )}>
                          {isOnline ? 'Online' : candidate.ruolo}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
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
                      'group relative flex w-full items-center gap-3 border-b border-border/5 p-4 transition-all duration-300',
                      isActive ? 'border-r-2 border-r-primary bg-primary/5 shadow-inner' : 'hover:bg-white/[0.02]'
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0 rounded-xl border border-border/20 shadow-sm transition-transform group-hover:scale-105">
                      <AvatarImage src={channel.logo_url || undefined} />
                      <AvatarFallback className="bg-primary/5 text-[10px] font-black text-primary">
                        {channel.tipo === 'GENERAL' ? <Users size={16} /> : (channel.nome[0] + (channel.nome[1] || ''))}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span
                          className={cn(
                            'truncate text-[11px] font-black uppercase tracking-tight transition-colors',
                            isActive ? 'text-primary' : unread > 0 ? 'text-foreground' : 'text-foreground/70'
                          )}
                        >
                          {channel.nome}
                        </span>
                        {channel.last_message_at && (
                          <span className="ml-1 shrink-0 text-[9px] font-medium text-muted-foreground/50">
                            {format(new Date(channel.last_message_at), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            'truncate text-[10px] leading-tight italic',
                            unread > 0 ? 'font-bold text-foreground/70 not-italic' : 'text-muted-foreground/60 opacity-80'
                          )}
                        >
                          {channel.last_message || (channel.tipo === 'GENERAL' ? 'Benvenuto nel team!' : 'Inizia la conversazione...')}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-white shadow-lg shadow-primary/30">
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

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/10 bg-muted/10 p-4 backdrop-blur-md">
          <Button
            className="flex h-10 w-full items-center gap-2 rounded-xl bg-primary/90 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] hover:bg-primary active:scale-95"
            onClick={() => setIsCreateGroupOpen(true)}
          >
            <Plus size={16} />
            <span>Nuovo Gruppo</span>
          </Button>
        </div>
      </div>

      <ChatProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
      <ChatCreateGroupDialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen} users={users} />
    </>
  );
}
