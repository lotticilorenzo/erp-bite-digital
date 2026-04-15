# BITE ERP — Roadmap Feature & Prompt di Implementazione

> Ogni sezione contiene: descrizione, task tecnici, e il prompt esatto da dare a Claude Code per implementare la feature.

---

## 🔴 PRIORITÀ 1 — Alert Marginalità in Tempo Reale

### Cosa fa
Ogni volta che un dipendente logga ore su una commessa, il sistema ricalcola il margine residuo.
Se scende sotto soglie predefinite (es. 30% warning, 15% critico), invia una notifica push a PM e ADMIN.
La commessa cambia colore visivamente nella lista (giallo/rosso).

### Task tecnici
- [ ] Backend: endpoint `GET /api/v1/commesse/{id}/profitability` che calcola margine live
- [ ] Backend: trigger automatico su POST `/timesheet` che controlla margine e crea notifica
- [ ] Frontend: indicatore margine colorato in CommessaTable e CommessaDetail
- [ ] Frontend: banner di alert in CommessaDetail quando margine < soglia
- [ ] Frontend: settings admin per configurare le soglie (default 30% warning, 15% critico)
- [ ] Frontend: notifica in NotificationCenter con link alla commessa

### Prompt implementazione
```
Implementa il sistema di alert marginalità in tempo reale per Bite ERP.

CONTESTO: Il gestionale gestisce "commesse" mensili per un'agenzia di marketing. Ogni commessa ha
un valore fatturabile (campo `valore_fatturabile`) e delle ore lavorate (tabella `timesheet`).
Il margine si calcola come: (valore_fatturabile - costo_manodopera) / valore_fatturabile * 100.
Il costo manodopera = somma(ore_lavorate * costo_orario_utente) per tutti i timesheet della commessa.

COSA IMPLEMENTARE:

1. BACKEND (backend/app/api/v1/router.py):
   - Aggiungi endpoint GET /api/v1/commesse/{id}/profitability che ritorna:
     { margine_pct, ore_budget, ore_consumate, ore_rimanenti, costo_manodopera, valore_fatturabile, alert_level: "OK"|"WARNING"|"CRITICAL" }
   - Dopo ogni creazione timesheet (POST /timesheet), controlla il margine della commessa collegata.
     Se margine < 30% e non esiste già una notifica WARNING per questa commessa questo mese → crea notifica.
     Se margine < 15% e non esiste già una notifica CRITICAL → crea notifica con priorità alta.
   - Le soglie sono configurabili tramite settings (usa 30% e 15% come default hardcoded per ora).

2. FRONTEND - CommessaTable (frontend/src/components/commesse/CommessaTable.tsx):
   - Aggiungi colonna "Margine" che mostra il % con badge colorato:
     Verde se > 30%, Giallo se 15-30%, Rosso se < 15%, Grigio se non calcolabile
   - Il badge deve essere cliccabile e aprire CommessaDetail

3. FRONTEND - CommessaDetail (frontend/src/pages/CommessaDetail.tsx):
   - Aggiungi sezione "Profitability" in cima alla pagina con:
     - Progress bar ore consumate / ore budget
     - Margine % con colore dinamico
     - Costo manodopera reale vs valore fatturabile
     - Alert banner rosso/giallo se sotto soglia con messaggio chiaro
   - Usa l'hook useProfitability(commessaId) da creare in hooks/useCommesse.ts

4. HOOK (frontend/src/hooks/useCommesse.ts):
   - Aggiungi useProfitability(id: string) che fa GET /api/v1/commesse/{id}/profitability
   - Refetch automatico ogni 30 secondi se la pagina è aperta

Il design deve seguire il sistema esistente: dark mode, colori primary purple, card rounded-3xl.
NON modificare la struttura del DB esistente.
```

---

## 🔴 PRIORITÀ 2 — Forecast Ricavi Intelligente

### Cosa fa
Dashboard admin che mostra la proiezione dei ricavi per i prossimi 3 mesi combinando:
- Commesse attive (ricavo certo al 100%)
- Pipeline CRM (ricavo probabilistico pesato per % chiusura del lead)
- Trend storico (media ultimi 6 mesi)

Disponibile come widget in Dashboard e come pagina dedicata in Analytics.

### Task tecnici
- [ ] Backend: endpoint `GET /api/v1/analytics/forecast?mesi=3` 
- [ ] Frontend: widget ForecastWidget nella Dashboard principale
- [ ] Frontend: sezione Forecast in Analytics con grafico area
- [ ] Frontend: breakdown per cliente e per tipo (certo vs probabilistico)

### Prompt implementazione
```
Implementa il sistema di Forecast Ricavi Intelligente per Bite ERP.

CONTESTO: L'agenzia ha bisogno di prevedere i ricavi futuri combinando dati certi (commesse aperte)
e probabilistici (pipeline CRM). Il CRM ha lead con campo `valore_stimato` e `probabilita_chiusura` (0-100).
Le commesse hanno `valore_fatturabile` e `mese_competenza` e `stato` (APERTA|CHIUSA|FATTURATA|INCASSATA).

COSA IMPLEMENTARE:

1. BACKEND - Nuovo endpoint:
   GET /api/v1/analytics/forecast?mesi=3
   Ritorna per ogni mese futuro:
   {
     mese: "2026-05-01",
     ricavo_certo: 45000,        // commesse APERTE in quel mese
     ricavo_probabilistico: 12000, // lead CRM con chiusura prevista quel mese * probabilita
     ricavo_totale: 57000,
     ricavo_storico: 38000,      // media stesso mese ultimi 2 anni
     commesse: [...],            // lista commesse che contribuiscono
     lead: [...]                 // lista lead che contribuiscono
   }

2. FRONTEND - Nuovo componente ForecastWidget:
   - Posizionalo nella Dashboard principale come card grande
   - Grafico area con 3 linee: Certo (verde), Probabilistico (blu tratteggiato), Storico (grigio)
   - Sotto il grafico: lista top 3 opportunità CRM che impattano di più il forecast
   - Toggle per vedere mese per mese o trimestrale
   - Usa recharts AreaChart con i colori del design system

3. FRONTEND - Sezione in Analytics (/analytics):
   - Aggiungi tab "Forecast" alla pagina Analytics esistente
   - Mostra il grafico esteso con breakdown per cliente
   - Tabella con dettaglio commessa per commessa e lead per lead
   - KPI cards: "Ricavi certi prossimi 3 mesi", "Pipeline potenziale", "Tasso conversione CRM"

Il design deve seguire il sistema esistente: dark mode, colori primary purple.
Usa useChartSize hook (già esistente) per i grafici recharts. NON usare ResponsiveContainer.
```

---

## 🔴 PRIORITÀ 3 — Recurring Tasks Automatici

### Cosa fa
Per ogni cliente con contratto retainer, il sistema genera automaticamente ogni mese i task standard
(report performance, programmazione editoriale, call mensile, ecc.) basandosi su template predefiniti.
Il PM può configurare i template per cliente e abilitare/disabilitare la generazione automatica.

### Task tecnici
- [ ] DB: tabella `task_templates` e `task_template_items`
- [ ] Backend: endpoint CRUD per template e logica di generazione mensile
- [ ] Backend: job schedulato (o trigger manuale) per generare task a inizio mese
- [ ] Frontend: pagina Template (dentro Studio OS o Settings)
- [ ] Frontend: toggle per abilitare recurring su ogni commessa
- [ ] Frontend: preview dei task che verranno generati

### Prompt implementazione
```
Implementa il sistema di Recurring Tasks Automatici per Bite ERP.

CONTESTO: L'agenzia gestisce molti clienti con contratti retainer mensili ricorrenti.
Ogni mese si devono creare manualmente gli stessi task (es. "Report performance mensile",
"Programmazione editoriale", "Call strategica cliente"). Questo richiede 30+ minuti al mese.
Il sistema tasks esiste già in /api/v1/tasks con campi: titolo, descrizione, stato, commessa_id,
assegnatario_id, data_scadenza, stima_minuti, priorita.

COSA IMPLEMENTARE:

1. BACKEND - Nuove tabelle (aggiungi a schema.sql e crea con AUTO_CREATE):
   - task_templates: { id, nome, descrizione, progetto_id, created_by, attivo, created_at }
   - task_template_items: { id, template_id, titolo, descrizione, servizio, stima_minuti, 
     priorita, giorno_scadenza (1-31), assegnatario_ruolo }

2. BACKEND - Nuovi endpoint:
   - GET/POST/PUT/DELETE /api/v1/task-templates
   - POST /api/v1/task-templates/{id}/genera?commessa_id=X  → genera i task dal template
   - POST /api/v1/task-templates/genera-tutti?mese=2026-05-01 → genera per tutte le commesse attive

3. FRONTEND - Pagina Template Tasks (/settings/task-templates o /studio-os/templates):
   - Lista template con nome, numero task inclusi, stato attivo/inattivo
   - Editor template: aggiungi/rimuovi task items con tutti i campi
   - Pulsante "Genera ora" per test immediato
   - Toggle "Auto-genera a inizio mese" per ogni template

4. FRONTEND - Integrazione in CommessaDetail:
   - Sezione "Template Associato" che mostra quale template è collegato
   - Pulsante "Genera task questo mese" 
   - Storico generazioni precedenti

5. TEMPLATE PREDEFINITI DA CREARE:
   - "Social Media Retainer": Report mensile, Piano editoriale, Creazione contenuti, Call cliente, Analisi competitor
   - "Google Ads": Ottimizzazione campagne, Report performance, Call mensile, Analisi keywords
   - "SEO": Analisi ranking, Contenuti blog, Link building report, Call mensile
   - "Brand Identity": (solo one-shot, non ricorrente)

Il design segue il sistema esistente. NON usare ResponsiveContainer in recharts.
```

---

## 🟡 PRIORITÀ 4 — Pipeline Approvazione Contenuti

### Cosa fa
Flusso strutturato per gestire la produzione e approvazione dei contenuti dell'agenzia.
Il dipendente crea il contenuto, il PM lo rivede internamente, poi va al cliente per approvazione finale.
Ogni contenuto ha stati chiari e notifiche automatiche.

### Task tecnici
- [ ] DB: tabella `contenuti` con stati e allegati
- [ ] Backend: CRUD contenuti + cambio stato con notifiche
- [ ] Frontend: board kanban contenuti (simile a Studio OS ma con gli stati dell'approvazione)
- [ ] Frontend: form upload contenuto con link/file
- [ ] Frontend: vista cliente (read-only, senza login completo)

### Prompt implementazione
```
Implementa la Pipeline di Approvazione Contenuti per Bite ERP.

CONTESTO: L'agenzia produce contenuti (post social, copy, design, video) per i clienti.
Oggi il processo di approvazione avviene via WhatsApp/email. Vogliamo integrarlo nel gestionale
con un flusso strutturato e tracciabile.

STATI DEL CONTENUTO:
BOZZA → IN_REVISIONE_INTERNA → MODIFICHE_RICHIESTE_INTERNE → APPROVATO_INTERNAMENTE → 
INVIATO_AL_CLIENTE → MODIFICHE_RICHIESTE_CLIENTE → APPROVATO_CLIENTE → PUBBLICATO → ARCHIVIATO

COSA IMPLEMENTARE:

1. BACKEND - Nuova tabella `contenuti`:
   { id, titolo, tipo (POST_SOCIAL|COPY|DESIGN|VIDEO|EMAIL|ALTRO), 
     stato, commessa_id, progetto_id, assegnatario_id,
     data_consegna_prevista, url_preview, testo, note_revisione,
     approvato_da, approvato_at, pubblicato_at, created_at }

2. BACKEND - Endpoint:
   - GET/POST/PUT/DELETE /api/v1/contenuti
   - PUT /api/v1/contenuti/{id}/stato (cambia stato + crea notifica automatica)
   - GET /api/v1/contenuti?commessa_id=X&stato=Y

3. FRONTEND - Nuova pagina /contenuti:
   - Board kanban con colonne per ogni stato
   - Card contenuto con: tipo, cliente, assegnatario, data scadenza, badge stato colorato
   - Drag-drop per cambiare stato (solo permessi corretti)
   - Click sulla card apre modal dettaglio con: preview URL, testo, storico stati, note revisione
   - Filtri per: cliente, tipo, assegnatario, periodo

4. FRONTEND - Integrazione in CommessaDetail e Studio OS:
   - Tab "Contenuti" in CommessaDetail che mostra i contenuti della commessa
   - Pulsante "Nuovo Contenuto" che apre form rapido

5. REGOLE PERMESSI:
   - DIPENDENTE: può creare, modificare propri contenuti, inviare in revisione
   - PM/ADMIN: può approvare internamente, rifiutare, inviare al cliente, approvare definitivamente
   - Notifica automatica al PM quando un dipendente invia in revisione
   - Notifica automatica al dipendente quando PM richiede modifiche o approva

Il design segue il sistema esistente. Usa dnd-kit (già installato) per il drag-drop del kanban.
NON usare ResponsiveContainer in recharts. Dark mode, colori primary purple.
```

---

## 🟡 PRIORITÀ 5 — Template di Progetto

### Cosa fa
Libreria di template predefiniti per i tipi di progetto più comuni dell'agenzia.
Quando si crea un nuovo progetto, si sceglie un template e vengono pre-popolati task, milestones,
checklist e struttura documentale. Risparmia 1-2 ore di setup per ogni nuovo cliente.

### Task tecnici
- [ ] DB: tabelle `progetto_templates` con struttura task/milestone predefinita
- [ ] Backend: CRUD template + endpoint "crea progetto da template"
- [ ] Frontend: selezione template nel modal creazione progetto
- [ ] Frontend: libreria template con preview
- [ ] Frontend: editor template personalizzabile

### Prompt implementazione
```
Implementa il sistema di Template di Progetto per Bite ERP.

CONTESTO: L'agenzia crea spesso gli stessi tipi di progetto (Social Media Management, SEO, Google Ads, ecc.).
Ogni volta si ricrea da zero la struttura. I template permettono di pre-popolare task, milestones e documenti.
Il sistema progetti esiste già in /api/v1/progetti. I task sono in /api/v1/tasks.

COSA IMPLEMENTARE:

1. BACKEND - Nuove tabelle:
   - progetto_templates: { id, nome, tipo, descrizione, icona, colore, attivo, created_by }
   - progetto_template_tasks: { id, template_id, titolo, descrizione, ordine, stima_ore, 
     dipende_da_task_ordine, categoria }
   - progetto_template_milestones: { id, template_id, nome, giorni_dalla_creazione }

2. BACKEND - Endpoint:
   - GET/POST/PUT/DELETE /api/v1/progetto-templates
   - POST /api/v1/progetto-templates/{id}/applica?progetto_id=X → crea tasks/milestone

3. TEMPLATE PREDEFINITI DA INSERIRE IN SEED:
   - Social Media Management: Onboarding, Piano editoriale, Setup strumenti, Kick-off call, 
     Creazione contenuti settimana 1-4, Report mensile
   - Google Ads: Audit account, Definizione obiettivi, Setup campagne, Ottimizzazione week 1, 
     Report performance, Scaling
   - SEO: Audit tecnico, Keyword research, Ottimizzazione on-page, Strategia contenuti, 
     Link building, Report ranking
   - Identità Visiva: Brief, Moodboard, Logo concepts (x3), Revisioni, File finali, Manuale brand
   - Sito Web: Discovery, Wireframe, Design, Sviluppo, Test, Launch, Handoff

4. FRONTEND - Modale selezione template in ProgettoDialog:
   - Step 1: scegli template (grid di card con icona, nome, descrizione, N° task inclusi)
   - Step 2: compila i dati del progetto (nome, cliente, date)
   - Step 3: preview dei task che verranno creati (modificabili prima di confermare)
   - Opzione "Senza template - progetto vuoto"

5. FRONTEND - Pagina /admin/template:
   - Lista template con possibilità di edit
   - Editor visuale: aggiungi/rimuovi/riordina task e milestone
   - Anteprima della timeline

Il design segue il sistema esistente. Dark mode, rounded-3xl, primary purple.
```

---

## 🟡 PRIORITÀ 6 — Brief Digitale Cliente

### Cosa fa
Form strutturato e professionale per raccogliere il brief dal cliente prima di iniziare un progetto.
Il PM compila il brief insieme al cliente, viene salvato nel gestionale e collegato a progetto/commessa.
Include: obiettivi, target audience, tono di voce, competitor, deliverable, scadenze, budget.

### Task tecnici
- [ ] DB: tabella `briefs` con tutti i campi necessari
- [ ] Backend: CRUD brief + link a progetto
- [ ] Frontend: form multi-step professionale
- [ ] Frontend: vista PDF del brief compilato
- [ ] Frontend: accesso dal progetto e dalla commessa

### Prompt implementazione
```
Implementa il sistema di Brief Digitale Cliente per Bite ERP.

CONTESTO: Ogni nuovo progetto inizia con un brief del cliente. Oggi questo avviene via email/Notion.
Vogliamo un form strutturato integrato nel gestionale che salva tutto e genera un PDF professionale.

SEZIONI DEL BRIEF:
1. Informazioni generali (nome progetto, cliente, PM, data)
2. Obiettivi (obiettivi principali, KPI, metriche di successo)
3. Target audience (demografica, interessi, pain points, persona)
4. Brand (tono di voce, valori, cosa NON fare, brand esistente sì/no)
5. Competitor (min 3 competitor con note)
6. Deliverable (lista output richiesti con scadenze)
7. Budget e vincoli (budget indicativo, vincoli tecnici, strumenti richiesti)
8. Note aggiuntive

COSA IMPLEMENTARE:

1. BACKEND - Nuova tabella `briefs`:
   { id, progetto_id, commessa_id, stato (BOZZA|COMPLETATO|APPROVATO),
     nome_progetto, obiettivi (text), kpi (text), target_demo (text),
     target_interessi (text), target_pains (text), tono_voce (text),
     valori_brand (text), cosa_non_fare (text), competitor (jsonb),
     deliverable (jsonb), budget_indicativo, vincoli (text), note (text),
     compilato_da, created_at, updated_at }

2. BACKEND - Endpoint:
   - GET/POST/PUT /api/v1/briefs
   - GET /api/v1/briefs?progetto_id=X
   - PUT /api/v1/briefs/{id}/approva

3. FRONTEND - Form multi-step /briefs/nuovo o modal:
   - Progress bar con gli 8 step
   - Ogni step con i campi specifici
   - Salvataggio automatico in bozza ad ogni step
   - Navigazione avanti/indietro
   - Preview finale prima di confermare

4. FRONTEND - BriefPDF (componente react-pdf):
   - PDF professionale con logo Bite Digital
   - Tutte le sezioni del brief formattate
   - Export dal pulsante in BriefDetail

5. FRONTEND - Integrazione:
   - Tab "Brief" in ProgettoDetail
   - Link "Crea Brief" in CommessaDetail
   - Badge "Brief compilato/mancante" nella lista progetti

Il design segue il sistema esistente. Usa react-pdf già installato per il PDF.
Dark mode, rounded-3xl, primary purple.
```

---

## 🟢 PRIORITÀ 7 — Client Portal (Read-Only)

### Cosa fa
Pagina accessibile via link condivisibile (senza login completo) dove il cliente può vedere:
- Avanzamento dei propri task/deliverable
- Contenuti in attesa di approvazione
- Report performance mensile
- Fatture e pagamenti

### Prompt implementazione
```
Implementa il Client Portal read-only per Bite ERP.

CONTESTO: I clienti dell'agenzia vogliono visibilità sui loro progetti senza dover chiamare.
Vogliamo una pagina accessibile tramite link con token univoco (no login) che mostra solo i dati
del cliente specifico in modalità sola lettura.

COSA IMPLEMENTARE:

1. BACKEND:
   - Tabella `client_portal_tokens`: { id, cliente_id, token (uuid), attivo, scadenza, created_at }
   - POST /api/v1/portal/genera-token?cliente_id=X → genera link condivisibile
   - GET /api/v1/portal/{token}/overview → ritorna: progetti attivi, task in corso, 
     contenuti da approvare, ultime fatture, prossime scadenze
   - GET /api/v1/portal/{token}/contenuti → contenuti in stato INVIATO_AL_CLIENTE
   - PUT /api/v1/portal/{token}/contenuti/{id}/approva → cliente approva contenuto (no auth)
   - PUT /api/v1/portal/{token}/contenuti/{id}/richiedi-modifiche → con nota

2. FRONTEND - Nuova route /portal/:token (fuori dal layout principale, no sidebar):
   - Design pulito e professionale con logo Bite Digital
   - Header con nome cliente e logo
   - Sezione "I tuoi progetti" con avanzamento %
   - Sezione "Contenuti da approvare" con preview e pulsanti Approva/Richiedi modifiche
   - Sezione "Scadenze prossime"
   - Sezione "Ultime fatture"
   - NO dati finanziari interni (no margini, no costi)

3. FRONTEND - Generazione link in ClienteDetail:
   - Pulsante "Genera link cliente"
   - Modal con link copiabile e QR code
   - Toggle per attivare/disattivare il portal
   - Impostazione scadenza link (30/60/90 giorni o illimitato)

Attenzione alla sicurezza: il token deve essere UUID v4, validare sempre che il token esista e sia attivo.
NON esporre dati sensibili (costi, margini, dati altri clienti).
Dark mode, design minimal e professionale per i clienti.
```

---

## 🟢 PRIORITÀ 8 — Onboarding Cliente Automatico

### Cosa fa
Quando si crea un nuovo cliente, si avvia automaticamente una checklist di onboarding:
- Creazione cartella documenti
- Canale chat dedicato
- Invio email di benvenuto
- Task assegnati al PM per i primi step

### Prompt implementazione
```
Implementa l'Onboarding Automatico Cliente per Bite ERP.

CONTESTO: Ogni nuovo cliente richiede 1-2 ore di setup: creare cartelle, canali chat, inviare email,
assegnare task al team. Vogliamo automatizzare tutto questo al momento della creazione del cliente.

COSA IMPLEMENTARE:

1. BACKEND - Trigger onboarding su POST /api/v1/clienti:
   Quando si crea un nuovo cliente, esegui automaticamente:
   a) Crea canale chat dedicato "{nome_cliente}" con PM e ADMIN come membri
   b) Crea task onboarding assegnati al PM:
      - "Kick-off call con {cliente}" (scadenza +3 giorni)
      - "Setup strumenti e accessi" (scadenza +5 giorni)
      - "Invio questionario brand" (scadenza +7 giorni)
      - "Prima pianificazione editoriale" (scadenza +14 giorni)
   c) Crea notifica per tutti gli ADMIN: "Nuovo cliente aggiunto: {nome}"
   d) Crea voce in audit_log: "onboarding_avviato"

2. BACKEND - Checklist onboarding:
   - Tabella `onboarding_steps`: { id, cliente_id, step, completato, completato_da, completato_at }
   - Steps standard: briefing_ricevuto, accessi_ottenuti, strumenti_configurati, 
     kick_off_completato, primo_contenuto_approvato
   - GET /api/v1/clienti/{id}/onboarding → stato checklist
   - PUT /api/v1/clienti/{id}/onboarding/{step}/completa

3. FRONTEND - Widget onboarding in ClienteDetail:
   - Card "Onboarding" con checklist progress (N/5 step completati)
   - Progress bar colorata
   - Ogni step con checkbox, chi l'ha completato, quando
   - Badge "Onboarding completato" sul cliente quando finito

4. FRONTEND - Modal al salvataggio nuovo cliente:
   - Dopo la creazione mostra: "Cliente creato! Ecco cosa è stato fatto automaticamente:"
   - Lista: canale chat creato ✅, task assegnati ✅, team notificato ✅
   - Link "Vai al profilo cliente"

Dark mode, design del sistema esistente. NON modificare la struttura auth esistente.
```

---

## Come usare questo file

Quando vuoi implementare una feature, di' a Claude Code:

> "Implementa la PRIORITÀ X dal file ROADMAP.md"

Claude leggerà il prompt specifico e avrà tutto il contesto necessario per implementarla correttamente.

**Ordine consigliato:**
1. Alert Marginalità (impatto immediato sui profitti)
2. Forecast Ricavi (visibilità strategica)
3. Recurring Tasks (risparmio tempo operativo)
4. Template Progetto (efficienza onboarding)
5. Brief Digitale (professionalità cliente)
6. Approvazione Contenuti (flusso produzione)
7. Onboarding Cliente (automazione admin)
8. Client Portal (relazione cliente)
