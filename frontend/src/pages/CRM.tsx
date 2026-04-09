import { useState } from "react";
import { 
  Plus, 
  LayoutDashboard, 
  List as ListIcon, 
  Search, 
  Filter, 
  MoreVertical,
  Briefcase,
  Download
} from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CRMBoard } from "@/components/crm/CRMBoard";
import { CRMStats } from "@/components/crm/CRMStats";
import { CRMLeadModal } from "@/components/crm/CRMLeadModal";

export default function CRM() {
  const { leads, stages, stats, createLead } = useCRM();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const filteredLeads = leads.filter(l => 
    l.nome_azienda.toLowerCase().includes(search.toLowerCase()) ||
    l.nome_contatto?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 min-h-screen bg-[#020617]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-[28px] bg-primary/10 flex items-center justify-center shadow-2xl shadow-primary/20 backdrop-blur-xl border border-primary/20">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">CRM <span className="text-primary">Pipeline</span></h1>
            <p className="text-[#64748b] text-sm mt-1 font-medium italic">Gestisci i lead e monitora le opportunità di vendita</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-xl">
            <Button 
              variant={view === "kanban" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setView("kanban")}
              className={`rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest transition-all ${
                view === "kanban" ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-[#475569]'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button 
              variant={view === "list" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setView("list")}
              className={`rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest transition-all ${
                view === "list" ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-[#475569]'
              }`}
            >
              <ListIcon className="h-4 w-4 mr-2" />
              Lista
            </Button>
          </div>
          
          <Button 
            className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest px-8 h-12 rounded-2xl shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95"
            onClick={() => createLead.mutate({ nome_azienda: "Nuovo Lead", stadio_id: stages[0]?.id })}
          >
            <Plus className="h-5 w-5 mr-3" />
            Nuovo Lead
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <CRMStats stats={stats || { valore_totale_pipeline: 0, numero_lead_attivi: 0, tasso_conversione: 0, previsione_ricavi: 0 }} />

      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="relative w-full md:w-[400px] group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Cerca per azienda o contatto..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-12 bg-white/5 border-white/5 h-12 rounded-2xl focus:ring-primary/20 text-white placeholder:text-[#334155]"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-12 rounded-2xl bg-white/5 border-white/5 text-[#475569] font-bold px-6 hover:bg-white/10">
            <Filter className="h-4 w-4 mr-2" />
            Filtri
          </Button>
          <Button variant="outline" className="h-12 rounded-2xl bg-white/5 border-white/5 text-[#475569] font-bold px-6 hover:bg-white/10">
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <CRMBoard onSelectLead={(lead) => setSelectedLeadId(lead.id)} />
      ) : (
        <div className="bg-card/40 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-[#475569]">
              <tr>
                <th className="px-8 py-5">Azienda</th>
                <th className="px-8 py-5">Stadio</th>
                <th className="px-8 py-5">Valore</th>
                <th className="px-8 py-5">Probabilità</th>
                <th className="px-8 py-5">Data Followup</th>
                <th className="px-8 py-5">Assegnatario</th>
                <th className="px-8 py-5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLeads.map(lead => (
                <tr 
                  key={lead.id} 
                  className="group hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  <td className="px-8 py-5">
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">{lead.nome_azienda}</div>
                      <div className="text-[10px] text-[#475569] font-medium">{lead.nome_contatto || 'Nessun contatto'}</div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <Badge variant="outline" className="bg-white/5 text-[#64748b] border-white/5 font-bold uppercase text-[9px]">
                      {lead.stadio?.nome}
                    </Badge>
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-white tabular-nums">
                    €{Number(lead.valore_stimato).toLocaleString()}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${lead.probabilita_chiusura}%` }} />
                      </div>
                      <span className="text-[11px] font-black tabular-nums text-white">{lead.probabilita_chiusura}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-[#64748b]">
                    {lead.data_prossimo_followup || '-'}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                       <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[8px] text-primary font-bold">
                        {lead.assegnato_a_nome?.charAt(0)}
                      </div>
                      <span className="text-xs text-[#475569] font-bold">{lead.assegnato_a_nome?.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <Button variant="ghost" size="icon" className="text-[#1e293b] hover:text-white rounded-xl">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLeads.length === 0 && (
             <div className="text-center py-20">
               <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                 <Search className="h-10 w-10 text-[#1e293b]" />
               </div>
               <h3 className="text-xl font-black text-white mb-2">Nessun lead trovato</h3>
               <p className="text-[#475569] text-sm">Prova a cambiare i criteri di ricerca o crea un nuovo lead.</p>
             </div>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedLeadId && (
        <CRMLeadModal 
          leadId={selectedLeadId} 
          onClose={() => setSelectedLeadId(null)} 
        />
      )}
    </div>
  );
}
