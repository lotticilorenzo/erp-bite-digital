import { useState, useEffect } from "react";
import { 
  X, 
  Calendar, 
  Trash2, 
  Plus, 
  User as UserIcon,
  CheckCircle2,
  Activity,
  History,
  Briefcase
} from "lucide-react";
import type { CRMLead } from "@/types/crm";
import { useCRM } from "@/hooks/useCRM";
import { useUsers } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CRMLeadModal({ 
  leadId, 
  onClose 
}: { 
  leadId: string; 
  onClose: () => void 
}) {
  const { leads, stages, updateLead, addActivity, deleteLead, convertLeadToClient } = useCRM();
  const { data: users } = useUsers();
  const lead = leads.find(l => l.id === leadId);

  const [editData, setEditData] = useState<Partial<CRMLead>>({});
  const [newActivity, setNewActivity] = useState({ tipo: 'Nota', descrizione: '' });

  useEffect(() => {
    if (lead) {
      setEditData(lead);
    }
  }, [lead]);

  if (!lead) return null;

  const handleSave = async () => {
    try {
      await updateLead.mutateAsync({ id: leadId, data: editData });
      toast.success("Lead aggiornato");
    } catch (err) {
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.descrizione) return;
    try {
      await addActivity.mutateAsync({ lead_id: leadId, data: newActivity });
      setNewActivity({ tipo: 'Nota', descrizione: '' });
    } catch (err) {
      toast.error("Errore durante l'invio dell'attività");
    }
  };

  const isVinto = lead.probabilita_chiusura === 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-card/60 w-full max-w-5xl max-h-[90vh] rounded-3xl border border-white/5 shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{lead.nome_azienda}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white/5 text-[#64748b] border-none text-[10px] uppercase font-black tracking-widest px-1.5 h-4.5">
                  ID: {leadId.substring(0, 8)}
                </Badge>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                  {lead.stadio?.nome} • {lead.probabilita_chiusura}% Probabilità
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isVinto ? (
              <Button 
                variant="outline" 
                className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border-emerald-500/20 text-emerald-500 font-black uppercase text-[10px] tracking-widest px-4"
                onClick={() => convertLeadToClient.mutate(leadId)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                Converti in Cliente
              </Button>
            ) : (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black uppercase text-[10px] px-3 h-8">
                Già Convertito
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-10 w-10 text-slate-400 hover:text-white hover:bg-white/5 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Info & Form */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar border-r border-white/5">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Azienda</Label>
                  <Input 
                    value={editData.nome_azienda || ""} 
                    onChange={e => setEditData({ ...editData, nome_azienda: e.target.value })}
                    className="bg-white/5 border-white/5 h-12 rounded-xl focus:ring-primary/20"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Referente</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569]" />
                    <Input 
                      value={editData.nome_contatto || ""} 
                      onChange={e => setEditData({ ...editData, nome_contatto: e.target.value })}
                      className="bg-white/5 border-white/5 h-12 px-10 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Status Lead</Label>
                  <Select 
                    value={editData.stadio_id} 
                    onValueChange={v => setEditData({ ...editData, stadio_id: v })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/5 h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f172a] border-white/10 rounded-xl">
                      {stages.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-white hover:bg-primary/10">
                          {s.nome} ({s.probabilita}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Valore Stimato (€)</Label>
                  <Input 
                    type="number"
                    value={editData.valore_stimato || 0} 
                    onChange={e => setEditData({ ...editData, valore_stimato: Number(e.target.value) })}
                    className="bg-white/5 border-white/5 h-12 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Prossimo Followup</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569]" />
                    <Input 
                      type="date"
                      value={editData.data_prossimo_followup || ""} 
                      onChange={e => setEditData({ ...editData, data_prossimo_followup: e.target.value })}
                      className="bg-white/5 border-white/5 h-12 px-10 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Fonte</Label>
                  <Input 
                    value={editData.fonte || ""} 
                    onChange={e => setEditData({ ...editData, fonte: e.target.value })}
                    className="bg-white/5 border-white/5 h-12 rounded-xl"
                    placeholder="E.g. LinkedIn, Referral, Sito Web"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Assegnato a</Label>
                <div className="flex flex-wrap gap-2">
                  {users?.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setEditData({ ...editData, assegnato_a_id: u.id })}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                        editData.assegnato_a_id === u.id 
                          ? 'bg-primary/20 border-primary text-primary' 
                          : 'bg-white/5 border-white/5 text-[#64748b] hover:bg-white/10'
                      }`}
                    >
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px]">
                        {u.nome.charAt(0)}
                      </div>
                      {u.nome} {u.cognome}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 block">Note Lead</Label>
                <Textarea 
                  value={editData.note || ""} 
                  onChange={e => setEditData({ ...editData, note: e.target.value })}
                  className="bg-white/5 border-white/5 min-h-[120px] rounded-2xl resize-none"
                  placeholder="Dettagli sulle necessità del cliente, budget, tempistiche..."
                />
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
              <Button 
                variant="ghost" 
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 font-bold px-6 h-12 rounded-xl"
                onClick={() => {
                  if (confirm("Eliminare definitivamente questo lead?")) {
                    deleteLead.mutate(leadId);
                    onClose();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina Lead
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-primary/20"
              >
                Salva Modifiche
              </Button>
            </div>
          </div>

          {/* Right Side: Activity Timeline */}
          <div className="w-[380px] bg-white/5 flex flex-col">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Timeline Attività
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="space-y-6">
                {/* Add New Activity */}
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                  <div className="flex gap-2">
                    {['Nota', 'Chiamata', 'Email', 'Meeting'].map(t => (
                      <button
                        key={t}
                        onClick={() => setNewActivity({ ...newActivity, tipo: t })}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          newActivity.tipo === t 
                            ? 'bg-primary text-white' 
                            : 'bg-white/5 text-[#475569] hover:bg-white/10'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Textarea 
                    value={newActivity.descrizione}
                    onChange={e => setNewActivity({ ...newActivity, descrizione: e.target.value })}
                    placeholder="Cosa è successo?"
                    className="bg-transparent border-none p-0 focus-visible:ring-0 text-sm resize-none h-20 scrollbar-hide"
                  />
                  <div className="flex justify-end">
                    <Button 
                      size="sm" 
                      onClick={handleAddActivity}
                    >
                      <Plus className="h-3.5 w-3.5 mr-2" />
                      Aggiungi
                    </Button>
                  </div>
                </div>

                {/* Timeline Items */}
                <div className="space-y-6">
                  {lead.attivita?.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((act, i) => (
                    <div key={i} className="relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-[-24px] before:w-[1px] before:bg-white/10 last:before:hidden">
                      <div className="absolute left-[-4px] top-2 h-2 w-2 rounded-full bg-primary" />
                      <div className="text-[10px] font-black text-primary uppercase mb-1 flex items-center justify-between">
                        {act.tipo}
                        <span className="text-[#475569] font-medium lowercase">
                          {format(new Date(act.created_at), "d MMM, HH:mm", { locale: it })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {act.descrizione}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-[#64748b]">
                        <div className="h-4 w-4 rounded-full bg-white/5 flex items-center justify-center text-[6px]">
                          {act.autore_nome?.charAt(0)}
                        </div>
                        {act.autore_nome}
                      </div>
                    </div>
                  ))}
                  
                  {(!lead.attivita || lead.attivita.length === 0) && (
                    <div className="text-center py-12">
                      <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                        <Activity className="h-6 w-6 text-[#1e293b]" />
                      </div>
                      <p className="text-xs text-[#475569] font-black uppercase tracking-widest">Nessuna attività registrata</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
