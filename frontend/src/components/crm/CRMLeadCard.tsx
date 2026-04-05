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
      className={`bg-card/60 border border-border/50 p-5 rounded-3xl shadow-xl hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden backdrop-blur-sm ${
        isOverlay ? 'cursor-grabbing scale-105 rotate-2 shadow-2xl' : ''
      }`}
    >
      {/* Probability Gradient background */}
      <div 
        className="absolute top-0 left-0 w-full h-1 opacity-20"
        style={{ 
          background: `linear-gradient(90deg, transparent, ${lead.stadio?.colore || '#7c3aed'}, transparent)`,
          width: `${lead.probabilita_chiusura}%`
        }} 
      />

      <div className="flex justify-between items-start mb-4">
        <Badge variant="outline" className="bg-white/5 text-[#64748b] border-white/5 font-black uppercase text-[9px] tracking-tight px-2 h-5">
          {lead.fonte || 'Lead'}
        </Badge>
        <span className="text-[11px] font-black text-white tabular-nums opacity-60 group-hover:opacity-100 transition-opacity">
          €{Number(lead.valore_stimato).toLocaleString()}
        </span>
      </div>

      <h3 className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">{lead.nome_azienda}</h3>
      <div className="flex items-center gap-2 mb-4">
        <UserIcon className="h-3 w-3 text-[#475569]" />
        <span className="text-[11px] font-medium text-[#475569] line-clamp-1">{lead.nome_contatto || 'Nessun referente'}</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isExpired ? 'text-red-400' : 'text-[#64748b]'}`}>
          <Calendar className="h-3 w-3" />
          {lead.data_prossimo_followup ? format(new Date(lead.data_prossimo_followup), "d MMM", { locale: it }) : 'No date'}
        </div>
        
        <div className="flex items-center gap-1">
          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[7px] text-primary font-bold border border-primary/20">
            {lead.assegnato_a_nome?.charAt(0) || '?'}
          </div>
        </div>
      </div>
    </div>
  );
}
