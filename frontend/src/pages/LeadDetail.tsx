import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  User as UserIcon, 
  Clock,
  Euro,
  FileText,
  ExternalLink,
  MessageSquare,
  Building2,
  CheckCircle2,
  ArrowRightLeft,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCRM } from "@/hooks/useCRM";
import { format } from "date-fns";
import { toast } from "sonner";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, stages, updateLead, addActivity, convertLeadToClient, deleteLead } = useCRM();
  
  const lead = leads.find(l => l.id === id);
  const [activeTab, setActiveTab] = useState("timeline");
  const [newActivity, setNewActivity] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  if (!lead) {
    return (
      <div className="p-8 text-center h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl text-white font-black uppercase italic tracking-tighter mb-4">Lead non trovato</h2>
        <Button onClick={() => navigate("/crm")} variant="link" className="text-primary font-black uppercase tracking-widest text-[10px]">
          Torna alla Pipeline
        </Button>
      </div>
    );
  }

  // HubSpot-style Lead Score Calculation (Mocked for UI)
  const leadScore = lead.lead_score ?? 78;

  const handleStartEdit = () => {
    setFormData({
      nome_azienda: lead.nome_azienda,
      nome_contatto: lead.nome_contatto || "",
      email: lead.email || "",
      telefono: lead.telefono || "",
      sito_web: lead.sito_web || "",
      valore_stimato: lead.valore_stimato,
      settore: lead.settore || "",
      dimensione_azienda: lead.dimensione_azienda || "",
      fonte: lead.fonte || ""
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateLead.mutateAsync({ id: lead.id, data: formData });
      setIsEditing(false);
      toast.success("Lead aggiornato con successo");
    } catch (e) {
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData(null);
  };

  const handleSendEmail = async () => {
    if (!emailSubject || !emailBody) {
      toast.error("Oggetto e corpo della mail sono obbligatori");
      return;
    }
    
    setIsSending(true);
    try {
      // Simulate backend delay
      await new Promise(r => setTimeout(r, 1500));
      
      await addActivity.mutateAsync({ 
        lead_id: lead.id, 
        data: { 
          note: `EMAIL INVIATA\nOggetto: ${emailSubject}\n\n${emailBody}`,
          tipo: "EMAIL"
        } 
      });
      
      toast.success("Email inviata e loggata con successo!");
      setEmailSubject("");
      setEmailBody("");
      setActiveTab("timeline");
    } catch (e) {
      toast.error("Errore durante l'invio");
    } finally {
      setIsSending(false);
    }
  };

  const handleAddActivity = async (tipo: string = "NOTA") => {
    if (!newActivity) return;
    try {
      await addActivity.mutateAsync({ 
        lead_id: lead.id, 
        data: { 
          note: newActivity,
          tipo: tipo
        } 
      });
      setNewActivity("");
    } catch (e) {
      toast.error("Errore salvataggio attività");
    }
  };

  const handleDelete = async () => {
    if (confirm(`Sei sicuro di voler eliminare il lead ${lead.nome_azienda}?`)) {
      try {
        await deleteLead.mutateAsync(lead.id);
        navigate("/crm");
      } catch (e) {
        toast.error("Errore durante l'eliminazione");
      }
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/crm")} 
            className="text-muted-foreground hover:text-white hover:bg-muted rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            CRM Pipeline
          </Button>
          <div className="h-4 w-px bg-muted" />
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl shadow-primary/10">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              {isEditing ? (
                <input 
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-2xl font-black text-white focus:ring-1 focus:ring-primary outline-none"
                  value={formData.nome_azienda}
                  onChange={(e) => setFormData({ ...formData, nome_azienda: e.target.value })}
                />
              ) : (
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">{lead.nome_azienda}</h1>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <Badge variant="outline" className="bg-white/5 border-white/5 text-[9px] font-black uppercase text-[#64748b]">
                  {lead.fonte || 'Lead Direct'}
                </Badge>
                <div className="flex items-center gap-1.5">
                   <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lead.stadio?.colore }} />
                   <span className="text-[10px] font-black uppercase text-[#475569] tracking-widest">{lead.stadio?.nome}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex flex-col items-center">
              <div className="relative h-14 w-14">
                <svg className="h-14 w-14 -rotate-90">
                  <circle cx="28" cy="28" r="24" className="fill-none stroke-white/5 stroke-[4]" />
                  <circle 
                    cx="28" cy="28" r="24" 
                    className="fill-none stroke-primary stroke-[4] transition-all duration-1000"
                    strokeDasharray={150.7}
                    strokeDashoffset={150.7 * (1 - leadScore / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
                  {leadScore}
                </div>
              </div>
              <span className="text-[8px] font-black uppercase text-primary tracking-widest mt-1">Lead Score</span>
           </div>

           <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <Button variant="ghost" onClick={handleCancelEdit} className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Annulla</Button>
                  <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px]">Salva Dati</Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="h-12 px-6 rounded-2xl bg-white/5 border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10"
                    onClick={handleStartEdit}
                  >
                    Modifica
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-12 px-6 rounded-2xl bg-white/5 border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10"
                    onClick={() => convertLeadToClient.mutate(lead.id)}
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2 text-emerald-400" />
                    Converti
                  </Button>
                  <Button 
                    onClick={() => navigate("/planning")}
                    className="h-12 px-8 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                  >
                    Pianifica Task
                  </Button>
                </>
              )}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
        {/* Left Sidebar Info */}
        <div className="space-y-6 overflow-y-auto pr-2 scrollbar-none">
           <Card className="bg-card/40 border-white/5 rounded-[32px] overflow-hidden backdrop-blur-xl">
              <CardHeader className="pb-2">
                 <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569]">Info Generale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                 <SidebarEditableItem 
                    label="Contatto" 
                    value={lead.nome_contatto || 'N/D'} 
                    isEditing={isEditing}
                    editValue={formData?.nome_contatto}
                    onChange={(v: string) => setFormData({ ...formData, nome_contatto: v })}
                    icon={<UserIcon className="w-3 h-3 text-primary" />} 
                 />
                 <SidebarEditableItem 
                    label="Email" 
                    value={lead.email || 'N/D'} 
                    isEditing={isEditing}
                    editValue={formData?.email}
                    onChange={(v: string) => setFormData({ ...formData, email: v })}
                    icon={<MessageSquare className="w-3 h-3 text-emerald-400" />} 
                 />
                 <SidebarEditableItem 
                    label="Sito Web" 
                    value={lead.sito_web || 'www...'} 
                    isEditing={isEditing}
                    editValue={formData?.sito_web}
                    onChange={(v: string) => setFormData({ ...formData, sito_web: v })}
                    icon={<ExternalLink className="w-3 h-3 text-blue-400" />} 
                    isLink 
                 />
                 <SidebarEditableItem 
                    label="Valore" 
                    value={`€${Number(lead.valore_stimato).toLocaleString()}`} 
                    isEditing={isEditing}
                    editValue={formData?.valore_stimato}
                    onChange={(v: string) => setFormData({ ...formData, valore_stimato: Number(v) })}
                    icon={<Euro className="w-3 h-3 text-amber-400" />} 
                    type="number"
                 />
              </CardContent>
           </Card>

           <Card className="bg-card/40 border-white/5 rounded-[32px] overflow-hidden backdrop-blur-xl">
              <CardHeader className="pb-2">
                 <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569]">Proprietà HubSpot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <EditableInfoItem 
                    label="Settore" 
                    value={lead.settore || 'Tech & Digital'} 
                    isEditing={isEditing}
                    editValue={formData?.settore}
                    onChange={(v: string) => setFormData({ ...formData, settore: v })}
                 />
                 <EditableInfoItem 
                    label="Team Size" 
                    value={lead.dimensione_azienda || '11-50'} 
                    isEditing={isEditing}
                    editValue={formData?.dimensione_azienda}
                    onChange={(v: string) => setFormData({ ...formData, dimensione_azienda: v })}
                 />
                 <EditableInfoItem 
                    label="Fonte" 
                    value={lead.fonte || 'Direct'} 
                    isEditing={isEditing}
                    editValue={formData?.fonte}
                    onChange={(v: string) => setFormData({ ...formData, fonte: v })}
                 />
              </CardContent>
           </Card>

           <Card className="bg-primary/5 border-primary/20 rounded-[32px] overflow-hidden backdrop-blur-xl border-dashed">
              <CardHeader className="pb-2">
                 <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Prossima Mossa Suggerita</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 animate-pulse">
                       <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                       <p className="text-[11px] font-black text-white leading-tight uppercase tracking-tight">
                          {leadScore > 70 ? 'Invia Proposta Economica' : leadScore > 40 ? 'Pianifica Discovery Call' : 'Continua il Nurturing'}
                       </p>
                       <p className="text-[9px] text-primary/60 font-medium mt-1 uppercase tracking-widest leading-none">
                          Basato su AI & Lead Score
                       </p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Center Main Section */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-card/40 border border-white/5 rounded-[32px] overflow-hidden backdrop-blur-xl flex-1 flex flex-col">
            <TabsList className="bg-white/5 p-2 h-16 border-b border-white/5 gap-2 flex justify-start shrink-0">
               <TabsTrigger value="timeline" className="data-[state=active]:bg-primary rounded-2xl px-6 font-black uppercase tracking-widest text-[9px] gap-2">
                  <Clock className="w-3 h-3" /> Timeline
               </TabsTrigger>
               <TabsTrigger value="email" className="data-[state=active]:bg-primary rounded-2xl px-6 font-black uppercase tracking-widest text-[9px] gap-2">
                  <MessageSquare className="w-3 h-3" /> Email
               </TabsTrigger>
               <TabsTrigger value="tasks" className="data-[state=active]:bg-primary rounded-2xl px-6 font-black uppercase tracking-widest text-[9px] gap-2">
                  <CheckCircle2 className="w-3 h-3" /> Tasks
               </TabsTrigger>
            </TabsList>
            
            <TabsContent value="timeline" className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">
               {/* Activity Input */}
               <div className="bg-white/5 p-4 rounded-3xl border border-white/5 focus-within:border-primary/40 transition-all">
                  <textarea 
                    className="w-full bg-transparent border-none p-2 text-sm text-white placeholder:text-slate-500 focus:ring-0 min-h-[80px] resize-none"
                    placeholder="Logga una nota o un aggiornamento..."
                    value={newActivity}
                    onChange={(e) => setNewActivity(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                     <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleAddActivity("NOTA")} className="text-[8px] font-black uppercase tracking-widest text-[#475569]">Logga Nota</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleAddActivity("CHIAMATA")} className="text-[8px] font-black uppercase tracking-widest text-[#475569]">Logga Chiamata</Button>
                     </div>
                     <Button onClick={() => handleAddActivity()} className="bg-primary px-6 h-9 rounded-xl font-black uppercase tracking-widest text-[9px]">
                        Pubblica
                     </Button>
                  </div>
               </div>

               <div className="space-y-8 relative before:absolute before:inset-y-0 before:left-4 before:w-[1px] before:bg-white/5">
                  <TimelineItem 
                    tipo="CREAZIONE" 
                    data={lead.created_at} 
                    titolo="Lead Creato" 
                    desc="Il lead è stato inserito nel sistema CRM." 
                  />
                  {lead.attivita?.map((act: any) => (
                    <TimelineItem 
                      key={act.id}
                      tipo={act.tipo}
                      data={act.data_attivita}
                      titolo={act.tipo}
                      desc={act.descrizione}
                    />
                  ))}
               </div>
            </TabsContent>

            <TabsContent value="email" className="flex-1 p-8 animate-in slide-in-from-right-4 duration-500">
               <div className="space-y-6 h-full flex flex-col">
                  <div className="bg-white/5 border border-white/5 p-6 rounded-[32px] space-y-4 flex-1 flex flex-col">
                     <div className="flex items-center gap-4 py-3 border-b border-white/5">
                        <span className="text-[10px] font-black uppercase text-[#475569] w-12">A:</span>
                        <span className="text-sm font-bold text-white">{lead.email || 'Nessuna mail selezionabile'}</span>
                     </div>
                     <div className="flex items-center gap-4 py-3 border-b border-white/5">
                        <span className="text-[10px] font-black uppercase text-[#475569] w-12">Oggetto:</span>
                        <input 
                          type="text" 
                          className="flex-1 bg-transparent border-none text-sm font-bold text-white focus:ring-0" 
                          placeholder="Inserisci l'oggetto della mail..."
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                        />
                     </div>
                     <textarea 
                        className="flex-1 w-full bg-transparent border-none p-4 text-sm text-slate-300 placeholder:text-slate-600 focus:ring-0 min-h-[200px] resize-none font-mono"
                        placeholder="Caro [Nome], ti scrivo per..."
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                     />
                     <div className="flex justify-between items-center pt-4">
                        <div className="flex gap-2">
                           <Button variant="ghost" size="icon" className="h-10 w-10 text-[#475569] hover:text-white"><FileText className="w-4 h-4" /></Button>
                        </div>
                        <Button 
                          onClick={handleSendEmail} 
                          disabled={isSending}
                          className="bg-primary px-10 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
                        >
                          {isSending ? "Invio..." : "Invia Email"}
                        </Button>
                     </div>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="tasks" className="p-8 text-center text-slate-500 italic text-sm">
               Nessun task pianificato per questo lead. 
               <br />
               <Button variant="link" onClick={() => navigate("/planning")} className="text-primary mt-2 uppercase font-black text-[10px]">Crea primo task</Button>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar Actions */}
        <div className="space-y-6">
           <Card className="bg-card/40 border-t-4 border-t-primary border-white/5 rounded-[32px] overflow-hidden shadow-2xl backdrop-blur-xl">
            <CardHeader className="pb-4">
               <CardTitle className="text-lg font-black italic uppercase tracking-tighter">Deal Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 gap-2">
                 {stages.map((s) => (
                   <button
                    key={s.id}
                    onClick={() => updateLead.mutate({ id: lead.id, data: { stadio_id: s.id } })}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      lead.stadio_id === s.id 
                        ? 'bg-primary/20 border-primary/40 text-white shadow-lg' 
                        : 'bg-white/5 border-white/5 text-[#475569] hover:bg-white/10'
                    }`}
                   >
                     <span className="text-[10px] font-black uppercase tracking-widest">{s.nome}</span>
                     {lead.stadio_id === s.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                   </button>
                 ))}
               </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 rounded-[32px] overflow-hidden backdrop-blur-xl">
              <CardContent className="p-6">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">
                      {lead.assegnato_a_nome?.charAt(0) || 'L'}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#475569]">Ownership</p>
                      <p className="text-sm font-bold text-white">{lead.assegnato_a_nome || 'Lorenzo Bite'}</p>
                    </div>
                 </div>
                 <Button 
                    variant="ghost" 
                    onClick={handleDelete}
                    className="w-full text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Elimina Lead
                 </Button>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function SidebarEditableItem({ label, value, icon, isLink = false, isEditing, editValue, onChange, type = "text" }: any) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase text-[#475569] tracking-widest leading-none mb-1">{label}</p>
        {isEditing ? (
          <input 
            type={type}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-primary"
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <p className={`text-xs font-bold text-white truncate ${isLink ? 'text-primary' : ''}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

function EditableInfoItem({ label, value, isEditing, editValue, onChange }: any) {
  return (
    <div className="flex justify-between items-center gap-4">
       <span className="text-[10px] font-black text-[#475569] uppercase tracking-tighter shrink-0">{label}</span>
       {isEditing ? (
          <input 
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-[10px] text-white text-right outline-none focus:ring-1 focus:ring-primary"
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
          />
       ) : (
          <span className="text-[11px] font-bold text-white uppercase italic truncate">{value}</span>
       )}
    </div>
  );
}

function TimelineItem({ tipo, data, titolo, desc }: { tipo: string, data?: string, titolo: string, desc?: string }) {
  const getIcon = () => {
    switch(tipo.toUpperCase()) {
      case 'EMAIL': return <MessageSquare className="w-3 h-3 text-emerald-400" />;
      case 'CHIAMATA': return <ExternalLink className="w-3 h-3 text-blue-400" />;
      case 'NOTA': return <FileText className="w-3 h-3 text-amber-400" />;
      default: return <Clock className="w-3 h-3 text-primary" />;
    }
  };

  return (
    <div className="relative pl-12">
       <div className="absolute left-1.5 top-0 h-5 w-5 rounded-full bg-card flex items-center justify-center border-2 border-white/5 shadow-xl">
          {getIcon()}
       </div>
       <div className="bg-white/5 border border-white/5 p-5 rounded-[24px] group hover:border-white/10 transition-all">
          <div className="flex items-center justify-between mb-2">
             <span className="text-[10px] font-black uppercase text-white group-hover:text-primary transition-colors">{titolo}</span>
             <span className="text-[9px] font-bold text-[#475569]">{data ? format(new Date(data), "d MMM, HH:mm") : 'Oggi'}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{desc}</p>
       </div>
    </div>
  );
}
