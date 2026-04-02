import React from 'react';
import * as Avatar from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

interface ClientAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getColorFromName = (name: string) => {
  const colors = [
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-rose-100 text-rose-700 border-rose-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export const ClientAvatar: React.FC<ClientAvatarProps> = ({ 
  name, 
  logoUrl, 
  size = 'md',
  className 
}) => {
  const initials = getInitials(name);
  const colorClass = getColorFromName(name);
  
  // Se logoUrl non è assoluto (inizia con /static), aggiungiamo l'origin del backend se necessario
  // Ma in produzione di solito l'app è servita dalla stessa porta o proxyata.
  // Per ora usiamo il path relativo.
  const fullLogoUrl = logoUrl;

  return (
    <Avatar.Root className={cn(
      "relative flex shrink-0 overflow-hidden rounded-lg border",
      sizeClasses[size],
      className
    )}>
      {fullLogoUrl && (
        <Avatar.Image
          src={fullLogoUrl}
          alt={name}
          className="aspect-square h-full w-full object-contain p-1"
        />
      )}
      <Avatar.Fallback
        className={cn(
          "flex h-full w-full items-center justify-center font-semibold uppercase",
          colorClass
        )}
      >
        {initials}
      </Avatar.Fallback>
    </Avatar.Root>
  );
};
