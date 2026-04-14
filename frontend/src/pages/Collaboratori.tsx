import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  MoreVertical, 
  Euro, 
  TrendingUp,
  Activity,
  UserPlus,
  Plus,
  Briefcase,
  ExternalLink,
  Edit,
  Trash2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { CollaboratorForm } from '@/components/collaboratori/CollaboratorForm';
import { PageTransition } from '@/components/common/PageTransition';

// --- Types ---
interface RisorsaServizio {
  id: string;
  nome_servizio: string;
  costo_orario: number | null;
  costo_fisso: number | null;
  attivo: boolean;
}

interface Risorsa {
  id: string;
  user_id?: string;
  nome: string;
  cognome: string;
  ruolo?: string;
  tipo_contratto: string;
  ore_settimanali: number;
  attivo: boolean;
  email?: string;
  telefono?: string;
  piva?: string;
  codice_fiscale?: string;
  indirizzo?: string;
  iban?: string;
  banca?: string;
  bic_swift?: string;
  note?: string;
  servizi: RisorsaServizio[];
}

const CollaboratoriPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isCollaboratorFormOpen, setIsCollaboratorFormOpen] = useState(false);
  const [selectedRisorsa, setSelectedRisorsa] = useState<Risorsa | null>(null);
  
  // Queries
  const { data: risorse = [], isLoading } = useQuery<Risorsa[]>({
    queryKey: ['risorse-full'],
    queryFn: async () => {
      const res = await api.get('/risorse');
      return res.data;
    }
  });

  // Mutation to deactivate
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/risorse/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risorse-full'] });
      toast.success("Collaboratore disattivato");
    },
    onError: () => {
      toast.error("Errore durante la disattivazione");
    }
  });

  const filteredRisorse = risorse.filter(r => 
    `${r.nome} ${r.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.ruolo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-8 space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <header className="flex flex-col gap-1 px-1">
            <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic underline decoration-primary/30 decoration-8 underline-offset-[12px] mb-4 flex items-center gap-3">
              <Users className="h-10 w-10 text-primary" />
              Collaboratori
            </h1>
            <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-2">
              Gestione integrale del team, dei servizi specialistici e delle tariffe operative.
            </p>
          </header>
          
          <div className="flex items-center gap-3">
            <div className="relative group/search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within/search:text-primary transition-colors" />
              <Input 
                placeholder="Cerca collaboratore..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[200px] md:w-[300px] bg-card/50 border-border focus-visible:ring-primary/30 h-10 rounded-xl"
              />
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90 text-[10px] font-black uppercase italic tracking-widest text-primary-foreground shadow-xl shadow-[0_0_20px_hsl(var(--primary)/0.2)] h-10 px-6 rounded-xl transition-all active:scale-[0.98]"
              onClick={() => {
                setSelectedRisorsa(null);
                setIsCollaboratorFormOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Nuovo Collaboratore
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Totale Team', value: risorse.length, icon: Users, color: 'text-blue-400' },
            { label: 'Capacità Sett.', value: `${risorse.reduce((acc, r) => acc + Number(r.ore_settimanali), 0)}h`, icon: Activity, color: 'text-emerald-400' },
            { label: 'Costo Medio', value: '€42/h', icon: Euro, color: 'text-purple-400' },
            { label: 'Attivi Ora', value: risorse.filter(r => r.attivo).length, icon: TrendingUp, color: 'text-amber-400' },
          ].map((stat, i) => (
            <Card key={i} className="bg-card/40 border-border backdrop-blur-sm group hover:border-primary/20 transition-all duration-500 rounded-xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-white glow-primary">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-slate-800/50 ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Collaborators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRisorse.map((risorsa) => (
            <CollaboratorCard 
              key={risorsa.id} 
              risorsa={risorsa} 
              onEdit={(r) => {
                setSelectedRisorsa(r);
                setIsCollaboratorFormOpen(true);
              }}
              onAddService={(r) => {
                setSelectedRisorsa(r);
                setIsServiceModalOpen(true);
              }}
              onDeactivate={(id) => {
                if (confirm("Sei sicuro di voler disattivare questo collaboratore?")) {
                  deactivateMutation.mutate(id);
                }
              }}
            />
          ))}
        </div>

        {/* Forms */}
        <CollaboratorForm 
          open={isCollaboratorFormOpen}
          onOpenChange={setIsCollaboratorFormOpen}
          collaborator={selectedRisorsa}
        />

        {/* Add Service Dialog */}
        <ServiceDialog 
          open={isServiceModalOpen}
          onOpenChange={setIsServiceModalOpen}
          risorsa={selectedRisorsa}
        />
      </div>
    </PageTransition>
  );
};

// Separated component for clarity
const ServiceDialog = ({ open, onOpenChange, risorsa }: { open: boolean, onOpenChange: any, risorsa: any }) => {
  const queryClient = useQueryClient();
  const addServiceMutation = useMutation({
    mutationFn: async ({ risorsaId, data }: { risorsaId: string, data: any }) => {
      return api.post(`/risorse/${risorsaId}/servizi`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risorse-full'] });
      toast.success("Servizio aggiunto con successo");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Errore durante l'aggiunta del servizio");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">Aggiungi Servizio</DialogTitle>
            <DialogDescription className="text-slate-400">
              Imposta un servizio specifico e la relativa tariffa per {risorsa?.nome}.
            </DialogDescription>
          </DialogHeader>
          
          <form className="space-y-4 py-4" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = {
              nome_servizio: formData.get('nome_servizio'),
              costo_orario: formData.get('costo_orario') ? Number(formData.get('costo_orario')) : null,
              costo_fisso: formData.get('costo_fisso') ? Number(formData.get('costo_fisso')) : null,
              attivo: true
            };
            if (risorsa) {
              addServiceMutation.mutate({ risorsaId: risorsa.id, data });
            }
          }}>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Nome Servizio</label>
              <Input name="nome_servizio" placeholder="es. Web Design, Copywriting..." required className="bg-background border-border" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Costo Orario (€)</label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input name="costo_orario" type="number" step="0.01" className="pl-9 bg-background border-border" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Costo Fisso (€)</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input name="costo_fisso" type="number" step="0.01" className="pl-9 bg-background border-border" />
                </div>
              </div>
            </div>
            
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button type="submit" disabled={addServiceMutation.isPending} className="font-black uppercase tracking-widest">
                {addServiceMutation.isPending ? "Salvataggio..." : "Salva Servizio"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  );
};

// --- Sub-components ---

const CollaboratorCard: React.FC<{ 
  risorsa: Risorsa; 
  onEdit: (r: Risorsa) => void;
  onAddService: (r: Risorsa) => void;
  onDeactivate: (id: string) => void;
}> = ({ risorsa, onEdit, onAddService, onDeactivate }) => {
  return (
    <Card className={`group bg-card/50 border-border hover:border-primary/50 transition-all duration-500 backdrop-blur-xl shadow-lg hover:shadow-primary/5 overflow-hidden ${!risorsa.attivo ? 'opacity-50 grayscale' : ''}`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-14 w-14 border-2 border-primary/20 p-0.5">
                <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">
                  {risorsa.nome[0]}{risorsa.cognome[0]}
                </AvatarFallback>
              </Avatar>
              {risorsa.attivo && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 border-2 border-card rounded-full shadow-lg" />
              )}
            </div>
            <div>
              <CardTitle className="text-white font-black text-xl group-hover:text-primary transition-colors">
                {risorsa.nome} {risorsa.cognome}
              </CardTitle>
              <Badge className="bg-white/5 border-white/10 text-[#64748b] font-black uppercase text-[9px] h-5 mt-1">
                {risorsa.ruolo || 'Team Member'}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border text-white">
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(risorsa)}>
                <Edit className="h-3.5 w-3.5" /> Modifica
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-destructive cursor-pointer" onClick={() => onDeactivate(risorsa.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Disattiva
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Capacity Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#475569]">
            <span>Carico Settimanale</span>
            <span className="text-primary">{risorsa.ore_settimanali}h disp.</span>
          </div>
          <Progress value={45} className="h-1.5 bg-slate-800/50 [&>div]:bg-primary shadow-sm" />
        </div>

        {/* Services Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Servizi & Tariffe</h4>
            <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => onAddService(risorsa)}
               className="h-6 text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary hover:bg-primary/5"
            >
              <Plus className="h-3 w-3 mr-1" /> Aggiungi
            </Button>
          </div>
          
          <div className="space-y-2">
            {risorsa.servizi && risorsa.servizi.length > 0 ? (
              risorsa.servizi.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-800/50 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{service.nome_servizio}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {service.costo_orario ? `€${service.costo_orario}/h` : `€${service.costo_fisso} fisso`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="h-5 text-[8px] font-black border-emerald-500/20 text-emerald-500 bg-emerald-500/5 uppercase">
                    Attivo
                  </Badge>
                </div>
              ))
            ) : (
              <div className="py-8 text-center border-2 border-dashed border-slate-800/50 rounded-2xl opacity-20">
                <p className="text-[10px] font-black uppercase tracking-widest">Nessun servizio definito</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Button variant="outline" className="w-full h-11 bg-white/[0.02] border-border hover:bg-primary/5 hover:border-primary/30 transition-all font-black uppercase tracking-widest text-[10px] gap-2">
          Vedi Analisi Costi
          <ExternalLink className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default CollaboratoriPage;
