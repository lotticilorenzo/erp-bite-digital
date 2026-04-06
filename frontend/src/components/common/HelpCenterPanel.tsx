import { useState, useMemo } from "react";
import { Search, X, ChevronDown, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpSection {
  id: string;
  title: string;
  content: {
    subtitle?: string;
    items: string[];
  }[];
}

const HELP_DATA: HelpSection[] = [
  {
    id: "dashboard",
    title: "📊 Dashboard e Analytics",
    content: [
      {
        subtitle: "Dashboard",
        items: [
          "Cosa mostra: Un riepilogo a colpo d'occhio della salute aziendale.",
          "Leggere i KPI: Troverai dei blocchetti colorati con numeri chiave (es. fatturato mensile, lead aperti, ore lavorate).",
          "Scadenze: Una lista ti avviserà dei preventivi o commesse prossime alla scadenza, colorandosi di rosso quando urgenti."
        ]
      },
      {
        subtitle: "Analytics",
        items: [
          "Grafici: Troverai a torta o a barre i grafici che mostrano da dove arrivano i ricavi o dove va via più tempo.",
          "Drill-down: Cliccando su alcune zone del grafico, scendi nel dettaglio per capire chi nel team ha generato quelle determinate ore.",
          "Health Score: Identifica clienti positivi (Eccellenti) vs clienti che consumano troppe ore senza budget (Tossici)."
        ]
      }
    ]
  },
  {
    id: "clienti",
    title: "👥 Gestione Clienti",
    content: [
      {
        subtitle: "Gestione Base",
        items: [
          "Creare: Vai su 'Clienti' e clicca il grande pulsante '+ Nuovo Cliente'.",
          "Modificare: Entra nella scheda cliente e premi l'icona matita o 'Modifica'.",
          "Logo: Fai click sull'avatar/logo per caricarne uno nuovo.",
          "Storico: Trovi lo storico di tutti i suoi progetti, commesse e file condivisi nel suo profilo."
        ]
      },
      {
        subtitle: "CRM Pipeline",
        items: [
          "Lead: Gestisci le persone o aziende che ti hanno contattato ma non hanno ancora pagato.",
          "Stadi: Trascina il potenziale cliente col mouse dalla colonna 'Contatto' a 'Negoziazione'.",
          "Convertire: Quando chiudi un affare, trasformalo ufficialmente in Cliente dalla sua lavagna."
        ]
      }
    ]
  },
  {
    id: "progetti",
    title: "📁 Progetti e Commesse",
    content: [
      {
        subtitle: "Progetti",
        items: [
          "Creare: Entra nei progetti e usa il bottone aggiungi (+).",
          "Dettaglio: Clicca sulla riga del progetto per statistiche e file collegati.",
          "Gantt & Chat: Usa le tab in alto a destra per vedere la timeline dei lavori o per chattare in tempo reale con il team."
        ]
      },
      {
        subtitle: "Commesse",
        items: [
          "Cosa sono: Ordini d'acquisto ufficiali (mensili o una tantum) che contengono il monte ore pattuito.",
          "Creare: Da 'Commesse', clicca '+ Nuova'.",
          "Margini: Dentro ogni commessa il sistema calcola da solo le ore spese (dal Timesheet) e ti dice visivamente l'utile.",
          "PDF: Clicca sui tre puntini per scaricare il riassunto cartaceo in PDF."
        ]
      }
    ]
  },
  {
    id: "timer",
    title: "⏱️ Timer e Timesheet",
    content: [
      {
        subtitle: "Il Timer in Studio OS",
        items: [
          "Avviare: Sulla task c'è un grande pulsante 'Avvia' (triangolino Play).",
          "Pausa e Riprendi: Usa 'Pausa' per le interruzioni, poi nuovamente Play.",
          "Salvare le ore: Quando premi Stop, il timer invia magicamente le ore maturate direttamente alla tua fedina nel Timesheet."
        ]
      },
      {
        subtitle: "Timesheet Generale",
        items: [
          "Consiglio: Anche se si possono aggiungere a mano col tasto (+), usa sempre il Timer integrato se puoi.",
          "Collega: Specifica sempre per quale cliente/commessa hai lavorato.",
          "Approvazione: A fine mese l'admin valida le tue ore prima della fatturazione."
        ]
      }
    ]
  },
  {
    id: "studio-os",
    title: "🎯 Studio OS",
    content: [
      {
        subtitle: "Project Management Quotidiano",
        items: [
          "A cosa serve: Lo Studio OS è per l'operatività ('il sudore della fronte'), dove progetti la giornata.",
          "Task: Clicca su '+ Aggiungi Task' o sul bottone lilla '+ Nuovo'.",
          "Assegnare: Nella task clicca la faccina e scegli il collega. Imposta una data e dai una 'Stima' delle ore.",
          "Stato: Sposta da Nuovo -> In Corso -> Completato.",
          "Subtask: Aggiungi sotto-task spuntabili internamente.",
          "Commenti: Usa la finestra di chat a fondo task per le comunicazioni tra chi collaborerà allo stesso compito."
        ]
      },
      {
        subtitle: "Viste Disponibili",
        items: [
          "Lista: Tabella ordinata pulita.",
          "Board/Kanban: A colonne da trascinare (per chi è abituato a Trello).",
          "Calendario: Per visualizzare le scadenze mensili.",
          "Team: Per vedere i compiti raggruppati per persona e bilanciare il lavoro.",
          "Gantt: Per pianificare il lungo termine e mostrare le dipendenze."
        ]
      }
    ]
  },
  {
    id: "chat",
    title: "💬 Chat e Comunicazione",
    content: [
      {
        subtitle: "In tempo reale",
        items: [
          "Chat Progetto: Dentro ogni progetto, apri in alto 'Chat Progetto'.",
          "Menzioni: Scrivi '@' seguita dal nome del collega (es. @Paolo). Lui riceverà la notifica istantanea.",
          "Reazioni: Passa col mouse sui messaggi per reagire con un'emoji (👍, 🚀, ecc.).",
          "Notifiche: Clicca sulla campanella in topbar per smarcarle come lette."
        ]
      },
      {
        subtitle: "Wiki Aziendale",
        items: [
          "Documenti: Archiviazione di regole ferie, guide, documentazione.",
          "Creare: Inseriscile nella categoria giusta, come su Word.",
          "Cercare: Tutta l'ERP cerca dentro al testo dei documenti Wiki in tempo reale."
        ]
      }
    ]
  },
  {
    id: "preventivi",
    title: "📋 Preventivi e Budget",
    content: [
      {
        subtitle: "Preventivi e Fornitori",
        items: [
          "Creare Preventivi: Aggiungi servizi, quantità e costi. Il totale calcola in automatico.",
          "Convertire in Commessa: In un click trasforma il preventivo in commessa se viene accettato.",
          "Fornitori: Categorizza uscite per 'Servizi Web', 'Agenzie Terze' ecc."
        ]
      },
      {
        subtitle: "Budget",
        items: [
          "Impostare: Stabilisci le uscite/entrate previste.",
          "Budget vs Reale: Grafici che aiutano a capire la stabilità dei preventivi sulle uscite effettive.",
          "Alert: Badge arancio/rosso se superi le soglie previste."
        ]
      }
    ]
  },
  {
    id: "impostazioni",
    title: "🔧 Impostazioni",
    content: [
      {
        subtitle: "Account e Accessi",
        items: [
          "Modo D'Uso: Avatar in basso a sinistra -> Vai a 'Profilo' o 'Impostazioni'.",
          "Tema: Scegli la tua preferenza visiva (Light o Dark Mode).",
          "Admin (Titolare): Vede area finanziaria, ore, budget, crea commesse.",
          "Collaboratore: Vede in particolare Studio OS, le proprie task e le proprie ore (Timesheet personale) senza distrazioni o dati finanziari.",
          "Password: Da login puoi farti inviare una mail di reset se l'hai persa."
        ]
      }
    ]
  },
  {
    id: "faq",
    title: "❓ FAQ Frequenti",
    content: [
      {
        subtitle: "Risposte immediate",
        items: [
          "Dove vedo quanto ho lavorato?: Alla voce 'Timesheet' globale troverai tutte le tue timbrature.",
          "Come contattare su una task?: Menziona con '@' dentro i messaggi della task o nel progetto generale.",
          "Ci sono scadenze di oggi?: La Home dello Studio OS ti avvisa palesemente su tutto quello che hai in caduta per oggi o scaduto.",
          "Aggiungere un Cliente?: Se sei Admin o hai i permessi, da 'Gestione' -> 'Clienti'."
        ]
      }
    ]
  }
];

interface HelpCenterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpCenterPanel({ open, onOpenChange }: HelpCenterPanelProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter sections safely
  const filteredData = useMemo(() => {
    if (!search) return HELP_DATA;
    const lowerQ = search.toLowerCase();
    
    return HELP_DATA.map(section => {
      // Check if section title matches
      if (section.title.toLowerCase().includes(lowerQ)) return section;

      // Check if contents match
      const filteredContent = section.content.filter(block => {
        if (block.subtitle && block.subtitle.toLowerCase().includes(lowerQ)) return true;
        return block.items.some(item => item.toLowerCase().includes(lowerQ));
      });

      if (filteredContent.length > 0) {
        return { ...section, content: filteredContent };
      }
      return null;
    }).filter(Boolean) as HelpSection[];
  }, [search]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay invisibile per chiudere cliccando fuori */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-auto bg-background/20 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-screen w-[420px] bg-card border-l border-border shadow-[0_0_50px_rgba(0,0,0,0.5)] z-50 flex flex-col pointer-events-auto"
          >
            {/* Header */}
            <div className="p-6 shrink-0 border-b border-border bg-card/50 backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-xl border border-primary/20 flex flex-col items-center justify-center shadow-inner">
                    <span className="font-black text-[10px] text-primary">Bite</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-foreground">Centro Assistenza</h2>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-0.5">La tua guida completa</p>
                  </div>
                </div>
                <button 
                  onClick={() => onOpenChange(false)}
                  className="p-2 rounded-full hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca nella guida..."
                  className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/30 shadow-inner"
                />
              </div>
            </div>

            {/* List */}
            <ScrollArea className="flex-1 custom-scrollbar">
              <div className="p-4 space-y-2">
                {filteredData.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm font-bold text-muted-foreground">Nessun risultato trovato per "{search}"</p>
                  </div>
                ) : (
                  filteredData.map((section) => {
                    const isExpanded = expandedId === section.id;
                    const isOnlyResult = filteredData.length === 1 && search !== "";
                    const shouldExpand = isExpanded || isOnlyResult;

                    return (
                      <div 
                        key={section.id}
                        className="rounded-2xl border border-border/50 bg-background/30 overflow-hidden transition-colors hover:bg-muted/30"
                      >
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : section.id)}
                          className="w-full px-5 py-4 flex items-center justify-between text-left group"
                        >
                          <span className="font-black tracking-wide text-foreground group-hover:text-primary transition-colors">
                            {section.title}
                          </span>
                          <ChevronDown 
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${shouldExpand ? "rotate-180 text-primary" : ""}`} 
                          />
                        </button>
                        
                        <AnimatePresence initial={false}>
                          {shouldExpand && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 pt-1 space-y-6">
                                {section.content.map((block, idx) => (
                                  <div key={idx} className="space-y-3">
                                    {block.subtitle && (
                                      <h4 className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {block.subtitle}
                                      </h4>
                                    )}
                                    <ul className="space-y-2">
                                      {block.items.map((item, i) => (
                                        <li key={i} className="text-sm text-muted-foreground pl-5 relative before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-border">
                                          {/* Bold first part of string (e.g. 'Creare: ') */}
                                          {item.includes(': ') ? (
                                            <>
                                              <strong className="text-foreground">{item.split(': ')[0]}:</strong>
                                              {' '}{item.substring(item.indexOf(': ') + 2)}
                                            </>
                                          ) : item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t border-border shrink-0 bg-background/50 flex justify-center">
               <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Premi '?' per aprire/chiudere questa guida</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
