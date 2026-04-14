import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  LayoutDashboard, 
  List as ListIcon, 
  Search, 
  MoreVertical,
  Briefcase,
  Download,
  Edit2,
  Trash2,
  ArrowRightLeft,
  Zap,
  Flame,
  Clock3,
  Euro as EuroIcon,
  Mail,
  Settings,
  CheckCircle2,
  Settings2
} from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CRMBoard } from "@/components/crm/CRMBoard";
import { CRMStats } from "@/components/crm/CRMStats";
import { CRMLeadModal } from "@/components/crm/CRMLeadModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CRM() {
  const { leads, stages, stats, isLoading, createLead, convertLeadToClient, deleteLead } = useCRM();
  const navigate = useNavigate();
  const [view, setView] = useState<"kanban" | "list" | "automations" | "settings">("kanban");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "hot" | "no_activity" | "high_value">("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.nome_azienda.toLowerCase().includes(search.toLowerCase()) ||
                         l.nome_contatto?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterType === "hot") return (l.lead_score || 0) > 70;
    if (filterType === "no_activity") return !l.attivita || l.attivita.length === 0;
    if (filterType === "high_value") return Number(l.valore_stimato) > 5000;
    
    return true;
  });

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-200 h-screen flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-[28px] bg-primary/10 flex items-center justify-center shadow-2xl shadow-primary/20 backdrop-blur-xl border border-primary/20 group hover:scale-105 transition-all">
            <Briefcase className="h-8 w-8 text-primary group-hover:rotate-6 transition-transform" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
              CRM <span className="text-primary not-italic">Pipeline</span>
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase px-2">
                Sales Engine
              </Badge>
              <p className="text-[#475569] text-[10px] font-black uppercase tracking-widest italic">Monitora le tue opportunità commerciali</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-muted/20 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md flex gap-1">
            <NavTab active={view === "kanban"} onClick={() => setView("kanban")} icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Pipeline" />
            <NavTab active={view === "list"} onClick={() => setView("list")} icon={<ListIcon className="h-3.5 w-3.5" />} label="Lista" />
            <NavTab active={view === "automations"} onClick={() => setView("automations")} icon={<Zap className="h-3.5 w-3.5" />} label="Automazioni" />
            <NavTab active={view === "settings"} onClick={() => setView("settings")} icon={<Settings className="h-3.5 w-3.5" />} label="Setup" />
          </div>
          
          <Button 
            className="bg-primary hover:scale-[1.02] transition-transform text-white font-black uppercase tracking-widest px-6 h-12 rounded-2xl shadow-xl shadow-primary/20 border-t border-white/10"
            disabled={!stages || stages.length === 0}
            onClick={() => {
              if (stages.length > 0) {
                createLead.mutate({ nome_azienda: "Nuovo Lead", stadio_id: stages[0].id });
              }
            }}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuovo Lead
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-muted-foreground/60">
            <div className="h-4 w-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest">Caricamento pipeline...</span>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      {!isLoading && <CRMStats stats={stats || { valore_totale_pipeline: 0, numero_lead_attivi: 0, tasso_conversione: 0, previsione_ricavi: 0 }} />}

      {/* Filters & Actions */}
      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-[350px] group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Cerca per azienda..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-12 bg-white/5 border-white/5 h-12 rounded-2xl focus:ring-primary/20 text-white placeholder:text-[#334155]"
            />
          </div>

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 ml-2">
             <FilterBtn active={filterType === "all"} onClick={() => setFilterType("all")} label="Tutti" />
             <FilterBtn active={filterType === "hot"} onClick={() => setFilterType("hot")} icon={<Flame className="w-3 h-3" />} label="Hot" color="text-orange-400" />
             <FilterBtn active={filterType === "no_activity"} onClick={() => setFilterType("no_activity")} icon={<Clock3 className="w-3 h-3" />} label="Da Sollecitare" color="text-red-400" />
             <FilterBtn active={filterType === "high_value"} onClick={() => setFilterType("high_value")} icon={<EuroIcon className="w-3 h-3" />} label="Top Deal" color="text-emerald-400" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-12 rounded-2xl bg-white/5 border-white/5 text-[#475569] font-black uppercase text-[10px] tracking-widest px-6 hover:bg-white/10">
            <Download className="h-4 w-4 mr-2" />
            Esporta CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" && (
        <CRMBoard onSelectLead={(lead) => navigate(`/crm/${lead.id}`)} />
      )}
      
      {view === "list" && (
        <div className="bg-card/40 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-[#475569]">
              <tr>
                <th className="px-8 py-5">Azienda</th>
                <th className="px-8 py-5">Stadio</th>
                <th className="px-8 py-5">Valore</th>
                <th className="px-8 py-5">Score</th>
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
                  onClick={() => navigate(`/crm/${lead.id}`)}
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
                      <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${(lead.lead_score || 0) > 70 ? 'bg-orange-400' : 'bg-primary'}`} style={{ width: `${lead.lead_score || 0}%` }} />
                      </div>
                      <span className="text-[11px] font-black tabular-nums text-white">{lead.lead_score || 0}</span>
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
                  <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-[#1e293b] hover:text-white rounded-xl">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card/95 border-white/10 backdrop-blur-xl rounded-2xl p-2 min-w-[170px] shadow-2xl">
                        <DropdownMenuItem 
                          onClick={() => navigate(`/crm/${lead.id}`)}
                          className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#64748b] hover:text-white hover:bg-white/5 rounded-xl cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-primary" /> Dettagli Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => convertLeadToClient.mutate(lead.id)}
                          className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 rounded-xl cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3 h-3" /> Chiudi Vinto
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/5 my-1" />
                        <DropdownMenuItem 
                          onClick={() => deleteLead.mutate(lead.id)}
                          className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Elimina Lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {view === "automations" && (
        <div className="flex-1 overflow-y-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500 pb-8 pr-1 custom-scrollbar">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AutomationCard 
                 title="Auto-Scoring" 
                 description="Calcola automaticamente il calore del lead basato su revenue stimata e frequenza attività."
                 icon={<Zap className="w-5 h-5 text-orange-400" />}
                 enabled={true}
              />
              <AutomationCard 
                 title="Follow-up Automatico" 
                 description="Invia un'email di cortesia se un lead 'Hot' non riceve attività per più di 3 giorni."
                 icon={<Mail className="w-5 h-5 text-blue-400" />}
                 enabled={false}
                 badge="PRO"
              />
              <AutomationCard 
                 title="Smart Routing" 
                 description="Assegna automaticamente i lead 'One-off' ai junior e 'Retainer' ai Senior PM."
                 icon={<ArrowRightLeft className="w-5 h-5 text-purple-400" />}
                 enabled={true}
              />
           </div>

           <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Cronologia <span className="text-primary not-italic">Automazioni</span></h3>
                    <p className="text-xs text-[#475569] font-medium mt-1 uppercase tracking-widest">Azioni eseguite dal Sales Engine nelle ultime 24 ore</p>
                 </div>
                 <Button variant="outline" className="h-10 rounded-xl bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest text-[#475569]">
                    Vedi Log Completi
                 </Button>
              </div>

              <div className="space-y-4">
                 {[
                    { time: '10:45', action: 'Lead Assigned', target: 'Digital Edge SRL', by: 'Smart Routing' },
                    { time: '09:12', action: 'Score Updated', target: 'TechFlow Co.', by: 'Auto-Scoring' },
                    { time: 'Ieri 18:30', action: 'Alert Sent', target: 'Marco Rossi', by: 'Stagnazione' },
                 ].map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                             <CheckCircle2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                             <div className="text-sm font-bold text-white">{log.action}: {log.target}</div>
                             <div className="text-[10px] text-[#475569] font-medium uppercase tracking-widest">Eseguito da: {log.by}</div>
                          </div>
                       </div>
                       <div className="text-[10px] font-black tabular-nums text-[#475569]">{log.time}</div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {view === "settings" && (
        <div className="flex-1 overflow-y-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500 pb-8 pr-1 custom-scrollbar">
           <div className="p-12 text-center bg-white/5 border border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center">
              <Settings2 className="w-12 h-12 text-[#1e293b] mb-4" />
              <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">CRM <span className="text-primary not-italic">Setup</span></h3>
              <p className="text-[#475569] text-sm max-w-md mx-auto mt-2 font-medium">Coming soon: Personalizza stadi del funnel, campi custom e permessi di accesso per il tuo team sales.</p>
           </div>
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

function NavTab({ active, onClick, icon, label }: any) {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      className={`rounded-xl h-9 px-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
        active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-[#475569] hover:text-white'
      }`}
    >
      {icon}
      {label}
    </Button>
  );
}

function FilterBtn({ active, onClick, icon, label, color = "text-white" }: any) {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      className={`rounded-xl h-8 px-3 text-[8px] font-black uppercase tracking-widest transition-all gap-1.5 ${
        active ? 'bg-white/10 text-white' : 'text-[#475569] hover:text-[#64748b]'
      }`}
    >
      {icon && <span className={color}>{icon}</span>}
      {label}
    </Button>
  );
}

function AutomationCard({ title, description, icon, enabled, badge }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] hover:bg-white/[0.07] transition-all group relative overflow-hidden">
        <div className="absolute top-6 right-6">
            {badge ? (
                <Badge className="bg-primary text-[8px] font-black uppercase px-2 h-5 rounded-full">{badge}</Badge>
            ) : (
                <div className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-[#1e293b]'}`} />
            )}
        </div>
        <div className="p-4 bg-white/5 rounded-2xl w-fit mb-6 group-hover:bg-primary/10 transition-colors">
            {icon}
        </div>
        <h4 className="text-lg font-black italic uppercase tracking-tighter mb-2 text-white">{title}</h4>
        <p className="text-xs text-[#475569] font-medium leading-relaxed mb-8">{description}</p>
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Stato: <span className={enabled ? 'text-emerald-400' : ''}>{enabled ? 'Attivo' : 'Inattivo'}</span></span>
            <Button 
                variant="ghost" 
                className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest ${enabled ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
            >
                {enabled ? 'Disattiva' : 'Attiva'}
            </Button>
        </div>
    </div>
  );
}
