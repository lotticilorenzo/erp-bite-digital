import React from 'react';
import type { LucideIcon } from "lucide-react";
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in-95 duration-700">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-150 animate-pulse" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-card border border-border shadow-2xl">
          <Icon className="h-10 w-10 text-primary opacity-80" />
        </div>
      </div>
      
      <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">
        {title}
      </h3>
      <p className="max-w-[300px] text-sm font-medium text-slate-500 leading-relaxed mb-8">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="h-10 rounded-xl bg-primary px-6 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
