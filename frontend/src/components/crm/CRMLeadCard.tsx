import { Calendar, User as UserIcon } from "lucide-react";
import type { CRMLead } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export function CRMLeadCard({ lead, isOverlay = false }: { lead: CRMLead; isOverlay?: boolean }) {
  const nextFollowup = lead.data_prossimo_followup ? new Date(lead.data_prossimo_followup) : null;
  const isExpired = nextFollowup && nextFollowup < new Date();

  return (
    <div 
      className={`bg-card/40 border border-white/5 p-5 rounded-[28px] shadow-xl hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden backdrop-blur-xl ${
        isOverlay ? 'cursor-grabbing scale-105 rotate-2 shadow-2xl' : ''
      }`}
    >
      {/* Dynamic Glow based on stage color */}
      <div 
        className="absolute -top-10 -right-10 w-24 h-24 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity"
        style={{ backgroundColor: lead.stadio?.colore || '#7c3aed' }}
      />
      
      {/* Animated Probability Bar Container */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-white/5">
        <div 
          className="h-full bg-gradient-to-r from-primary/40 to-primary shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-1000"
          style={{ width: `${lead.probabilita_chiusura}%` }}
        />
      </div>
      
      <div className="flex justify-between items-center mb-5 pt-1">
        <span className="text-[10px] font-black tracking-widest text-[#475569] uppercase flex items-center gap-1.5">
           <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lead.stadio?.colore }} />
           {lead.fonte || 'Lead Direct'}
        </span>
        <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black text-white tabular-nums group-hover:bg-primary/10 group-hover:text-primary transition-all">
          €{Number(lead.valore_stimato).toLocaleString()}
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="text-sm font-black text-white group-hover:text-primary transition-colors leading-tight mb-2 uppercase italic tracking-tighter">
          {lead.nome_azienda}
        </h3>
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
             <UserIcon className="h-3.5 w-3.5 text-[#64748b]" />
          </div>
          <span className="text-[11px] font-bold text-[#64748b] leading-none">{lead.nome_contatto || 'Contatto da definire'}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-tighter ${isExpired ? 'text-red-400 border-red-500/20' : 'text-[#64748b]'}`}>
          <Calendar className="h-3 w-3" />
          {lead.data_prossimo_followup ? format(new Date(lead.data_prossimo_followup), "d MMM", { locale: it }) : 'Prossimo FP'}
        </div>
        
        <div className="flex -space-x-2">
           <div className="h-7 w-7 rounded-xl bg-primary/20 flex items-center justify-center text-[8px] text-primary font-black border border-primary/20 shadow-lg group-hover:scale-110 transition-transform">
            {lead.assegnato_a_nome?.charAt(0) || 'L'}
          </div>
        </div>
      </div>
    </div>
  );
}
