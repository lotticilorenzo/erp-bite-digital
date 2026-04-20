# BITE ERP — Implementation Master Plan
> Documento di riferimento per tutte le implementazioni future.  
> Obiettivo: massimizzare l'efficienza operativa del team di Bite Digital Studio e aumentare il ROI.  
> Aggiornato: Aprile 2026

---

## INDICE

1. [Stato Attuale del Sistema](#1-stato-attuale-del-sistema)
2. [Mappa Completa Funzionalità Esistenti](#2-mappa-completa-funzionalità-esistenti)
3. [Gap Analysis — Cosa Manca](#3-gap-analysis--cosa-manca)
4. [Implementazioni Prioritarie](#4-implementazioni-prioritarie)
   - [IMP-01 — Regole Riconciliazione Cassa](#imp-01--regole-riconciliazione-cassa)
   - [IMP-02 — Gestione Assenze + Integrazione Planning](#imp-02--gestione-assenze--integrazione-planning)
   - [IMP-03 — Imputazioni Costi a Progetti](#imp-03--imputazioni-costi-a-progetti)
   - [IMP-04 — Commenti sui Task](#imp-04--commenti-sui-task)
   - [IMP-05 — Pianificazione State Machine UI](#imp-05--pianificazione-state-machine-ui)
   - [IMP-06 — Budget vs Actual Comparison](#imp-06--budget-vs-actual-comparison)
   - [IMP-07 — Wiki in Sidebar + Navigazione](#imp-07--wiki-in-sidebar--navigazione)
   - [IMP-08 — Gantt collegato a Planning/Studio](#imp-08--gantt-collegato-a-planningstudio)
   - [IMP-09 — Audit Trail Dashboard](#imp-09--audit-trail-dashboard)
   - [IMP-10 — AI Generate Task](#imp-10--ai-generate-task)
5. [Feature Avanzate (Fase 2)](#5-feature-avanzate-fase-2)
6. [Architettura Dati e Connessioni](#6-architettura-dati-e-connessioni)
7. [Principi di Design](#7-principi-di-design)

---

## 1. STATO ATTUALE DEL SISTEMA

### Stack Tecnico
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Python 3.14 + FastAPI + SQLAlchemy Async
- **Database**: PostgreSQL 16
- **Auth**: JWT token + RBAC (6 ruoli)
- **Integrazioni**: Fatture in Cloud (FIC), ClickUp
- **Infrastructure**: Docker Compose + Nginx

### Ruoli e Permessi
| Ruolo | Accesso | Note |
|---|---|---|
| ADMIN | Tutto | Unico con accesso distruttivo |
| DEVELOPER | Quasi tutto | Come ADMIN tranne alcune config |
| PM | Gestione operativa | No costi fissi, no budget raw |
| COLLABORATORE | Solo Studio OS | Timesheet + Task propri |
| DIPENDENTE | Solo Studio OS | Come COLLABORATORE |
| FREELANCER | Solo Studio OS | Come COLLABORATORE |

### Entità Core del Database (44 tabelle)
```
users → progetti → commesse → timesheet
      → clienti  → commesse → fatture_attive
                 → preventivi
                 → pianificazioni
tasks → timer_sessions → timesheet
     → task_comments
contenuti → commesse
risorse → risorse_servizi
assenze → users
movimenti_cassa ← regole_riconciliazione
               → movimenti_cassa_imputazioni → clienti/progetti
fatture_passive → fatture_passive_imputazioni → clienti/progetti
budget_mensile → budget_categorie
wiki_articoli → wiki_categorie
studio_nodes → progetti/tasks/clienti (linked)
```

---

## 2. MAPPA COMPLETA FUNZIONALITÀ ESISTENTI

### 2.1 Pagine e Route (27 route React)

#### Area Gestione
| Route | Funzionalità Core |
|---|---|
| `/` Dashboard | 6 KPI card, tabella commesse mese, selettore mese/anno, nuovo commessa |
| `/analytics` | Trend chart, profitability table, client performance, quick calculator, export PDF |
| `/clienti` | CRUD clienti, upload logo, filtri, affidabilità |
| `/clienti/:id` | Storico commesse, statistiche, health score, progetti collegati |
| `/progetti` | CRUD progetti (RETAINER/ONE_OFF), servizi, team |
| `/progetti/:id` | Dettaglio, servizi, stats, link commesse |
| `/commesse` | Lista con filtri mese/stato, margini visuali |
| `/commesse/:id` | 6 tab (Progetti, Timesheet, Task Template, Contenuti, Pianificazione, ClickUp), stato machine, lock, ROI |
| `/preventivi` | CRUD, 4 stati, converti in commessa, export PDF |
| `/crm` | Kanban pipeline, vista lista, filtri hot/da sollecitare/top deal, stats |
| `/crm/:id` | Dettaglio lead, storico attività |

#### Area Execution
| Route | Funzionalità Core |
|---|---|
| `/timesheet` | Tabella + calendario, bulk actions, approvazione, export PDF |
| `/planning` | Drag-drop settimanale, backlog, auto-allocate, stima costi |
| `/contenuti` | Kanban 9 colonne, pipeline editoriale, filtri, KPI |
| `/task-templates` | CRUD template, items con scadenza/ruolo/stima, genera batch |
| `/collaboratori` | Lista collaboratori, form |

#### Area Finance
| Route | Funzionalità Core |
|---|---|
| `/fatture` | Tab attive/passive, sync FIC, incassa, dettagli |
| `/fornitori` | CRUD, categorie personalizzabili, FIC sync |
| `/cassa` | Movimenti bancari, stato riconciliazione, suggest AI |
| `/budget` | Budget mensile per categoria (minimal) |

#### Area Docs & Knowledge
| Route | Funzionalità Core |
|---|---|
| `/report` | Report per cliente/commessa, range date, PDF multipli |
| `/wiki` | Articoli per categoria, editor, search (non in sidebar) |

#### Studio OS
| Route | Funzionalità Core |
|---|---|
| `/studio-os` | Split-pane, Kanban/Lista/Calendario/Team view, Chat, Overview, Carico Lavoro |

#### Settings
| Route | Funzionalità Core |
|---|---|
| `/settings/profile` | Nome, avatar, bio, telefono, IBAN |
| `/settings/account` | Email, password |
| `/settings/notifications` | Preferenze notifiche per tipo |
| `/settings/appearance` | Dark/light, accent color |
| `/settings/privacy` | Export dati, GDPR |

### 2.2 Funzionalità Trasversali (sempre attive)

| Feature | Implementazione | Status |
|---|---|---|
| **Notifiche** | Dropdown topbar, 9 tipi, mark read/all | ✅ Funziona |
| **Timer** | Widget barra, start/stop/save, collega a task | ✅ Funziona |
| **Chat** | WebSocket, canali per progetto, emoji reaction | ⚠️ Parziale |
| **AI Panel** | Chat Claude API, useAI hook | ⚠️ Parziale |
| **Export PDF** | Commessa, cliente, timesheet, performance | ✅ Funziona |
| **Theme** | Dark/light, accent purple customizable | ✅ Funziona |
| **Help Center** | Pannello contestuale | ✅ Presente |
| **Quick Calculator** | Margini rapidi in Analytics | ✅ Presente |
| **Gantt** | Componente creato | ❌ Non linkato |
| **Wiki** | Funzionale | ❌ Non in sidebar |
| **Documents** | Explorer albero | ❌ Solo da Studio |

---

## 3. GAP ANALYSIS — COSA MANCA

### 3.1 Modelli DB Pronti ma Zero UI

| Entità | Impatto Business | Urgenza |
|---|---|---|
| **Assenze** (ferie/malattia/permessi) | Planning usa disponibilità ma non si può registrare assenza → dati falsi | 🔴 CRITICO |
| **Regole Riconciliazione Cassa** | Ore perse ogni mese a riconciliare manualmente movimenti bancari | 🔴 CRITICO |
| **Imputazioni Fatture Passive** | I costi dei fornitori non vengono allocati a progetti → margini sbagliati | 🔴 CRITICO |
| **Imputazioni Movimenti Cassa** | Flusso cassa non tracciato per progetto/cliente | 🔴 ALTO |
| **Commenti Task** | Zero comunicazione asincrona sui task | 🟡 MEDIO |
| **RisorsaServizio** | Tariffe per servizio non differenziate | 🟡 MEDIO |
| **Coefficienti Allocazione** | Costi indiretti non distribuiti sui progetti | 🟡 MEDIO |
| **AuditLog** | Nessuna tracciabilità modifiche | 🟡 MEDIO |
| **FicSyncRun** | Nessun monitoraggio sync FIC | 🟢 BASSO |

### 3.2 Flussi di Lavoro Spezzati

| Flusso | Dove si spezza | Impatto |
|---|---|---|
| Preventivo → Commessa | Conversione ok ma stato Pianificazione non aggiornato | 🔴 Confusione |
| Pianificazione → Commessa | Stato PENDING/ACCEPTED/CONVERTED senza UI | 🔴 Invisibile |
| Assenze → Planning | Planning disabilita celle ma non sa da dove vengono | 🔴 Phantom data |
| Budget → Actual | Budget inseribile ma zero comparison vs consuntivo | 🟡 KPI falsi |
| ClickUp sync | Solo lettura, no refresh manuale, no error state | 🟡 Opaco |
| Contenuti → Timeline | I contenuti non hanno visualizzazione calendario | 🟡 Planning editoriale assente |
| AI task generation | Endpoint pronto, mai chiamato dall'UI | 🟡 Feature ghost |

### 3.3 Componenti Esistenti Non Raggiungibili

| Componente | Problema | Fix necessario |
|---|---|---|
| Wiki | Non è in sidebar | Aggiungere voce menu |
| Gantt | Componente creato ma non linkato | Collegare a Planning |
| Documents | Solo da Studio | Accesso globale |
| Budget | Nascosta in sidebar | KPI più visibili |
| Audit | Zero UI | Nuova pagina Admin |

---

## 4. IMPLEMENTAZIONI PRIORITARIE

---

### IMP-01 — Regole Riconciliazione Cassa

**Priorità**: 🔴 CRITICO — Risparmio stimato 3-5h/mese  
**Dipendenze**: `/cassa` page esistente, tabelle `regole_riconciliazione` e `movimenti_cassa` pronte  
**Ruoli**: ADMIN, DEVELOPER

> **STATO**: ✅ COMPLETATO (Aprile 2026)

#### Senso Logico
Ogni mese arrivano N movimenti bancari che vanno abbinati a fatture o causali. Oggi è manuale. Il sistema ha già la tabella `regole_riconciliazione` con:
- `pattern`: stringa da cercare nella descrizione del movimento
- `tipo_match`: contains / starts_with / regex
- `categoria`: etichetta automatica
- `fornitore_id`: collega automaticamente al fornitore
- `fattura_passiva_id`: collega alla fattura
- `auto_riconcilia`: se true, applica senza conferma
- `priorita`: ordine di applicazione

La logica è: ogni volta che arriva un nuovo movimento, il backend scorre le regole in ordine di priorità e se il pattern matcha, riconcilia automaticamente.

#### Cosa Implementare

**A. Nuova pagina `/cassa/regole`** (o tab dentro `/cassa`)

```
Layout:
┌─────────────────────────────────────────┐
│ Regole Riconciliazione          [+ Nuova]│
├─────────────────────────────────────────┤
│ [Applica Tutte] [Test Dry-Run]          │
├─────────────────────────────────────────┤
│ #  Pattern      Match    Categoria  Auto │
│ 1  "Aruba"      contains HOSTING    ✅  │
│ 2  "META ADS"   contains ADVERTISING ✅ │
│ 3  "Stipendio"  contains SALARI     ✅  │
└─────────────────────────────────────────┘
```

**B. Dialog Crea/Modifica Regola**
```
Campo: Pattern (text input, es: "Aruba S.p.A.")
Campo: Tipo Match (contains / starts_with / ends_with / regex)
Campo: Categoria (select da lista categorie predefinite)
Campo: Fornitore (select opzionale → collega a fornitore)
Campo: Fattura Passiva (select opzionale → collega a fattura specifica)
Toggle: Auto Riconcilia (se OFF, suggerisce ma non applica)
Campo: Priorità (numero, ordine di applicazione)
```

**C. Integrazione in `/cassa`**
- Badge "Regole attive: N" accanto al titolo
- Bottone "Applica Regole" nella toolbar movimenti
- Badge rosso sui movimenti non riconciliati con count
- Colonna "Fonte riconciliazione" (Manuale / Auto-Regola #N / AI Suggest)
- Animazione quando una regola matcha e riconcilia

**D. Test Dry-Run**
- Bottone "Simula Applicazione" → mostra preview di quanti movimenti verrebbero riconciliati senza applicare
- Tabella: Movimento | Regola Matchata | Azione Prevista

**E. Log Applicazioni**
- Ogni applicazione di regola viene loggata: quale regola, quale movimento, quando, da chi

#### Endpoint Backend Necessari
```
# Già esistenti:
GET  /regole-riconciliazione
POST /regole-riconciliazione
PATCH /regole-riconciliazione/{id}
DELETE /regole-riconciliazione/{id}
POST /regole-riconciliazione/applica

# Da aggiungere:
POST /regole-riconciliazione/dry-run   → preview senza applicare
GET  /regole-riconciliazione/{id}/log  → storico applicazioni
```

#### Connessioni con il Resto del Sistema
- **Cassa** → bottone "Applica Regole" nella toolbar principale
- **Fornitori** → selezionare fornitore nella regola crea collegamento diretto
- **Fatture Passive** → selezionare fattura nella regola automatizza l'incasso
- **Notifiche** → quando auto-riconciliazione completa: "15 movimenti riconciliati automaticamente"
- **Dashboard** → KPI "Movimenti da riconciliare" si svuota visivamente

---

### IMP-02 — Gestione Assenze + Integrazione Planning
> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🔴 CRITICO — Accuracy del planning dipende da questo  
**Dipendenze**: tabella `assenze` pronta, Planning.tsx usa già disponibilità  
**Ruoli**: ADMIN/PM (gestione), TUTTI (richiesta/visualizzazione propria)

#### Senso Logico
Il planning droppable di task su risorse è inutile se non sa chi è assente. Attualmente il DB ha assenze ma nessuno le inserisce perché non c'è UI. Il planning "indovina" le celle da bloccare ma in realtà mostra sempre disponibili.

Il flusso corretto deve essere:
1. **Collaboratore** richiede ferie/permesso da `/settings` o da Studio OS
2. **PM/ADMIN** approva la richiesta
3. **Planning** vede automaticamente la cella come blocked con tooltip "Ferie approvate"
4. **Timesheet** genera automaticamente la riga per il giorno di assenza

#### Cosa Implementare

**A. Sezione "Le Mie Assenze" in Settings Profile o Studio OS**
```
┌──────────────────────────────────────────┐
│ Le Mie Assenze               [+ Richiedi]│
├──────────────────────────────────────────┤
│ Ferie approvate: 15/26 giorni usati      │
├──────────────────────────────────────────┤
│ 15 Apr - 19 Apr  FERIE    ✅ Approvato  │
│ 02 Mag            PERMESSO ⏳ In attesa  │
└──────────────────────────────────────────┘
```

**B. Dialog Richiesta Assenza**
```
Tipo: FERIE / MALATTIA / PERMESSO / ALTRO
Data inizio: date picker
Data fine: date picker (o single day toggle)
Ore: (calcolate automaticamente, modificabili per permessi orari)
Note: textarea
[Richiedi] → manda notifica al PM/ADMIN
```

**C. Dashboard Assenze per PM/ADMIN** (in `/collaboratori` o nuova tab in `/planning`)
```
┌──────────────────────────────────────────┐
│ Gestione Assenze Team        [Esporta]   │
├─────────────┬────────────────────────────┤
│  Calendario │  Lista richieste pendenti  │
│  (vista     │  ┌──────────────────────┐ │
│   mensile   │  │ Mario - FERIE 5gg ✅ │ │
│   con barre │  │ Sara - Permesso ⏳   │ │
│   colorate) │  │ [Approva] [Rifiuta]  │ │
└─────────────┴──────────────────────────-┘
```

**D. Integrazione Planning**
- Celle assenze mostrano icona 🏖️ / 🤒 / 📅 con tooltip
- Tooltip: "Mario — Ferie approvate"
- Task non droppabili su celle con assenza
- Warning se si tenta di assegnare: "Mario è assente questo giorno"
- KPI planning: "3 risorse indisponibili questa settimana"

**E. Integrazione Timesheet**
- Assenza approvata genera automaticamente un timesheet con tipo "ASSENZA" e ore calcolate
- Visibile come riga grigia nel calendario timesheet
- Non conta per le ore fatturabili ma conta per il totale ore giornaliero

**F. Contatori nel Profilo Utente**
```
Ferie: 15/26 giorni usati (progress bar)
Malattia: 2/3 giorni usati
Permessi: 4h/16h usate
```

#### Endpoint Backend
```
# Già esistenti:
GET  /assenze
POST /assenze
DELETE /assenze/{id}

# Da aggiungere:
PATCH /assenze/{id}/approva   → cambia stato a APPROVATA + crea timesheet
PATCH /assenze/{id}/rifiuta   → cambia stato a RIFIUTATA + notifica
GET   /assenze/me              → assenze dell'utente corrente
GET   /assenze/team            → assenze di tutto il team (PM/ADMIN)
GET   /assenze/availability?week=2026-W16  → disponibilità per settimana (usata da Planning)
```

#### Connessioni con il Resto del Sistema
- **Planning** → celle bloccate automaticamente per assenze approvate
- **Timesheet** → righe generate automaticamente per assenze approvate
- **Settings Profile** → sezione "Le mie assenze" con richiesta
- **Collaboratori** → tab "Assenze" con calendario team
- **Notifiche** → richiesta assenza → PM riceve notifica di approvazione; approvazione/rifiuto → collaboratore riceve notifica
- **Dashboard** → KPI "Risorse disponibili questa settimana: N/M"

---

### IMP-03 — Imputazioni Costi a Progetti
> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🔴 CRITICO — Senza questo, i margini sono stime approssimative  
**Dipendenze**: tabelle `fatture_passive_imputazioni` e `movimenti_cassa_imputazioni` pronte  
**Ruoli**: ADMIN, DEVELOPER, PM

#### Senso Logico
Quando arriva una fattura passiva (es: fattura agenzia social €1.000), quel costo appartiene a uno o più clienti/progetti. Senza imputazione, il costo non si riflette nel margine della commessa corrispondente. Stesso per i movimenti bancari (es: pagamento freelancer €500 per progetto X).

Oggi il modello DB supporta imputazioni percentuali multiple:
```
FatturaPassiva: €1.000
  → 60% → Cliente Acme → Progetto Social Media
  → 40% → Cliente Beta → Progetto SEO
```

Questo dato, una volta inserito, deve fluire automaticamente nei calcoli di margine delle commesse.

#### Cosa Implementare

**A. Drawer "Imputa Costi" su FatturaPassiva**

Dentro `/fatture` tab PASSIVE, aggiungere bottone "Imputa" su ogni riga:
```
┌─ Imputazione Costi ─────────────────────┐
│ Fattura: Agenzia Social #2024-042       │
│ Importo: €1.200,00                      │
├─────────────────────────────────────────┤
│ [+ Aggiungi imputazione]                │
│                                         │
│ 1. Cliente: [Acme ▼]  Progetto: [Social▼] │
│    Tipo: PROGETTO  Percentuale: [60%]   │
│    Importo calcolato: €720,00           │
│                                         │
│ 2. Cliente: [Beta ▼]  Progetto: [SEO ▼]  │
│    Tipo: PROGETTO  Percentuale: [40%]   │
│    Importo calcolato: €480,00           │
│                                         │
│ Totale imputato: €1.200 / €1.200 ✅    │
│ [Salva Imputazione]                     │
└─────────────────────────────────────────┘
```

**B. Imputazione su MovimentoCassa** (stesso pattern)
- Bottone "Imputa" su ogni movimento bancario
- Stesso drawer con selezione cliente/progetto/percentuale
- Differenza: tipo può essere SPESA_GENERICA, STIPENDIO, FORNITORE, ecc.

**C. Impatto su Margine Commessa**
- `costi_diretti` di una commessa si calcola: costi_diretti manuali + somma imputazioni fatture passive + somma imputazioni movimenti
- Tab "Costi Diretti" in CommessaDetail mostra breakdown:
  ```
  Costi Diretti Totali: €850
  ├── Manuale: €200
  ├── Da Fatture Passive: €450 (2 imputazioni)
  └── Da Movimenti Cassa: €200 (1 imputazione)
  ```

**D. Vista Imputazioni in CommessaDetail**
- Nuova sottosezione dentro il tab "Progetti" o tab dedicata "Costi"
- Lista tutte le imputazioni: tipo, importo, fonte (fattura/movimento), data

**E. Warning per Imputazioni Mancanti**
- In `/fatture` tab PASSIVE: badge arancione "N fatture non imputate"
- In Dashboard: KPI "Costi non imputati: €X.XXX" con link a fatture passive
- Notifica settimanale per ADMIN: "3 fatture passive degli ultimi 7 giorni non ancora imputate"

#### Endpoint Backend
```
# Già esistenti:
GET  /fatture-passive/{id}/imputazioni
POST /fatture-passive/{id}/imputazioni
GET  /movimenti-cassa/{id}/imputazioni
POST /movimenti-cassa/{id}/imputazioni

# Da aggiungere:
DELETE /fatture-passive/{id}/imputazioni/{imp_id}
PATCH  /fatture-passive/{id}/imputazioni/{imp_id}
DELETE /movimenti-cassa/{id}/imputazioni/{imp_id}
GET    /commesse/{id}/costi-dettaglio  → breakdown costi per commessa
```

#### Connessioni con il Resto del Sistema
- **Commessa Detail** → `costi_diretti` aggiornato dinamicamente con imputazioni
- **Analytics** → margini più accurati per tutti i report
- **Fatture** → badge "da imputare" su fatture passive
- **Dashboard** → KPI "Costi non imputati" come alert
- **Notifiche** → reminder settimanale per fatture passive senza imputazione

---

### IMP-04 — Commenti sui Task
> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🟡 MEDIO — Collaborazione asincrona fondamentale per il team  
**Dipendenze**: tabella `task_comments` pronta con autore, contenuto, timestamps  
**Ruoli**: TUTTI (con accesso al task)

#### Senso Logico
Il team usa i task per coordinarsi ma oggi non c'è modo di lasciare note, feedback o aggiornamenti direttamente sul task. La conseguenza è che le comunicazioni rimangono su WhatsApp/email e si perdono. I commenti sul task creano un log permanente e contestuale.

Deve integrarsi con:
1. **Studio OS** → quando si apre un task in TaskDetailView
2. **CommessaDetail tab Task Template** → dal task generato
3. **Timer** → ogni stop-timer può generare automaticamente un commento "Ho lavorato X minuti su questo"
4. **Notifiche** → menzione con @utente → notifica push

#### Cosa Implementare

**A. Sezione Commenti in TaskDetailView**
```
┌─ Commenti (3) ──────────────────────────┐
│ [Avatar] Lorenzo Lottici  · 2h fa       │
│ Prima bozza caricata su Drive. Ho       │
│ modificato il copy del CTA.             │
│ ─────────────────────────────────────── │
│ [Avatar] Sara  · 1h fa                  │
│ @Lorenzo ottimo! Manca però il banner   │
│ per stories. Puoi aggiungere?           │
│ ─────────────────────────────────────── │
│ [Avatar] Lorenzo  · 30m fa             │
│ Aggiunto. Task pronto per review.       │
│ ─────────────────────────────────────── │
│ ┌──────────────────────────────────┐   │
│ │ Scrivi un commento... @mention   │   │
│ └──────────────────────────────────┘   │
│                          [Invia →]     │
└─────────────────────────────────────────┘
```

**B. Mention System**
- Digitare `@` in textarea apre dropdown con utenti del team
- Selezione utente inserisce `@Nome` nel testo
- Al salvataggio → notifica push a utente menzionato con link al task

**C. Commento Automatico da Timer**
- Quando il timer si ferma e salva in timesheet, opzionalmente genera commento:
  "⏱ Lorenzo ha lavorato 45 min — [salva nota opzionale]"
- Toggle nelle impostazioni: "Aggiungi commento automatico quando fermo il timer"

**D. Commento da Cambio Stato Task**
- Quando un task cambia stato, viene registrato automaticamente un commento di sistema:
  "@Sistema: Stato cambiato da IN_REVIEW a PRONTO da Lorenzo il 15 Apr 14:30"

**E. Badge Commenti Non Letti**
- In StudioKanbanView: badge numero su card task se ci sono commenti non letti
- In Studio sidebar: indicatore su progetto con task commentati non letti

**F. Reazioni Emoji sui Commenti**
- Click su commento → +emoji picker → aggiunge reazione (👍 ✅ 👀 🔄)
- Reazioni visibili sotto ogni commento

#### Endpoint Backend
```
# Già esistenti:
GET    /tasks/{task_id}/comments
POST   /tasks/{task_id}/comments
DELETE /tasks/{task_id}/comments/{comment_id}

# Da aggiungere:
PATCH  /tasks/{task_id}/comments/{comment_id}   → edit
POST   /tasks/{task_id}/comments/{comment_id}/reactions
DELETE /tasks/{task_id}/comments/{comment_id}/reactions/{emoji}
GET    /notifications/unread-comments  → commenti con @me non letti
```

#### Connessioni con il Resto del Sistema
- **Studio OS TaskDetailView** → sezione commenti integrata
- **Timer** → commento automatico opzionale
- **Notifiche** → mention @utente → notifica con link diretto
- **Stato task** → cambio stato registra commento di sistema automaticamente
- **CommessaDetail** → task generati da template hanno commenti visibili

---

### IMP-05 — Pianificazione State Machine UI

> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🟡 MEDIO — Chiarisce il flusso preventivo→commessa  
**Dipendenze**: tabella `pianificazioni` con stati PENDING/ACCEPTED/CONVERTED, endpoint `/piani` pronto  
**Ruoli**: ADMIN, DEVELOPER, PM

#### Senso Logico
La pianificazione è il documento che nasce PRIMA della commessa: si stima quanto lavorerà chi, a quale costo. Oggi il flusso teorico è:

```
Preventivo (BOZZA)
    ↓ accettato dal cliente
Pianificazione (PENDING) → stima ore per risorsa
    ↓ approvata internamente
Pianificazione (ACCEPTED)
    ↓ convertita in commessa
Commessa (APERTA) ← collegata alla pianificazione
```

Ma l'UI manca di:
1. Come si crea una pianificazione partendo da un preventivo accettato?
2. Come si approva internamente?
3. Come si converte in commessa?

Questi sono i tre step da rendere visibili e cliccabili.

#### Cosa Implementare

**A. Collegamento Preventivo → Pianificazione**
- In PreventivoDetail o nella conversione "Converti a Commessa", step intermedio:
  ```
  Vuoi creare prima una pianificazione risorse?
  [Salta → Crea Commessa Diretta] [Crea Pianificazione Prima]
  ```

**B. Pagina Pianificazione Detail**
```
┌─ Pianificazione: Acme — Aprile 2026 ──────────────────┐
│ Stato: PENDING         Budget: €8.500    [Approva →]  │
├────────────────────────────────────────────────────────┤
│ LAVORAZIONI PREVISTE                                   │
│ ┌─────────────┬──────────┬────────────┬─────────────┐ │
│ │ Risorsa     │ Servizio │ Ore prev.  │ Costo prev. │ │
│ │ Lorenzo     │ Strategy │ 10h        │ €350        │ │
│ │ Sara        │ Design   │ 20h        │ €500        │ │
│ │ Marco       │ Copy     │ 15h        │ €300        │ │
│ └─────────────┴──────────┴────────────┴─────────────┘ │
│ [+ Aggiungi risorsa]                                   │
├────────────────────────────────────────────────────────┤
│ Totale costo previsto: €1.150                          │
│ Margine previsto: €7.350 (86%)                         │
├────────────────────────────────────────────────────────┤
│ CONSUNTIVO (se già in commessa)                        │
│ Ore reali: 48h   Costo reale: €1.400   Δ +€250 ⚠️    │
└────────────────────────────────────────────────────────┘
```

**C. Transizioni di Stato con Confirm Dialog**
- **PENDING → ACCEPTED**: "Stai approvando questa pianificazione. Le risorse stimate verranno considerate nel planning."
  - Effetto: le ore si bloccano nel planning come "riservate"
  - Notifica al PM: "Pianificazione Acme aprile approvata"

- **ACCEPTED → CONVERTED**: "Stai convertendo questa pianificazione in commessa. Verrà creata automaticamente la commessa per [cliente] - [mese]."
  - Effetto: crea commessa con `pianificazione_id` già collegato
  - Le lavorazioni diventano la base per `costi_manodopera` previsto

**D. Vista Confronto Pianificato vs Reale**
- Dopo la conversione in commessa, la pianificazione mostra due colonne:
  - Previsto (from lavorazioni)
  - Reale (from timesheet effettivi)
  - Delta con color coding: verde se sotto, rosso se sopra del 10%

**E. Lista Pianificazioni in `/preventivi` o sezione dedicata**
- Tab "Pianificazioni" nella sidebar sotto Commesse
- Badge di stato colorato: PENDING (gray), ACCEPTED (blue), CONVERTED (green)

#### Endpoint Backend
```
# Già esistenti:
GET  /piani
POST /piani
PATCH /piani/{id}
GET  /piani/{id}/consuntivo

# Da aggiungere:
PATCH /piani/{id}/approva     → PENDING → ACCEPTED
PATCH /piani/{id}/converti    → ACCEPTED → CONVERTED + crea commessa
GET   /piani/{id}/delta       → confronto pianificato vs reale
```

#### Connessioni con il Resto del Sistema
- **Preventivi** → bottone "Crea Pianificazione" su preventivo accettato
- **Planning** → ore ACCEPTED vengono mostrate come "riservate" nel backlog risorse
- **CommessaDetail** → tab "Pianificazione" mostra il delta previsto/reale
- **Notifiche** → transizioni di stato generano notifiche al PM responsabile
- **Analytics** → accuracy % delle stime di pianificazione come KPI di team

---

### IMP-06 — Budget vs Actual Comparison

> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🟡 MEDIO — Controllo spesa proattivo  
**Dipendenze**: tabelle `budget_mensile` e `budget_categorie` pronte, imputazioni IMP-03 necessarie prima  
**Ruoli**: ADMIN, DEVELOPER

#### Senso Logico
Il budget mensile esiste nel DB ma attualmente non viene confrontato con nulla. L'obiettivo è avere in un colpo d'occhio: "Ho pianificato €500 per Advertising, ho speso €620 → +24% → ATTENZIONE".

Le fonti del dato "speso" sono:
- Fatture passive imputate per categoria
- Movimenti cassa imputati per categoria
- Costi fissi del mese

#### Cosa Implementare

**A. Potenziamento pagina `/budget`**
```
┌─ Budget Aprile 2026 ─────────────────────────────────────┐
│ [← Mar 2026] Aprile 2026 [Mag 2026 →]  [Copia da mese] │
├──────────────────┬──────────┬────────┬──────────────────┤
│ Categoria        │ Budget   │ Speso  │ Δ Varianza       │
├──────────────────┼──────────┼────────┼──────────────────┤
│ 🔵 Advertising   │ €500     │ €620   │ +€120 ⚠️ +24%  │
│ 🟣 Freelancer    │ €2.000   │ €1.800 │ -€200 ✅ -10%   │
│ 🟢 Software      │ €300     │ €287   │ -€13  ✅ -4%    │
│ 🟡 Formazione    │ €200     │ €0     │ -€200 💤 -100%  │
│ 🔴 Altro         │ €100     │ €145   │ +€45  ⚠️ +45%  │
├──────────────────┼──────────┼────────┼──────────────────┤
│ TOTALE           │ €3.100   │ €2.852 │ -€248 ✅ -8%    │
└──────────────────┴──────────┴────────┴──────────────────┘
```

**B. Barra Progress per Ogni Categoria**
```
Advertising [████████████░░░░] €620/€500 (124%)  ⚠️
Freelancer  [██████████████░░] €1.800/€2.000 (90%) ✅
```

**C. Alert Proattivi**
- Badge rosso su categoria se > 100% del budget
- Badge giallo se > 80% del budget a metà mese (progiezione lineare)
- Notifica mensile per ADMIN se qualsiasi categoria > 110%

**D. Trend Chart (ultimi 6 mesi)**
- Line chart con due serie: Budget pianificato vs Speso effettivo
- Per ogni categoria selezionabile

**E. "Copia Mese Precedente"**
- Bottone che copia i budget del mese precedente → punto di partenza per il mese corrente

#### Endpoint Backend
```
# Già esistenti:
GET  /budget
POST /budget
POST /budget/copia
GET  /budget/consuntivo

# Da aggiungere:
GET  /budget/variance?mese=2026-04  → budget vs actual per mese
GET  /budget/trend?mesi=6           → trend ultimi N mesi
```

#### Connessioni con il Resto del Sistema
- **IMP-03 Imputazioni** → fonte dati "speso" per categoria (richiede IMP-03 prima)
- **Costi Fissi** → contribuiscono automaticamente al "speso" nella categoria appropriata
- **Dashboard** → nuovo KPI "Budget mese: 82% utilizzato" con color coding
- **Notifiche** → alert quando categoria supera soglia
- **Analytics** → sezione budget nel report PDF mensile

---

### IMP-07 — Wiki in Sidebar + Navigazione Completa
> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🟢 BASSO/MEDIO — Quick win, la wiki funziona già  
**Dipendenze**: Wiki già funzionale, solo routing e sidebar  
**Ruoli**: TUTTI

#### Senso Logico
La wiki interna è già completa con articoli, categorie, editor, search. Non è semplicemente raggiungibile dalla sidebar. Questo è un quick-win: 30 minuti di lavoro che sblocca una knowledge base intera.

Allo stesso tempo, la wiki ha senso come hub di documentazione processi, SOP, guide clienti, onboarding collaboratori.

#### Cosa Implementare

**A. Aggiungere "Wiki" alla Sidebar**
```javascript
// In AppSidebar.tsx, sezione "Documenti":
{ label: "Wiki", icon: BookOpen, href: "/wiki" }
```

**B. Homepage Wiki Strutturata**
```
┌─ Wiki Bite Digital ──────────────────────────────────────┐
│ [🔍 Cerca nella wiki...]                                  │
├──────────────────────────────────────────────────────────┤
│ 📂 Processi Interni    📂 Guide Clienti    📂 Onboarding │
│ (5 articoli)           (3 articoli)        (7 articoli)   │
├──────────────────────────────────────────────────────────┤
│ ⏰ AGGIORNATI DI RECENTE                                  │
│ • Come fare un timesheet correttamente — 2 giorni fa     │
│ • SOP Contenuti Social Media — 1 settimana fa            │
│ • Checklist onboarding nuovo cliente — 3 settimane fa    │
└──────────────────────────────────────────────────────────┘
```

**C. Collegamento Contestuale dalla Wiki ad altre Pagine**
- Articolo wiki su "Come creare una commessa" → link a `/commesse/new`
- Articolo su "SOP Contenuti" → link a `/contenuti`
- Badge "Wiki collegata" in CommessaDetail che apre articolo specifico

**D. Collegamento da Altre Pagine alla Wiki**
- Help Center panel in header mostra articoli wiki rilevanti per pagina attiva
- Es: utente è in `/timesheet` → "📖 Come compilare il timesheet"

**E. Quick Create da Shortcut**
- Tasto `/` (slash) in qualsiasi pagina → search box wiki veloce
- Mostra risultati istantanei mentre si digita

#### Connessioni
- **Help Center** → suggerisce articoli wiki contestuali
- **Tutte le pagine** → link "?" → apre articolo wiki pertinente
- **Notifiche** → "Nuovo articolo wiki: [titolo]" quando un ADMIN pubblica

---

### IMP-08 — Gantt collegato a Planning/Studio

**Priorità**: 🟡 MEDIO — Alta visibilità delle timeline di progetto  
**Dipendenze**: componente GanttChart.tsx già creato, tasks con date pronte  
**Ruoli**: ADMIN, DEVELOPER, PM

#### Senso Logico
Il Gantt esiste come componente React ma non è linkato a nessuna pagina. È lo strumento visivo più richiesto dai PM per vedere le timeline di progetto in modo aggregato. Deve mostrare:
> **STATO**: ✅ COMPLETATO (Aprile 2026)

1. Task con date inizio/fine per risorsa
2. Dipendenze tra task (se task B non può iniziare prima che task A finisca)
3. Milestone (data scadenza commessa, data consegna contenuto)
4. Visualizzazione delle assenze sovrapposte

#### Cosa Implementare

**A. Aggiungere Gantt come tab in Planning**
```
Planning: [Settimanale] [Mensile] [Gantt] [Carico]
```

**B. Gantt View**
```
Progetto / Task           | Apr 14 | Apr 21 | Apr 28 | Mag 5
──────────────────────────┼────────┼────────┼────────┼──────
► ACME — Social Retainer  │        │        │        │
  ├ Strategia contenuti   │▓▓▓▓▓▓▓│        │        │
  ├ Creazione post        │   ░░░░░│▓▓▓▓▓▓▓│        │
  ├ Review cliente        │        │    ░░░░│▓▓▓     │
  └ Pubblicazione         │        │        │    ▓▓▓▓│ ← Milestone
► BETA — Google Ads       │        │        │        │
  └ Ottimizzazione        │▓▓▓▓▓▓▓│▓▓▓▓▓▓▓│        │
─────────────── FERIE Sara │        │   ████│████████│
```

**C. Filtri Gantt**
- Per cliente
- Per risorsa
- Per progetto tipo (RETAINER / ONE_OFF)
- Range date personalizzato

**D. Interazioni**
- Click su task → apre TaskDetailView con commenti
- Drag orizzontale del task → cambia data inizio/fine
- Hover → tooltip con dettagli: ore stimate, assegnatario, stato

**E. Export Gantt come PDF/PNG**
- Bottone "Esporta" → screenshot del Gantt per condivisione cliente

#### Connessioni
- **Planning** → tab aggiuntivo nella stessa pagina
- **Studio OS** → view aggiuntiva nel progetto (accanto a Kanban/Lista/Cal)
- **CommessaDetail** → mini-gantt nella tab Pianificazione
- **Assenze** → bande colorate per assenze sovrapposte alle task

---

### IMP-09 — Audit Trail Dashboard
> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🟡 MEDIO — Accountability e debugging  
**Dipendenze**: tabella `audit_log` pronta (azione, tabella, record_id, dati_prima, dati_dopo, user_id)  
**Ruoli**: ADMIN, DEVELOPER

#### Senso Logico
Ogni modifica a entità critiche (commesse, fatture, timesheet, utenti) viene già loggata nel DB. Nessuno lo può leggere. L'audit trail serve per:
- "Chi ha modificato questa commessa?"
- "Quando è stato approvato questo timesheet?"
- "Chi ha eliminato quel cliente?"
- Debugging quando qualcosa non torna

#### Cosa Implementare

**A. Sezione Audit in Settings o nuova pagina Admin**
```
┌─ Audit Trail ────────────────────────────────────────────┐
│ [Filtro utente ▼] [Filtro tabella ▼] [Range date]       │
├──────────────┬──────────┬────────────┬───────────────────┤
│ Quando       │ Chi      │ Cosa       │ Dettaglio         │
├──────────────┼──────────┼────────────┼───────────────────┤
│ 14:32 oggi   │ Lorenzo  │ MODIFICA   │ Commessa #042     │
│              │          │ commessa   │ stato: APERTA→    │
│              │          │            │ CHIUSA            │
├──────────────┼──────────┼────────────┼───────────────────┤
│ 11:15 oggi   │ Sara     │ APPROVA    │ Timesheet 3h      │
│              │          │ timesheet  │ Marco — 15 Apr    │
└──────────────┴──────────┴────────────┴───────────────────┘
```

**B. Diff Viewer per Modifiche**
- Click su riga audit → mostra "prima" e "dopo" in formato diff:
  ```
  - stato: "APERTA"
  + stato: "CHIUSA"
  - data_chiusura: null
  + data_chiusura: "2026-04-14"
  ```

**C. Audit inline nelle Entità**
- In CommessaDetail, ClienteDetail, ecc. → tab "Storico" che mostra audit del record specifico
- Formato timeline verticale

**D. Alert su Azioni Critiche**
- Eliminazione cliente → notifica a tutti gli ADMIN
- Modifica costo orario utente → notifica a ADMIN
- Modifica fattura incassata → notifica a ADMIN + log immediato

#### Endpoint Backend
```
# Da aggiungere:
GET /audit-log?tabella=commesse&record_id=xxx&user_id=yyy&from=date&to=date
GET /audit-log/entity/{tabella}/{record_id}  → audit di una specifica entità
```

#### Connessioni
- **Tutte le entità** → tab "Storico" con audit inline
- **Notifiche** → azioni critiche generano alert
- **Settings Admin** → pagina audit globale

---

### IMP-10 — AI Generate Task

> **STATO**: ✅ COMPLETATO (Aprile 2026)

**Priorità**: 🟡 MEDIO — Risparmio tempo significativo per PM  
**Dipendenze**: endpoint `/ai/generate-task` pronto, Claude API configurata  
**Ruoli**: ADMIN, DEVELOPER, PM

#### Senso Logico
Aprire una commessa e dover creare manualmente 15 task standard ogni mese è meccanico. Il sistema ha già i task template ma sono statici. L'AI può:
1. Analizzare il tipo di progetto + cliente + mese → suggerire task specifici
2. Stimare le ore per ogni task basandosi sullo storico timesheet
3. Assegnare automaticamente in base al carico delle risorse

Il template system (IMP statico) e l'AI generation (IMP dinamico) diventano complementari.

#### Cosa Implementare

**A. Pulsante "Genera con AI" in CommessaDetail**
```
Tab Task Template:
┌──────────────────────────────────────────────┐
│ [📋 Da Template] [🤖 Genera con AI]          │
└──────────────────────────────────────────────┘
```

**B. Dialog AI Generate**
```
┌─ Genera Task con AI ─────────────────────────┐
│ Contesto rilevato automaticamente:           │
│ • Cliente: Acme — Social Media Retainer      │
│ • Mese: Aprile 2026                          │
│ • Storico: 18 mesi di commesse precedenti    │
│ • Budget stimato: 40 ore                     │
├──────────────────────────────────────────────┤
│ Istruzioni aggiuntive (opzionale):           │
│ "Focus su Instagram Reels questo mese,       │
│  lanciamo nuova campagna estiva"             │
├──────────────────────────────────────────────┤
│ [Genera Suggerimenti →]                      │
└──────────────────────────────────────────────┘
```

**C. Review Suggerimenti AI**
```
┌─ Task Suggeriti dall'AI (12 task) ──────────┐
│ ☑ Strategia contenuti Aprile       3h  Sara │
│ ☑ Creazione 8 post feed            8h  Sara │
│ ☑ Creazione 4 Reels               12h  Marco│
│ ☑ Copywriting caption              4h  Marco│
│ ☑ Pianificazione editoriale        2h  Sara │
│ ☑ Report mensile                   1h  Loren│
│ ○ A/B test post (nuovo)            2h  ?    │
│ ○ Stories daily (15 pezzi)        10h  ?    │
├──────────────────────────────────────────────┤
│ Stima totale selezionati: 30h / 40h budget  │
│ [Deseleziona tutto] [Seleziona tutto]       │
│ [Crea Task Selezionati →]                   │
└──────────────────────────────────────────────┘
```

**D. Apprendimento Contestuale**
- Quando un PM aggiusta manualmente un task AI-generato, il sistema impara:
  "Per Acme il task 'Reel' dura sempre di più rispetto alla stima iniziale"
- Questo affina le stime nei mesi successivi

**E. AI Suggest Assegnatario**
- Basandosi su: chi ha fatto questo tipo di task in passato + carico attuale + skill
- "Suggerito: Sara (ha fatto 23 Reels in passato, carico attuale 62%)"

#### Endpoint Backend
```
# Da attivare/completare:
POST /ai/generate-tasks
  body: { commessa_id, prompt_extra, max_ore }
  response: [{ titolo, servizio, assegnatario_id, stima_minuti, priorita, ... }]

POST /ai/estimate-hours
  body: { task_titolo, cliente_id, storico_mesi }
  response: { stima_minuti, confidenza_pct, ragionamento }
```

#### Connessioni
- **CommessaDetail** → bottone "Genera con AI" nel tab Task Template
- **Task Templates** → AI può creare template dinamici da zero
- **Planning** → task AI-generati entrano nel backlog del planning
- **Analytics** → traccia accuracy delle stime AI per miglioramento continuo
- **Notifiche** → "AI ha generato 12 task per Acme — Aprile. Revisiona."

---

## 5. FEATURE AVANZATE (FASE 2)

### F2-01 — Content Calendar View

**Senso**: I contenuti hanno scadenze ma non c'è vista calendario. Un PM deve vedere tutti i contenuti del mese su una timeline per capire la densità del lavoro editoriale.

**Implementazione**:
- Nuova tab "Calendario" in `/contenuti` (accanto a Kanban)
- Vista mensile con i contenuti posizionati nelle celle giornaliere
- Color coding per cliente (ogni cliente ha un colore)
- Drag-and-drop per cambiare data scadenza
- Vista settimanale con dettaglio orario
- Esporta come PDF "Calendario Editoriale" da mandare al cliente

**Connessioni**: `/contenuti` + **Assenze** (evita deadlines su giorni di ferie) + **PDF export**

---

### F2-02 — Client Portal (Vista Cliente)

**Senso**: Il cliente oggi non ha accesso al sistema. Deve mandare email per sapere lo stato dei contenuti. Un portal riduce il back-and-forth.

**Implementazione**:
- Nuovo ruolo `CLIENT` con accesso limitatissimo
- Accede solo alla propria area: commessa attiva, contenuti INVIATI_AL_CLIENTE, preventivi
- Può approvare/richiedere modifiche direttamente dall'interfaccia
- Notifica al PM/COLLABORATORE quando il cliente interagisce
- URL dedicato: `/client/:token` con autenticazione magic link (no password)

**Connessioni**: **Contenuti** (approva/rifiuta) + **Preventivi** (firma digitale) + **Notifiche** (alert team)

---

### F2-03 — Recurring Tasks Automatici (già in DB, da completare)

**Senso**: Task template esistono ma la generazione è manuale. Ogni mese il PM deve ricordarsi di cliccare "Genera". Deve essere automatica.

**Implementazione**:
- Ogni 1° del mese (o `start_day_type` del cliente): cron job genera task da template per tutte le commesse RETAINER attive
- Notifica al PM: "Ho generato 47 task per 6 commesse RETAINER. Rivedi e assegna."
- Regola: se template ha `attivo = true` e tipo = RETAINER → genera automaticamente
- Fallback: se il progetto non ha template → notifica PM "Nessun template per [progetto], aggiungine uno"

**Connessioni**: **Task Templates** + **Planning** (nuovi task entrano nel backlog) + **Notifiche**

---

### F2-04 — Health Score Cliente Espanso

**Senso**: `ClienteDetail` mostra già un health score ma è calcolato in modo base. Va espanso con più fattori e reso più visivo.

**Fattori da includere**:
- Margine medio ultimi 3 mesi (peso 30%)
- Puntualità pagamenti (peso 25%)
- Scope creep medio (ore reali / ore contratto) (peso 20%)
- Longevità rapporto (mesi attivi) (peso 15%)
- Numero contenuti approvati senza modifiche (peso 10%)

**Output**: Punteggio 0-100 con:
- 80-100: 🟢 Cliente Eccellente
- 60-79: 🟡 Cliente Buono
- 40-59: 🟠 Da Monitorare
- 0-39: 🔴 Cliente Critico → Alert PM

**Connessioni**: **Dashboard** (colore affidabilità in tabella commesse) + **CRM** (score sui lead convertiti) + **Notifiche** (alert se cliente scende sotto soglia)

---

### F2-05 — Onboarding Automatico Nuovo Cliente

**Senso**: Quando un nuovo cliente viene creato o un lead viene convertito, c'è una serie di azioni standard da fare sempre. Automatizzarle risparmia 30 minuti.

**Checklist automatica al "Crea Cliente"**:
- Crea cartella su Google Drive (integrazione opzionale)
- Crea canale Chat interno per il cliente
- Genera preventivo BOZZA da template
- Assegna PM di default
- Crea primo task "Kickoff meeting" assegnato al PM
- Invia notifica a tutti gli stakeholder

**Connessioni**: **CRM** (converti lead) + **Clienti** (nuova creazione) + **Chat** + **Preventivi** + **Tasks**

---

### F2-06 — Forecast Ricavi Intelligente (già parzialmente in Analytics)

**Senso**: La dashboard mostra forecast ma è basata solo sui RETAINER. Deve includere ONE_OFF probabilistici.

**Implementazione**:
- RETAINER: forecast = somma commesse RETAINER attive × mesi rimanenti contratto
- ONE_OFF: forecast = valore preventivi IN_ATTESA × probability score (da CRM)
- Pipeline CRM: valore lead × stage_conversion_rate × close_probability
- Aggregato mensile: barre impilate con 3 fasce (confirmed/probable/possible)

**Connessioni**: **CRM** + **Preventivi** + **Commesse** + **Analytics**

---

### F2-07 — Webhook Outbound per n8n

**Senso**: CLAUDE.md prevede l'integrazione con n8n. Ogni evento importante nel sistema deve poter triggerare automazioni esterne.

**Eventi da emettere**:
- `commessa.stato_cambiato`
- `preventivo.accettato`
- `lead.convertito`
- `contenuto.approvato_cliente`
- `fattura.incassata`
- `timesheet.approvato`

**Implementazione**:
- Tabella `webhook_endpoints` (url, eventi, secret, attivo)
- Pagina Admin per gestire webhook
- Payload standard JSON con entità + evento + timestamp + user
- Retry automatico con exponential backoff

**Connessioni**: Tutti gli eventi del sistema → trigger n8n → Slack, Notion, Google Sheets, ecc.

---

## 6. ARCHITETTURA DATI E CONNESSIONI

### Come le Entità si Connettono (grafo semplificato)

```
CRM Lead ─────────────────────────────────────────────┐
    ↓ converti                                         │
Cliente ──────────────────────────────────────────┐   │
    │                                              │   │
    ├── Preventivo ─── converti ──→ Commessa ──────┤   │
    │       ↓ crea pianificazione                  │   │
    │   Pianificazione ─ approva ─→ Commessa       │   │
    │                                ↓             │   │
    ├── Progetto ─────────────────→ CommessaProgetto   │
    │       ↓                        ↓             │   │
    │   Task Template ──── genera ──→ Task ─────────┤   │
    │       ↑                        ↓             │   │
    │   (AI Generator)          TimerSession       │   │
    │                                ↓             │   │
    ├── Timesheet ←──────────────────────────────── ┤   │
    │       ↓ calcola                ↓             │   │
    │   costo_manodopera        TaskComment        │   │
    │                                              │   │
    ├── FatturaAttiva ────────────→ incasso ────────┤   │
    │                              MovimentoCassa  │   │
    ├── FatturaPassiva ──→ imputazione ──→ Commessa │   │
    │                                              │   │
    └── Contenuto ───────────────────────────────── ┘   │
                                                        │
Assenza ──────────────────────────────→ Planning        │
BudgetMensile ←──── imputazioni costi ──────────────────┘
```

### Flusso Margine di una Commessa (come si calcola)

```
valore_fatturabile = Σ(righe_progetto.importo) + aggiustamenti
costo_manodopera   = Σ(timesheet.costo_lavoro) per commessa_id
costi_diretti      = manuale
                   + Σ(fatture_passive_imputazioni.importo) per commessa
                   + Σ(movimenti_cassa_imputazioni.importo) per commessa
                   [dopo IMP-03]
margine_euro       = valore_fatturabile - costo_manodopera - costi_diretti
margine_pct        = margine_euro / valore_fatturabile * 100
```

---

## 7. PRINCIPI DI DESIGN

### UX
- **Zero-friction per le azioni frequenti**: inserire timesheet, cambiare stato contenuto, creare task → deve essere < 3 click
- **Progressive disclosure**: dettagli avanzati nascosti di default, visibili al click
- **Feedback immediato**: ogni azione ha loading state + toast di conferma/errore
- **Keyboard shortcuts**: `/` per search, `n` per nuovo elemento, `esc` per chiudere modal

### Visual
- Dark mode default, background `#020617`
- Accent: Purple/Violet `#7c3aed`
- Typography: Plus Jakarta Sans + DM Mono per dati
- Badge colorati per stati (sempre consistenti cross-pagina)
- Micro-animazioni su transizioni (fadeUp, scaleIn)

### Performance
- TanStack Query per caching dati → cambio pagina istantaneo
- Skeleton loaders su tutti i dati async
- Ottimistic updates per azioni comuni (cambia stato, approva)
- Lazy loading per pagine pesanti (Gantt, Report PDF)

### Mobile
- Layout responsive per tablet (Planning drag-drop adattato)
- Timer widget accessibile da mobile per inserimento ore in mobilità
- Notifiche push (futuro)

---

## ROADMAP DI ESECUZIONE SUGGERITA

### Sprint 1 (2 settimane) — Foundation Finance
1. **IMP-01** Regole Riconciliazione Cassa → unblock accounting
2. **IMP-03** Imputazioni Costi → margini reali
3. Fix sidebar: aggiungere Wiki (**IMP-07** è 30 min)

### Sprint 2 (2 settimane) — Team Operations
4. **IMP-02** Assenze + Planning integration → planning affidabile
5. **IMP-04** Commenti Task → collaborazione asincrona
6. **IMP-09** Audit Trail → accountability

### Sprint 3 (2 settimane) — Intelligence Layer
7. **IMP-05** Pianificazione State Machine → flusso preventivo→commessa chiaro
8. **IMP-06** Budget vs Actual → controllo spesa
9. **IMP-10** AI Generate Task → automazione operativa

### Sprint 4 (3 settimane) — Power Features
10. **IMP-08** Gantt → timeline visiva
11. **F2-01** Content Calendar
12. **F2-03** Recurring Tasks Automatici

### Sprint 5+ — Growth Features
- F2-02 Client Portal
- F2-04 Health Score Espanso
- F2-05 Onboarding Automatico
- F2-06 Forecast Intelligente
- F2-07 Webhook n8n

---

*Documento creato da Claude Code — Aprile 2026*  
*Da aggiornare ad ogni sprint completato*

---

## 8. PROMPT DI IMPLEMENTAZIONE

> **Come usare questi prompt**: copia il blocco del prompt direttamente nella chat con Claude Code.  
> Ogni prompt è autonomo — referenzia i file necessari senza rispiegare il sistema.  
> Eseguire nell'ordine suggerito dalla roadmap (IMP-01 → IMP-07 → IMP-02 → ...).

---

### PROMPT — IMP-07 (Quick Win, inizia da qui)

```
Leggi frontend/src/components/layout/AppSidebar.tsx.

Aggiungi "Wiki" alla sezione "Documenti" della sidebar, subito dopo "Report Mensili".
Usa icona BookOpen (già importata in altri item della sidebar).
Route: /wiki

Poi leggi frontend/src/components/common/HelpCenterPanel.tsx.
Aggiungi logica: se l'utente è su una pagina specifica, suggerisci l'articolo wiki
pertinente (usa useLocation per il path attivo). Mostra massimo 2 articoli suggeriti
con titolo e link a /wiki.

Nessun altro file da modificare.
```

---

### PROMPT — IMP-01 (Backend + Frontend)

#### Step A — Backend: 2 endpoint nuovi
```
Leggi backend/app/api/v1/router.py, cerca le route esistenti per
/regole-riconciliazione (GET/POST/PATCH/DELETE/applica).

Aggiungi subito dopo, nello stesso router:

1. POST /regole-riconciliazione/dry-run
   - Prende gli stessi dati di /applica ma NON modifica il DB
   - Restituisce lista: [{ movimento_id, movimento_descrizione, regola_id,
     regola_nome, azione_prevista }]
   - Ruoli: ADMIN, DEVELOPER

2. GET /regole-riconciliazione/{regola_id}/log
   - Legge audit_log dove tabella="regole_riconciliazione" e
     record_id=regola_id, azione="APPLICA"
   - Restituisce: [{ movimento_id, applicato_at, applicato_da }]
   - Ruoli: ADMIN, DEVELOPER

Segui esattamente lo stile degli endpoint esistenti nello stesso file
(dipendenze, get_current_user, AsyncSession).
```

#### Step B — Frontend: pagina + tab in Cassa
```
Leggi:
- frontend/src/pages/Cassa.tsx (per capire struttura e hook usati)
- frontend/src/components/finance/MovimentiTable.tsx (pattern tabella)
- frontend/src/hooks/useCassa.ts (pattern hook)

Crea frontend/src/pages/RegoleRiconciliazione.tsx con:
- Tabella: priorità | pattern | tipo_match | categoria | fornitore | auto | azioni
- Bottone "+ Nuova Regola" → Dialog (seguire pattern CommessaDialog o FatturaModal)
- Dialog campi: pattern(text), tipo_match(select: contains/starts_with/ends_with/regex),
  categoria(text), fornitore_id(select da useFornitori), auto_riconcilia(Switch), priorita(number)
- Bottone "Applica Tutte" → POST /regole-riconciliazione/applica + toast risultato
- Bottone "Dry Run" → POST /regole-riconciliazione/dry-run → Sheet laterale con preview
- Riga draggable per riordinare priorità (usa @dnd-kit se già presente, altrimenti semplice up/down arrows)

Crea frontend/src/hooks/useRegoleRiconciliazione.ts seguendo il pattern di
frontend/src/hooks/useCassa.ts (useQuery + useMutation con invalidation).

Aggiungi route /cassa/regole in frontend/src/App.tsx.
Aggiungi link "Regole" come tab o bottone nella pagina Cassa.tsx esistente.
Aggiungi alla sidebar voce "Regole Matching" sotto "Cassa" nella sezione Finance.
```

---

### PROMPT — IMP-03 (Frontend-only, backend già pronto)

```
Leggi:
- frontend/src/pages/Fatture.tsx (struttura tab attive/passive)
- frontend/src/hooks/useFatture.ts (pattern hook)
- frontend/src/types/index.ts (tipi FatturaPassiva, MovimentoCassa)

Gli endpoint esistenti sono:
  GET/POST /fatture-passive/{id}/imputazioni
  GET/POST /movimenti-cassa/{id}/imputazioni

Aggiungi a frontend/src/types/index.ts:
  interface Imputazione {
    id: string
    tipo: 'PROGETTO' | 'CLIENTE' | 'SPESA_GENERICA' | 'STIPENDIO' | 'FORNITORE'
    cliente_id?: string
    progetto_id?: string
    percentuale: number
    importo: number
    note?: string
  }

Crea frontend/src/components/finance/ImputazioneCostiDrawer.tsx:
- Sheet (shadcn) aperto da prop open/onClose
- Props: sourceType ('fattura_passiva' | 'movimento_cassa'), sourceId, importoTotale
- Lista imputazioni esistenti (GET al mount)
- Bottone "+ Aggiungi" → riga inline con: select Cliente, select Progetto (filtrato per cliente),
  select Tipo, input Percentuale → importo calcolato automaticamente (percentuale/100 * importoTotale)
- Validazione: somma percentuali deve essere ≤ 100%, mostra badge "Totale imputato: €X / €Y"
- Se totale = 100%: badge verde "Completamente imputata"
- Se totale < 100%: badge arancione "€X non imputati"
- Bottone Salva → POST imputazione, invalidate query

In frontend/src/pages/Fatture.tsx nella tab PASSIVE:
- Aggiungi colonna "Imputata" con badge (verde check / arancione alert)
- Aggiungi azione "Imputa" nella riga → apre ImputazioneCostiDrawer

In frontend/src/pages/Cassa.tsx nella tabella movimenti:
- Aggiungi azione "Imputa" → stesso drawer con sourceType='movimento_cassa'

In frontend/src/pages/CommessaDetail.tsx:
- Aggiungi sezione "Costi Diretti" con breakdown:
  GET /commesse/{id}/costi-dettaglio (se endpoint non esiste, calcola client-side
  sommando le imputazioni filtrate per commessa_id)
- Mostra: Manuale | Da Fatture Passive | Da Movimenti | Totale
```

---

### PROMPT — IMP-02 (Backend + Frontend, più grande)

#### Step A — Backend
```
Leggi backend/app/api/v1/router.py, cerca le route /assenze esistenti
(GET, POST, DELETE).

La tabella assenze ha: id, user_id, data_inizio, data_fine, tipo (FERIE/MALATTIA/
PERMESSO), note, created_at. Aggiungi colonna stato (PENDING/APPROVATA/RIFIUTATA,
default PENDING) se non esiste — controlla backend/app/models/models.py prima.

Aggiungi al router:
1. GET /assenze/me → assenze dell'utente corrente (filtra per user_id=current_user.id)
2. GET /assenze/team → tutte assenze (ruoli: ADMIN, PM, DEVELOPER)
3. PATCH /assenze/{id}/approva → stato=APPROVATA, crea timesheet ASSENZA automaticamente
   (durata_minuti = ore_lavorative_giornaliere * giorni_assenza, stato=APPROVATO)
4. PATCH /assenze/{id}/rifiuta → stato=RIFIUTATA
5. GET /assenze/availability → params: week (es: 2026-W16)
   → restituisce dict {user_id: [date_indisponibili]} per la settimana

Segui pattern esatto degli endpoint esistenti per auth e dipendenze.
```

#### Step B — Frontend
```
Leggi:
- frontend/src/pages/Planning.tsx (come usa disponibilità risorse)
- frontend/src/pages/settings/ProfileSettings.tsx (pattern sezione settings)
- frontend/src/hooks/useUsers.ts

Crea frontend/src/hooks/useAssenze.ts con:
  useAssenzeMie(), useAssenzeTeam(), useCreateAssenza(),
  useApprovaAssenza(), useRifiutaAssenza(), useAvailability(week)

Crea frontend/src/components/assenze/AssenzaRequestDialog.tsx:
- Dialog con: tipo(Select: FERIE/MALATTIA/PERMESSO), data_inizio(DatePicker),
  data_fine(DatePicker), note(Textarea)
- Calcola giorni automaticamente, mostra "5 giorni lavorativi"
- Submit → POST /assenze, toast "Richiesta inviata al PM"

Crea frontend/src/components/assenze/AssenzeTeamPanel.tsx:
- Lista richieste con stato PENDING
- Per ogni riga: avatar utente, tipo, date, giorni, [Approva][Rifiuta]
- Approva/Rifiuta → PATCH + toast + invalidate

In frontend/src/pages/settings/ProfileSettings.tsx:
- Aggiungi sezione "Le Mie Assenze" in fondo alla pagina
- Mostra: ferie usate/totali (progress bar), lista assenze con stato badge
- Bottone "+ Richiedi Assenza" → AssenzaRequestDialog

In frontend/src/pages/Planning.tsx:
- Al caricamento chiama useAvailability(currentWeek)
- Per ogni cella [risorsa][giorno]: se la data è in user.date_indisponibili,
  mostra sfondo striato con tooltip "Assenza: tipo (stato)"
- Disabilita drop su celle con assenza APPROVATA
- Aggiungi tab "Assenze Team" → AssenzeTeamPanel (visibile solo per ADMIN/PM)
```

---

### PROMPT — IMP-04 (Frontend-only)

```
Leggi:
- frontend/src/components/studio/TaskDetailView.tsx (dove aggiungere commenti)
- frontend/src/hooks/useUsers.ts (per mention dropdown)
- frontend/src/types/index.ts

Gli endpoint esistenti: GET/POST/DELETE /tasks/{task_id}/comments

Aggiungi a types/index.ts:
  interface TaskComment {
    id: string; task_id: string; autore_id: string; autore: User
    contenuto: string; created_at: string; updated_at: string
    reactions?: Record<string, string[]>  // emoji → [user_ids]
  }

Crea frontend/src/hooks/useTaskComments.ts:
  useComments(taskId), useAddComment(), useDeleteComment()
  Seguire pattern di frontend/src/hooks/useCommesse.ts

Crea frontend/src/components/tasks/TaskCommentSection.tsx:
- Prop: taskId: string
- Lista commenti con: UserAvatar, nome, tempo relativo (es "2h fa"), contenuto
- Input textarea con listener su "@" → mostra dropdown utenti (da useUsers)
  → inserisce "@NomeCognome" nel testo
- Bottone Invia → POST + invalidate comments query
- Hover su commento → mostra pulsante 🗑 (solo per autore o ADMIN)
- Reazioni: riga emoji (👍 ✅ 👀 🔄) sotto ogni commento, click → toggle

In TaskDetailView.tsx:
- Importa e aggiungi <TaskCommentSection taskId={task.id} /> in fondo al pannello
- Mostra count commenti nel header del task: "Commenti (N)"

In frontend/src/components/studio/StudioKanbanView.tsx:
- Se task ha commenti > 0, mostra badge numero in basso a sinistra della card

Nota: per le mention-notifications, aggiungi solo la chiamata al backend
(POST /notifications con type=MENTION, link=/studio-os?task={id}).
Non serve creare nuovo sistema, usa hook useNotifications esistente.
```

---

### PROMPT — IMP-09 (Backend + Frontend, leggero)

#### Step A — Backend
```
Leggi backend/app/models/models.py, trova la tabella AuditLog.
Leggi backend/app/api/v1/router.py per capire pattern auth/deps.

Aggiungi al router:

GET /audit-log
  Query params: tabella(str, opzionale), user_id(UUID, opzionale),
                from_date(date), to_date(date), limit(int=50), offset(int=0)
  Response: [{ id, user_id, user_nome, tabella, record_id, azione,
               dati_prima, dati_dopo, created_at }]
  Ruoli: ADMIN, DEVELOPER

GET /audit-log/entity/{tabella}/{record_id}
  Response: stessa struttura, filtrata per tabella+record_id
  Ruoli: ADMIN, DEVELOPER, PM (solo per le proprie entità)

JOIN con users per aggiungere user_nome al response.
```

#### Step B — Frontend
```
Leggi:
- frontend/src/pages/Settings.tsx e le sottopagine in settings/
- frontend/src/pages/CommessaDetail.tsx (per aggiungere tab Storico)

Crea frontend/src/hooks/useAuditLog.ts:
  useAuditLog(filters), useEntityAuditLog(tabella, recordId)

Crea frontend/src/components/audit/AuditLogTable.tsx:
- Tabella: timestamp | utente (avatar+nome) | azione (badge) | entità | dettaglio
- Click su riga → expand inline con diff viewer:
  colonne "Prima" e "Dopo", evidenzia in rosso/verde i campi cambiati
  (confronta dati_prima vs dati_dopo come oggetti JSON)
- Filtri: select utente, select tabella, date range

Crea frontend/src/pages/settings/AuditSettings.tsx:
- Usa AuditLogTable con filtri completi
- Titolo "Audit Trail — Storico Modifiche"

In frontend/src/pages/Settings.tsx:
- Aggiungi tab/voce "Audit Trail" visibile solo a ADMIN/DEVELOPER
- Ruota verso AuditSettings

In frontend/src/pages/CommessaDetail.tsx:
- Aggiungi tab "Storico" (ultima posizione)
- Usa <AuditLogTable tabella="commesse" recordId={commessa.id} hideFilters />
  (versione compatta senza filtri, solo l'entità corrente)

Stesso pattern in ClienteDetail.tsx.
```

---

### PROMPT — IMP-05 (Backend + Frontend)

#### Step A — Backend
```
Leggi backend/app/api/v1/router.py, trova le route /piani esistenti.
Leggi backend/app/models/models.py, trova Pianificazione e PianificazioneLavorazione.

Aggiungi:

PATCH /piani/{piano_id}/approva
  - Verifica stato corrente = PENDING, altrimenti 400
  - Aggiorna stato → ACCEPTED
  - Crea notifica per PM del cliente: "Pianificazione [cliente] approvata"
  - Ruoli: ADMIN, DEVELOPER

PATCH /piani/{piano_id}/converti
  - Verifica stato = ACCEPTED, altrimenti 400
  - Crea Commessa con: cliente_id, mese_competenza (da piano), stato=APERTA,
    pianificazione_id=piano.id, ore_contratto=somma lavorazioni ore
  - Aggiorna piano.stato → CONVERTED
  - Response: { piano, commessa }
  - Ruoli: ADMIN, DEVELOPER, PM

GET /piani/{piano_id}/delta
  - Se piano ha commessa collegata: confronta lavorazioni (previsto) con
    timesheet della commessa (reale) aggregati per user_id
  - Response: [{ user_id, user_nome, ore_previste, ore_reali, delta_ore,
                 costo_previsto, costo_reale, delta_costo }]
  - Ruoli: ADMIN, DEVELOPER, PM
```

#### Step B — Frontend
```
Leggi:
- frontend/src/pages/PreventiviPage.tsx (per aggiungere bottone)
- frontend/src/pages/CommessaDetail.tsx (tab Pianificazione esistente)
- frontend/src/hooks/useForecast.ts o simile per pattern hook

Crea frontend/src/pages/PianificazioneDetail.tsx:
- Header: cliente, mese, stato badge (PENDING=gray/ACCEPTED=blue/CONVERTED=green),
  budget, [Approva →] se PENDING, [Converti in Commessa →] se ACCEPTED
- Tabella lavorazioni: risorsa (select da useUsers) | servizio (text) |
  ore previste (input) | costo orario (auto da user.costo_orario) | totale €
- Bottone "+ Aggiungi Risorsa" → nuova riga vuota
- Footer: totale costo previsto, margine previsto (budget - totale)
- Se stato=CONVERTED: sezione "Delta Pianificato vs Reale" con tabella da /piani/{id}/delta
  con color coding: delta positivo=rosso, negativo=verde

Crea frontend/src/hooks/usePianificazioni.ts con:
  usePiani(), usePiano(id), useCreatePiano(), useApprovaPiano(),
  useConvertiPiano(), usePianoDelta(id)

In PreventiviPage.tsx:
- Se preventivo.stato === 'ACCETTATO' e non ha pianificazione_id:
  aggiungi bottone "Crea Pianificazione" → naviga a /pianificazioni/new?preventivo_id=X

Aggiungi route /pianificazioni/:id in App.tsx.
Aggiungi voce "Pianificazioni" nella sidebar sotto Commesse.

In CommessaDetail.tsx tab "Pianificazione":
- Se commessa.pianificazione_id: mostra delta inline (GET /piani/{id}/delta)
- Altrimenti: bottone "Crea Pianificazione"
```

---

### PROMPT — IMP-06 (Frontend-heavy)

```
Leggi:
- frontend/src/pages/Budget esistente (o cerca il file in frontend/src/pages/)
- frontend/src/hooks/useBudget.ts
- frontend/src/types/index.ts per BudgetMensile e BudgetCategory

Gli endpoint esistenti: GET/POST /budget, POST /budget/copia, GET /budget/consuntivo

Aggiungi a types/index.ts:
  interface BudgetVariance {
    categoria_id: string; categoria_nome: string; colore: string
    budget: number; speso: number; varianza: number; varianza_pct: number
    status: 'ok' | 'warning' | 'over'  // ok=<80%, warning=80-100%, over=>100%
  }

Aggiorna frontend/src/hooks/useBudget.ts:
  Aggiungi useVariance(mese: string) → GET /budget/variance?mese=X
  Aggiungi useBudgetTrend(mesi: number) → GET /budget/trend?mesi=N

Riscrivi (o potenzia) la pagina Budget:
- Header: [← mese precedente] "Aprile 2026" [mese successivo →] + [Copia da mese prec.]
- Per ogni categoria: card con
  - Nome + dot colorato (categoria.colore)
  - Progress bar: speso/budget, colore dinamico (verde <80%, giallo 80-100%, rosso >100%)
  - Testo: "€speso / €budget (pct%)" + badge WARNING/OVER se superata
  - Click sulla card → inline edit del budget pianificato
- Footer totale con stessa logica
- Tab "Trend" → LineChart (recharts, già usato in Analytics.tsx come riferimento)
  con due serie per categoria selezionabile, ultimi 6 mesi

Aggiungi in backend/app/api/v1/router.py:
  GET /budget/variance?mese=YYYY-MM
    Aggrega: budget_mensile + costi_fissi + fatture_passive_imputazioni +
    movimenti_cassa_imputazioni per mese e categoria
    Response: [BudgetVariance]

  GET /budget/trend?mesi=N
    Stessa logica per ultimi N mesi
    Response: { mesi: [str], series: [{ categoria, data: [BudgetVariance] }] }
```

---

### PROMPT — IMP-08 (Frontend-only)

```
Leggi:
- frontend/src/components/gantt/GanttChart.tsx (componente già esistente, capiscine le props)
- frontend/src/pages/Planning.tsx (dove aggiungere il tab Gantt)
- frontend/src/hooks/useTasks.ts (dati tasks con date)
- frontend/src/hooks/useUsers.ts (risorse/utenti)
- frontend/src/hooks/useAssenze.ts (assenze per overlay)

Studia le props attuali di GanttChart.tsx e adatta se necessario per accettare:
  tasks: Task[]          — array di task con data_inizio, data_scadenza, assegnatario_id
  users: User[]          — per raggruppare per risorsa
  assenze: Assenza[]     — per mostrare bande assenze (colore semitrasparente)
  onTaskClick: (task) => void
  onTaskDateChange: (taskId, newStart, newEnd) => void  — per drag resize

In Planning.tsx:
- Aggiungi tab "Gantt" accanto agli altri tab esistenti
- Quando tab attivo = "Gantt": mostra <GanttChart> con dati filtrati per settimana/mese corrente
- Click su task in Gantt → apre TaskDetailView (stesso di Kanban)
- Drag resize → chiama PATCH /tasks/{id} con nuove date (ottimistic update)

In Studio per singolo progetto (StudioListView o dove ci sono le view Kanban/Cal/Team):
- Aggiungi tab "Gantt" → <GanttChart tasks={projectTasks} /> filtrato per progetto

Filtri Gantt (toolbar sopra):
- Select Cliente (multi), Select Risorsa (multi), DateRange picker
- Toggle "Mostra assenze" (default on)

Export: bottone "Esporta PNG" → usa html2canvas o window.print() sul div del gantt.
Se html2canvas non è installato, usa semplicemente CSS @media print.
```

---

### PROMPT — IMP-10 (Backend + Frontend)

#### Step A — Backend AI endpoint
```
Leggi:
- backend/app/api/v1/ai.py (endpoint AI esistenti, capisci come usa Claude API)
- backend/app/models/models.py (Task, Timesheet, Commessa, Progetto, User)

Aggiungi in ai.py (o router.py se ai.py non esiste):

POST /ai/generate-tasks
  Body: { commessa_id: UUID, prompt_extra: str = "", max_ore: int = 40 }
  
  Logica:
  1. Carica dal DB: commessa con cliente e progetti collegati
  2. Carica storico timesheet degli ultimi 6 mesi per quel cliente
     (aggregato per servizio: avg durata_minuti, count)
  3. Carica task template attivi per il tipo di progetto
  4. Chiama Claude API (claude-sonnet-4-6) con prompt strutturato:
     - System: "Sei un PM di un'agenzia digital. Genera task per una commessa mensile."
     - User: f"Cliente: {cliente.ragione_sociale}, Tipo: {progetto.tipo},
       Servizi storici: {storico_aggregato}, Template base: {templates},
       Budget ore: {max_ore}h, Istruzioni extra: {prompt_extra}"
     - Response format JSON: [{ titolo, servizio, stima_minuti, priorita,
       ruolo_suggerito, rationale }]
  5. Restituisce i task suggeriti (NON li crea, solo suggerisce)
  
  Ruoli: ADMIN, DEVELOPER, PM
  Timeout: 30s

POST /ai/estimate-hours
  Body: { titolo_task: str, cliente_id: UUID, mesi_storico: int = 6 }
  Risposta: { stima_minuti: int, confidenza: float, simili: [{ titolo, durata_avg }] }
  Logica: cerca in timesheet task con titolo simile (ILIKE) per quel cliente,
  calcola media. Se storico insufficiente, chiama Claude per stima.
```

#### Step B — Frontend
```
Leggi:
- frontend/src/pages/CommessaDetail.tsx (tab "Task Template")
- frontend/src/hooks/useTaskTemplates.ts
- frontend/src/hooks/useAI.ts (se esiste, per pattern chiamate AI)

Crea frontend/src/components/ai/AITaskGeneratorDialog.tsx:
- Step 1 - Contesto (auto-popolato, read-only):
  "Cliente: X | Tipo: RETAINER | Storico: N mesi | Budget: X ore"
  Input: prompt_extra (textarea, placeholder "Es: focus su Reels questo mese")
  Bottone [Genera Suggerimenti] → POST /ai/generate-tasks → loading skeleton

- Step 2 - Review (dopo risposta AI):
  Lista task con checkbox (tutti selezionati di default):
  ☑ titolo | stima (ore/min) | servizio | ruolo suggerito | [rationale tooltip]
  Footer: "Stima totale: Xh / max_ore budget" con color coding
  [Deseleziona tutto] [Seleziona tutto] [Crea Task Selezionati →]

- Step 3 - Conferma:
  POST /tasks per ogni task selezionato con commessa_id
  Progress bar "Creando task 3/8..."
  Al termine: toast "8 task creati" + chiude dialog + refresh tab

In CommessaDetail.tsx nel tab "Task Template":
- Aggiungi bottone [🤖 Genera con AI] accanto a [📋 Da Template]
- Click → apre AITaskGeneratorDialog con commessa_id passato come prop

Crea frontend/src/hooks/useAITaskGeneration.ts:
  useGenerateTasksAI(commessaId) → mutation verso /ai/generate-tasks
  Segui pattern di frontend/src/hooks/useCommesse.ts per mutation.
```

---

### PROMPT — F2-01 Content Calendar (Fase 2)

```
Leggi frontend/src/pages/ContenutiPage.tsx (struttura kanban esistente).
Leggi frontend/src/hooks/useContenuti.ts.

Aggiungi tab "Calendario" in ContenutiPage accanto a "Kanban".

Vista Calendario (mensile):
- Grid 7 colonne × 5 righe (settimane del mese)
- Header: [← mese] "Aprile 2026" [mese →]
- Ogni contenuto posizionato nella cella della sua data_scadenza
- Card: dot colorato (per cliente) + titolo troncato + badge tipo
- Celle con > 3 contenuti: mostra "2 altri..." con tooltip
- Click su contenuto → apre stessa modal di dettaglio usata nel Kanban
- Drag contenuto tra celle → PATCH /contenuti/{id} con nuova data_scadenza (ottimistic)
- Overlay assenze: celle con assenze team hanno background striato

Aggiungi colore per cliente: genera colore deterministico da cliente_id
(usa HSL con hue = parseInt(id.slice(-4), 16) % 360).

Usa date-fns (già nel progetto) per calcoli date. Non installare nuove librerie.
```

---

### PROMPT — F2-03 Recurring Tasks (Fase 2)

```
Leggi:
- backend/app/api/v1/router.py (endpoint task-templates esistenti)
- backend/app/models/models.py (TaskTemplate, Commessa, Progetto)
- frontend/src/pages/TaskTemplatesPage.tsx

Step Backend:
Aggiungi endpoint POST /task-templates/auto-genera-mese
  - Parametro: mese (date, default=primo giorno mese corrente)
  - Trova tutte commesse con stato=APERTA per il mese
  - Per ogni commessa: trova progetti di tipo RETAINER collegati
  - Per ogni progetto: trova template attivi con progetto_tipo=RETAINER o ALL
  - Genera task se non già esistenti per quella commessa+template+mese
  - Crea notifica PM: "Generati N task per M commesse RETAINER"
  - Response: { commesse_processate: int, task_creati: int, errori: [] }
  - Ruolo: ADMIN (pensato per essere chiamato anche da cron)

Aggiungi endpoint GET /task-templates/preview-auto-genera?mese=YYYY-MM-DD
  - Stessa logica ma non crea nulla, restituisce preview

Step Frontend in TaskTemplatesPage.tsx:
- Aggiungi sezione "Generazione Automatica" in fondo alla pagina:
  - Info: "Ogni 1° del mese vengono generati automaticamente i task per le commesse RETAINER attive."
  - Bottone "Genera Ora per [mese corrente]" → POST /task-templates/auto-genera-mese
  - Bottone "Preview" → GET preview → Sheet con lista task che verranno creati
  - Risultato: toast "Generati 47 task per 6 commesse"
```

---

### PROMPT — F2-02 Client Portal (Fase 2)

```
Questo è un progetto più grande. Esegui in questo ordine:

Step 1 — Backend: nuovo ruolo e auth
In backend/app/models/models.py aggiunge CLIENT a UserRole enum.
In backend/app/api/v1/router.py:
  POST /auth/client-login → accetta token magic link (UUID monouso)
    Genera JWT con ruolo=CLIENT e cliente_id nel payload
  POST /auth/generate-client-link → genera token monouso per cliente_id
    Ruoli: ADMIN, PM

Step 2 — Backend: endpoint client-safe
Aggiungi prefisso /client agli endpoint che il cliente può vedere:
  GET /client/commessa-attiva → ultima commessa APERTA del suo cliente_id
  GET /client/contenuti → contenuti in stato INVIATO_AL_CLIENTE per suo cliente
  PATCH /client/contenuti/{id}/approva → cambia stato a APPROVATO_CLIENTE
  PATCH /client/contenuti/{id}/richiedi-modifiche → stato + nota_revisione obbligatoria
  GET /client/preventivi → preventivi INVIATO per suo cliente
  PATCH /client/preventivi/{id}/accetta → stato ACCETTATO
  PATCH /client/preventivi/{id}/rifiuta → stato RIFIUTATO

Step 3 — Frontend: route /client
Crea frontend/src/pages/ClientPortal.tsx:
  - Layout separato (no sidebar ERP, branding minimale)
  - Sezione "I tuoi contenuti": lista con stato + pulsanti Approva/Richiedi modifiche
  - Sezione "Preventivi in attesa": con pulsanti Accetta/Rifiuta
  - Design: stesso dark theme ma più semplice, logo Bite in alto
  
Aggiungi route /client in App.tsx con layout separato (no DashboardLayout).

Step 4 — Invio link (in ClienteDetail.tsx):
  Bottone "Invia Link Accesso" → POST /auth/generate-client-link
  → copia link negli appunti o apre mail client con link precompilato
```

---

### PROMPT — F2-07 Webhook n8n (Fase 2)

```
Step Backend:
Crea backend/app/models/models.py: aggiungi WebhookEndpoint (id, url, eventi JSON,
secret, attivo, created_at, retry_count default 3).

Crea backend/app/services/webhook_service.py:
  async def emit(evento: str, payload: dict):
    - Carica tutti WebhookEndpoint attivi con evento in endpoint.eventi
    - Per ognuno: POST al url con headers X-Bite-Event, X-Bite-Signature (HMAC-SHA256)
    - Retry con exponential backoff (1s, 2s, 4s) se status != 2xx
    - Log successo/fallimento in audit_log

Chiama webhook_service.emit() nei punti chiave del router:
  commessa PATCH stato → "commessa.stato_cambiato"
  preventivo PATCH stato=ACCETTATO → "preventivo.accettato"
  lead PATCH /converti → "lead.convertito"
  fattura PATCH /incassa → "fattura.incassata"
  timesheet POST /approva → "timesheet.approvato"
  contenuto PATCH stato=APPROVATO_CLIENTE → "contenuto.approvato_cliente"

Aggiungi endpoint:
  GET /admin/webhooks → lista endpoint
  POST /admin/webhooks → crea
  PATCH /admin/webhooks/{id} → modifica
  DELETE /admin/webhooks/{id} → elimina
  POST /admin/webhooks/{id}/test → manda payload di test
  Ruoli: ADMIN

Step Frontend:
In Settings, aggiungi tab "Webhook" (visibile solo ADMIN).
Crea frontend/src/pages/settings/WebhookSettings.tsx:
  - Tabella: URL | eventi (badge per ognuno) | attivo toggle | azioni
  - Dialog crea/modifica: URL(text), eventi(checkboxes), secret(text, mostra una sola volta)
  - Bottone "Test" → POST test → mostra response in modal
```

---

> **Note sui prompt**:
> - Ogni prompt assume che `CLAUDE.md` sia già in contesto (non serve ri-spiegare stack, ruoli, design system)
> - I prompt backend chiedono sempre di seguire il pattern degli endpoint esistenti → zero ambiguità sullo stile
> - I prompt frontend usano pattern file come riferimento → coerenza garantita senza spiegazioni
> - Non installare librerie non già presenti nel progetto senza chiedere conferma
> - Dopo ogni implementazione: `docker-compose up -d --build` per testare
