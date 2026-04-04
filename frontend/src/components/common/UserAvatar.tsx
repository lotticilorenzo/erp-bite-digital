import React from 'react';
import * as Avatar from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface UserAvatarProps {
  user?: User | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackDelay?: number;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-24 w-24 text-xl',
};

const getInitials = (user?: User | null) => {
  if (!user) return '??';
  const first = user.nome?.[0] || '';
  const last = user.cognome?.[0] || '';
  return (first + last).toUpperCase() || '??';
};

const getColorFromId = (id?: string) => {
  const colors = [
    'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'bg-rose-500/20 text-rose-400 border-rose-500/30',
    'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  ];
  
  if (!id) return colors[0];
  
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 'md',
  className,
  fallbackDelay = 600
}) => {
  const initials = getInitials(user);
  const colorClass = getColorFromId(user?.id);
  
  // Se avatar_url è presente, usiamolo. 
  // Il backend lo serve tramite /static/avatars/{id}.jpg
  const avatarUrl = user?.avatar_url;

  return (
    <Avatar.Root className={cn(
      "relative flex shrink-0 overflow-hidden rounded-full border",
      sizeClasses[size],
      className
    )}>
      {avatarUrl && (
        <Avatar.Image
          src={avatarUrl}
          alt={`${user?.nome} ${user?.cognome}`}
          className="aspect-square h-full w-full object-cover"
        />
      )}
      <Avatar.Fallback
        delayMs={fallbackDelay}
        className={cn(
          "flex h-full w-full items-center justify-center font-bold uppercase",
          colorClass
        )}
      >
        {initials}
      </Avatar.Fallback>
    </Avatar.Root>
  );
};
