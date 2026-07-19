# Modulo Finanziario Bite ERP — Specifica funzionale per lo sviluppo

**Bite ERP** · documento di handoff per lo sviluppo · uso interno
Livello: **architettura, dati e logica** (cosa, da dove arriva, come si connette e perché). Le scelte implementative (tabelle fisiche, tipi SQL, endpoint, librerie) sono dello sviluppatore.

Documento compagno del file `Bite_ERP_Spec_Modulo_Finanziario.xlsx`, che è il dizionario dati campo-per-campo. Qui c'è la logica; lì il dettaglio tabellare. Dove citato "foglio N", si intende il foglio dell'xlsx.

---

## 0. Come usare questo documento (anche con l'AI)

- Dai a Claude/all'AI **questo documento + l'xlsx + il `CLAUDE.md` del progetto** come contesto prima di iniziare una sezione.
- Lavora **una sezione per volta** (vedi §16, sequenza). Non costruire tutto insieme: stabilizza un pezzo, poi aggiungi.
- Le **Invarianti (§15)** sono vincoli espliciti da non far reinterpretare all'AI.
- Dove il documento dice **"da confermare"** o **"da verificare"** (soprattutto su FIC), chiedi all'AI di **segnalare apertamente dove sta assumendo**, non di inventare campi o endpoint.
- Regola di sicurezza: **nessun token o segreto (FIC, ClickUp) va incollato in chat o committato**; usare variabili d'ambiente.

---

## 1. Principi architetturali (vincolanti)

Questi nove principi governano tutto il modulo. Violazione = bug architetturale.

1. **Dati a tre livelli, non sezioni-silo.** Le sezioni dell'interfaccia (Tesoreria, Fatturazione, Fiscalità, Conto Economico, KPI) sono **viste** costruite su due tabelle di fatti. Non creano dati propri. Solo le **Dimensioni** e i **Fatti** persistono dati.

2. **Libro movimenti unico.** Movimenti bancari, prima nota, fatture, F24, ricorrenze alimentano **tutti la stessa tabella `movimenti`**. Nessun registro parallelo.

3. **Doppia data su ogni movimento.** Ogni movimento ha `data_competenza` (alimenta il Conto Economico) **e** `data_cassa` (alimenta la Tesoreria). È la chiave per avere CE e cassa dalla stessa fonte.

4. **Fonte unica di verità sul margine.** Il margine si calcola **una volta** a livello di progetto/commessa; il CE gestionale e i KPI sono **roll-up** di quel dato. Vietato ricalcolare il margine con logiche diverse.

5. **Confine FIC: leggere/registrare, non ricalcolare.** Fatture, anagrafiche fiscali e IVA arrivano da Fatture in Cloud in **sola lettura**. L'ERP le registra per cassa/CE ma **non** rifà la liquidazione fiscale.

6. **Confine commercialista.** IVA e imposte sono **registrate** a fini previsionali di cassa. La verità del calcolo fiscale resta il commercialista (e, dove disponibili, i campi che FIC già fornisce).

7. **Audit e permessi.** Ogni inserimento manuale (prima nota su tutti) registra `created_by` + `created_at` + log modifiche. Ruoli: chi può inserire / approvare / leggere.

8. **Attributo fisso/variabile.** Ogni categoria contabile è taggata fisso vs variabile: requisito per BEP, costi fissi e margine di contribuzione.

9. **Collaboratori a fattura: costo una volta sola.** Un collaboratore che fattura è **Risorsa + Fornitore collegati** (`risorsa_id`). La fattura passiva è il costo reale (cassa + CE); il timesheet è **solo driver di allocazione** sulle commesse. Mai sommare i due come costo.

### 1.1 Le quattro provenienze dei dati

Ogni campo del modello ha una e una sola provenienza, da marcare esplicitamente ovunque:

- **FIC** — da Fatture in Cloud, **sola lettura**.
- **Banca** — da import estratto conto (CBI/CSV).
- **ERP / Utente** — inserito o gestito dal modulo.
- **Calcolato** — derivato da una formula su altri dati (non si archivia come input).

---

## 2. Glossario

- **Progetto** — la singola attività erogata a un cliente (un Social, un Sito, una Gestione, ecc.). Unità operativa con un accordo economico.
- **Commessa** — istanza **periodica** di fatturazione/gestione che aggrega uno o più progetti dello stesso cliente con la stessa periodicità. È l'unità su cui si misura la marginalità.
- **Movimento** — una riga del libro unico: un fatto economico-finanziario con doppia data (competenza/cassa).
- **Scadenza** — un incasso atteso o un pagamento dovuto, con la sua data. Origine: fattura FIC o ricorrente interno.
- **Riconciliazione (bancaria)** — collegamento dichiarato tra un movimento bancario reale e la sua origine (scadenza/fattura). Tabella E.
- **Riconciliazione (fattura→commessa)** — allocazione manuale dell'importo di una fattura alle commesse del cliente. Tabella F.
- **Sentinella** — differenza tra saldo banca e saldo gestionale di un conto. Se ≠ 0, c'è qualcosa di non riconciliato o non importato.
- **MdC** — Margine di Contribuzione = Ricavi − Costi diretti.
- **OVH** — Overhead, costi di struttura (indiretti). Attribuiti alle commesse tramite un **coefficiente rolling** (§4.5), non a chiusura una-tantum.
- **Coefficiente OVH (rolling)** — tasso di assorbimento dell'overhead ricalcolato a ogni chiusura mensile dal forecast: `overhead struttura previsto (rolling 12m avanti) ÷ base ricavi prevista (rolling 12m avanti)`. Forward-looking, così segue la crescita invece di rincorrerla (§4.5, §13.2).
- **Varianza di assorbimento (OVH)** — scarto tra overhead caricato sulle commesse (al coefficiente) e overhead reale del periodo. Resta a livello aziendale (sotto/sovra-assorbimento), non si spalma sulle commesse; è anche un segnale struttura-vs-delivery (§4.5, §8).
- **Chiusura di periodo (lock competenza)** — congelamento mensile dei movimenti per `data_competenza`: rende stabile l'Actual YTD e misurabile la forecast accuracy. Riguarda la competenza, non la cassa (§13.6).
- **Scrittura di rettifica** — correzione di un fatto economico di un mese già chiuso, registrata nel periodo aperto (non modificando il mese chiuso), per preservare l'audit trail (§13.6).
- **Previsione di cassa 12m** — proiezione mensile del saldo di cassa a 12 mesi (stesso motore della curva 90gg, orizzonte parametrico), per anticipare i cluster fiscali (giugno/novembre, IVA). Calcolata, non archiviata; a bande certo/previsto (§9).
- **Aliquota IRPEF prudente (cassa)** — aliquota marginale usata per stimare l'IRPEF dei soci nella previsione di cassa (default 43% + addizionali, override per-socio); distinta dalla stima minima usata nel reporting (§10.4).
- **Riconoscimento lineare (Siti)** — ricavo di competenza dei progetti a prezzo fisso multi-mese spalmato in quota uguale sui mesi di durata; la cassa segue le milestone (doppia data, §4.4).
- **Ripartizione temporale del costo (risconto gestionale)** — un costo pluri-mensile/annuale o una-tantum spalmato in quota uguale su N mesi di competenza (`ripartizione_competenza_mesi`), con la cassa che resta l'uscita reale. Gemello lato costo del riconoscimento lineare; **non** è ammortamento contabile (§5.1, §8).
- **Parametro (di sistema)** — impostazione di configurazione (periodicità IVA, aliquote, soglie, default) gestita nel registro centralizzato `parametri`, non nel codice né nelle viste (§19).
- **Validità temporale (`valido_da`)** — data di decorrenza di un parametro: periodi chiusi e snapshot usano il valore in vigore alla loro data, non quello corrente (§19).
- **DSO** — due accezioni distinte, con nomi distinti: **`dso_comportamentale`** (per cliente, giorni medi data fattura→incasso, comportamentale, alimenta la previsione, §4.1) e **`dso_aziendale`** (KPI aggregato di bilancio: crediti aperti ÷ fatturato × giorni, §12).
- **Esclusioni** — movimenti che non sono cassa operativa (giroconti, partite di giro soci, pass-through Italfer): fuori da saldi e margini.
- **Trasparenza fiscale** — regime delle società di persone (Bite è SAS): il reddito d'impresa è imputato ai soci pro-quota e tassato in capo a loro con IRPEF; la società non sconta IRES (§10.0).
- **Sostituto d'imposta** — Bite trattiene le ritenute sui compensi e le versa all'erario/INPS con F24 (§10.2).
- **IVA per cassa** — l'IVA diventa esigibile/detraibile al momento dell'incasso/pagamento, non dell'emissione; liquidazione reale dai movimenti riconciliati (§10.1).
- **VPN** — Valore della Produzione Netto, base imponibile IRAP, derivato dal CE con rettifiche fiscali (§10.3).
- **Budget** — piano economico ex-ante per voce di CE × mese (competenza), congelato a approvazione (§13.0).
- **Actual (consuntivo)** — ciò che è successo: Σ movimenti per data_competenza (§13.0).
- **Forecast** — aspettativa aggiornata di atterraggio = Actual YTD + ri-previsione dei mesi residui; **rolling**, ricalcolato a ogni chiusura mese (§13.0). Da non confondere con la previsione di cassa (§9, su data_cassa).
- **Scostamento** — Actual − Budget (come vado) e Forecast − Budget (dove atterro) (§13.0).
- **Preventivo** — scomposizione ex-ante del prezzo di un lavoro, letta in due direzioni: cost-up (markup, vista cliente) e price-down (allocazione interna). Gemello ex-ante della commessa (§18).
- **Markup / Margine** — markup = ricarico sul costo (`prezzo/costo − 1`); margine = utile sul prezzo (`utile/prezzo`). Non sono la stessa cosa (§18.1).
- **Budget interno (residuo)** — `Prezzo − esterni − costo soci − OVH − margine`, la quota di prezzo distribuibile in ore alle risorse interne (§18.3).
- **Peso di riparto (socio)** — chiave con cui la quota progettuale del socio si distribuisce sui progetti attivi, in alternativa alla divisione equa: a cascata override % mensile → ore-preventivo → intensità S/M/L (§4.6).
- **Costo-socio standard (roadmap v2)** — evoluzione in cui il costo del socio su un progetto = sforzo × tariffa standard, con lo scarto vs compenso a sotto/sovra-assorbimento di struttura; elimina la diluizione da portafoglio (§4.6, §18).

---

## 3. Architettura dati: i tre livelli

**Livello 1 — Dimensioni (anagrafiche):** Clienti, Fornitori, Conti, Progetti, Commesse, Centri di costo, Categorie, Risorse, Finanziamenti, **Parametri (§19)**. (§4)

**Livello 2 — Fatti:** due tabelle centrali (`movimenti`, `scadenze`) + una di supporto (`ricorrenze`) + tre tabelle ponte (`progetto_commessa`, `riconciliazione`, `fattura_commessa`). (§5–7)

**Livello 3 — Viste:** Tesoreria, Conto Economico, KPI, Budget, pagine di dettaglio. Sono query/aggregazioni sui Fatti. (§8–13)

Regola d'oro: se un numero compare in due viste diverse, deve derivare **dalla stessa riga di fatto**. Non si ricalcola in due posti.

---

## 4. Le Dimensioni (anagrafiche)

Per ogni entità: cosa contiene, cosa arriva da FIC, cosa inseriamo noi, e la logica. Il dettaglio campo-per-campo è nel foglio 1 dell'xlsx; entità polimorfiche nei fogli 6 e 8.

### 4.1 Clienti

**Da FIC (sola lettura):** denominazione, codice_interno (chiave di mapping FIC), indirizzo/città/CAP/provincia/indirizzo_extra/paese, email, referente, telefono, P.IVA/TAX ID, codice_fiscale, note_extra, email_pec, codice_SDI.

**Inseriti/gestiti da noi (ERP):**
- `termini_pagamento` (gg) — default **30**. Base per generare le scadenze attese.
- `condizioni_pagamento` — enum: **fattura anticipata / fattura posticipata / Ri.Ba**. Attenzione: la Ri.Ba ha meccanica di cassa diversa (anticipo SBF, scadenza dell'effetto): la generazione delle scadenze deve trattare le tre condizioni con regole distinte, non come semplice etichetta.
- `stato` — attivo / sospeso / chiuso.

**Calcolato:**
- `dso_comportamentale` (gg) — giorni medi **da data fattura a data incasso** del cliente. Regole obbligatorie: finestra **rolling 12 mesi**; **campione minimo** (es. ≥5 fatture incassate) sotto il quale si usa il **DSO medio aziendale**; ricalcolo periodico (job schedulato). Senza queste tre regole il dato è fuorviante.

**Logica/connessioni:** `termini_pagamento` + `condizioni_pagamento` generano le scadenze attive; `dso_comportamentale` corregge le date in previsione (vedi §6.1 Fatture attive e §9 Tesoreria).

### 4.2 Fornitori

**Da FIC (sola lettura):** denominazione, codice_interno, indirizzo e blocco geografico, email, referente, telefono, P.IVA, codice_fiscale, note_extra, email_pec, IBAN.

**Inseriti da noi (ERP):**
- `regime_fiscale` — forfettario / semplificato / ordinario. **Importante:** determina l'IVA detraibile e la ritenuta, **non** la deducibilità del costo (che dipende dall'inerenza ed è fornita da FIC per fattura).
- `soggetto_ritenuta` (bool) + `aliquota_ritenuta` (%) — per professionisti ordinari/semplificati: Bite è sostituto d'imposta → F24 ritenute + Certificazione Unica annuale.
- `is_collaboratore` (bool) + `risorsa_id` (FK Risorse) — collega il fornitore alla scheda Risorsa quando è un collaboratore interno che fattura. Attiva il **principio 9**.
- `ricorrente` (bool) — fornitore di costi ricorrenti.

**Logica:** il forfettario non espone IVA (niente credito IVA); l'ordinario/semplificato sì. La ritenuta genera una seconda uscita (F24) oltre al pagamento al fornitore (vedi §6.2).

### 4.3 Conti (Banche)

**Solo conti bancari** (Intesa, Credem) — niente Stripe/PayPal, niente PSD2 (decisione confermata).

**Inseriti da noi (ERP):** nome, tipo (c/c bancario / carta credito / conto deposito / cassa contanti), istituto, IBAN, BIC, intestatario, valuta (default EUR), `saldo_iniziale` + `data_saldo_iniziale` (inizializzazione da definire col commercialista), `fido_accordato`, `tipo_fido` (scoperto c/c / anticipo fatture SBF / nessuno — SBF rilevante per le Ri.Ba), `modalita_import` (CBI / CSV / manuale), `in_riconciliazione` (bool), attivo.

**Calcolato / da Banca:**
- `saldo_banca` (Banca) — saldo di chiusura dall'ultimo e/c importato.
- `saldo_gestionale` (Calcolato) — saldo iniziale + movimenti.
- `sentinella` (Calcolato) — `saldo_banca − saldo_gestionale`. Se ≠ 0, c'è qualcosa di non riconciliato/importato. A riconciliazione completa = 0.

### 4.4 Progetti

Entità **polimorfica**: il campo `tipo` cambia i campi disponibili e il modo in cui il progetto genera scadenze. Dettaglio nel foglio 6.

**Campi base (tutti i tipi):**
- `id_progetto` (progressivo, es. 001), `cliente_id` (FK, dropdown alfabetico), `nome_progetto` (manuale), `stato` (onboarding / attivo / sospeso / chiuso).
- `project_manager_id` (FK Risorse, filtrato per tag **Project Manager**).
- `tipo` — Social Media / Creazione Sito Web / Gestione Web / Produzione contenuti / Stand fieristici.
- `accordo_economico` (€) — **ricavo del progetto, obbligatorio per tutti i tipi**. È la fonte unica per la marginalità. Può essere inserito a mano **oppure originato da un preventivo accettato** (§18): in quel caso arriva dal Preventivatore insieme al budget-ore pianificato.
- `risorse_assegnate[]` — relazione N:N: il team del progetto, N risorse ciascuna con ruolo/tag (assorbe i campi singoli per tipo: videomaker, web developer, operatore).
- `commesse[]` — relazione N:N: un progetto può stare in **più commesse** (tabella ponte `progetto_commessa`).
- `data_inizio` / `data_fine`.
- `intensita_socio` — peso strutturale di intensità del progetto (**S / M / L**, default M), usato come **chiave di riparto** della quota progettuale soci quando manca il dato da preventivo (§4.6). Editabile.

**Campi condizionali per tipo** (foglio 6, parte A):
- **Social Media:** n_contenuti_previsti, di_cui_video (opz.), videomaker (tag Video), periodicità.
- **Creazione Sito Web:** web_developer (tag Web), n_rate; ogni rata ha `percentuale` (Σ = 100%) e `milestone` di emissione. Default 3 rate: **1 = accordo siglato, 2 = approvazione layout, 3 = messa online**.
- **Gestione Web:** periodicità (mensile/bimestrale/.../annuale), web_developer (tag Web).
- **Produzione contenuti:** tipo_contenuto (Video/grafiche/foto), operatore (tag Produzione contenuti), periodicità (incl. Spot / Una tantum).
- **Stand fieristici:** fiera, data_consegna, partner.

**Modello di fatturazione per tipo** (foglio 6, parte B) — è la connessione progetto→scadenze:
- Social / Gestione Web → **ricorrente**: 1 scadenza per periodo (accordo × periodicità) tramite `ricorrenze`.
- Creazione Sito Web → **a rate/milestone**: N scadenze = n_rate, importo = accordo × % rata, scatenate dalle milestone. **Riconoscimento a CE (competenza):** quota **lineare** `accordo ÷ mesi di durata`; la **fatturazione/incasso resta a milestone** (doppia data: competenza liscia, cassa a gradini).
- Produzione contenuti → ricorrente o una tantum secondo periodicità.
- Stand fieristici → una tantum, tipicamente a `data_consegna`.

### 4.5 Commesse

Istanza **periodica** che aggrega progetti dello stesso cliente con la stessa periodicità. Dettaglio gestionale nel foglio 10.

**Campi:** `id_commessa`, `cliente_id` (una commessa = un cliente), `nome_commessa` (es. "Health City — Marzo 2026"), `progetti_inclusi` (N:N, dropdown filtrato per cliente, stessa periodicità; selezione manuale con suggerimento automatico = **ibrida**), `periodicita` (derivata dai progetti), `stato` (aperta / chiusa).

**Generazione date (regole esatte, foglio 10A):**
- `data_inizio` — giorno successivo alla `data_fine` dell'ultima commessa dello stesso cliente+periodicità. **Modificabile** manualmente.
- `data_fine` — `(data_inizio + periodicità) − 1 giorno`, aritmetica **calendar-aware**. La regola unica copre entrambi i casi: chi inizia il 1° finisce all'ultimo giorno del mese; chi inizia il 15 finisce il 14 del mese successivo (es. 01/03→31/03, 15/03→14/04, 01/02→28/02).
- `competenza` — il **mese in cui cade `data_fine`** (mese di conclusione). **Nessun pro-rata** tra i due mesi (semplificazione confermata: es. 15/03–14/04 → competenza Aprile). *Nota (artefatto di rilevazione):* per le ricorrenti che sfasano dal mese solare il margine del singolo mese oscilla per pura collocazione e **netta sui mesi adiacenti** — **non leggere la varianza mensile come performance**. Scelta di semplicità confermata: si documenta invece di correggere.

**Marginalità della commessa (foglio 10B/C):**
- **Ricavi** = a **commessa aperta**, Σ `accordo_economico` dei progetti inclusi (ricavo **atteso**); a **commessa chiusa**, Σ fatturato allocato dalle fatture (ricavo **reale**, Tabella F, §7). Lo scarto atteso vs fatturato segnala sotto/mancata fatturazione. Per i **progetti a prezzo fisso multi-mese (Siti)** il ricavo di **competenza** è riconosciuto in **quota lineare** sui mesi di durata (le milestone restano la **cassa**).
- **Costi diretti:**
  - *Manodopera diretta* = M.O. interna allocata (dipendenti via timesheet + quota progettuale soci, **riparto pesato** sui progetti attivi nel periodo, non equo) — vedi §4.6.
  - *Costi vivi* = costi esterni e compensi collaboratori, da fatture passive imputate alla commessa.
- **= Margine di Contribuzione (MdC).**
- **A commessa chiusa:** si attribuisce l'**OVH** (costi di struttura) → **Margine netto di commessa**.
  - **Coefficiente rolling (non congelato):** l'OVH si carica alla commessa come `coefficiente × base`, con **coefficiente = overhead di struttura previsto ÷ base prevista sui 12 mesi avanti (rolling)**, **ricalcolato a ogni chiusura mensile** dal forecast (§13.2). Forward-looking: segue la crescita invece di rincorrerla. Un *rapporto* resta stabile anche mentre i valori assoluti crescono; si muove solo se cambia il mix struttura/delivery — quando serve.
  - **Base di ripartizione: i ricavi** (accordo a commessa aperta, fatturato allocato a chiusura). Deterministica, non circolare (a differenza del MdC) e neutra sul margine. *Upgrade stadiato (v2):* si passa al **costo del lavoro diretto** (dipendenti allocati + quota socio pesata) quando la base-lavoro sarà consolidata — più causale, stessa struttura.
  - **Normal costing:** le commesse sono sempre caricate al coefficiente (stimato mentre aperte, confermato sulla base reale a chiusura). Lo **scarto vs overhead reale** del periodo **non entra nelle commesse**: resta come **varianza di assorbimento a livello aziendale** (come le assenze extra dei dipendenti, §4.6), che tiene le commesse comparabili e segnala se la struttura corre avanti o indietro rispetto alla delivery.
  - **Guardrail (storico giovane):** finché il forecast è immaturo, ancorare numeratore e denominatore alle parti deterministiche (ricorrenti attivi, struttura da `ricorrenze`/payroll) e mettere un **tetto allo scostamento del coefficiente** tra due refresh, per non far oscillare i margini.

### 4.6 Risorse interne

Entità **polimorfica** per `tipologia`. Dettaglio nel foglio 8.

**Campi base:** `cognome`, `nome`, `tipologia` (socio / dipendente / collaboratore), `tag[]` (multi-valore, **vocabolario centralizzato** — no testo libero — alimenta i picker dei progetti), `stato`, `costo_orario` (calcolato, vedi sotto).

**Se Dipendente:** data_assunzione, tipo_contratto, livello_contrattuale, data_fine_contratto, RAL, **costo_aziendale_annuo**, ore_settimanali, giorni_ferie_annui, ore_rol_annue.
- **Costo orario** = `costo_aziendale_annuo ÷ ore nette annue`, dove ore nette = (settimane × ore) − ferie − ROL − festività. Si usa il **costo aziendale**, non la RAL.
- Le **assenze extra non cambiano la tariffa**: diventano **sotto-assorbimento** a carico della struttura. Altrimenti il costo orario fluttuerebbe a posteriori e la marginalità di commessa sarebbe instabile.
- I dipendenti **segnano le ore** (timesheet) → la M.O. diretta sulle commesse arriva da lì. **Fonte:** inserimento **manuale** o da **attività/task** (dipendenza chiusa).

**Se Collaboratore:** partita_iva, cf, data_inizio, e una **sotto-tabella `compensi[]` (1:N)**: tipo (Forfait mensile / Orario / Progetto / Attività / Variabile), attività, importo, quantità, frequenza.
- I `compensi` servono a **programmare e prevedere** il costo (generano scadenze passive attese). Il **costo reale** è la **fattura** (principio 9). Mai sommare compenso e fattura come costo.
- Se fattura, il collaboratore è anche **Fornitore** (link `risorsa_id` ↔ `is_collaboratore`).

**Se Socio:** tipologia_socio (Accomandante / Accomandatario), data_ingresso, quota_pct, `compenso`, `progetti_assegnati` (vista inversa di `risorse_assegnate`), e una **sotto-tabella `ripartizione[]`** auto-dichiarata con **Σ = 100%**: amministrativa_pct, commerciale_pct, progettuale_pct.
- I soci **non segnano le ore**; la ripartizione è la base di riparto.
- **Allocazione del costo socio:** `compenso × amministrativa_pct` e `× commerciale_pct` → **costo di struttura** (overhead). `compenso × progettuale_pct` = **pool progettuale** (il totale imputato alle commesse resta pari alla quota progettuale: nessun doppio conteggio), **ripartito sui progetti attivi nel periodo in proporzione a un peso `w`**, non più in parti uguali:
  - `quota_progetto_i = pool × (w_i / Σ w_attivi)`.
  - **Peso `w` a cascata** (vince la prima fonte disponibile): 1) **override % mensile** dichiarato dal socio (Σ = 100% sui progetti attivi), **opzionale e off di default** (valvola per i mesi anomali) — è lo stesso gesto della ripartizione admin/comm, un livello più giù; 2) **ore-socio pianificate a preventivo** (§18), se il progetto nasce da un preventivo; 3) **`intensita_socio`** S/M/L del progetto (default M). Peso e ore stanno sulla **stessa scala** (sforzo-socio atteso nel periodo): le ore-socio del preventivo si usano alla risoluzione piena (normalizzate a base mensile se il progetto dura più mesi), S/M/L è il fallback in **rapporto 1:2:4** (≈ 4/8/16 h-socio/mese, default M).
  - **Flag `attivo_nel_periodo`** (per socio × progetto × mese): i progetti fermi non entrano nel denominatore, così non diluiscono gli altri.
  - **Equal-split = caso degenere:** a pesi tutti uguali o assenti si ricade nella ripartizione equa di prima (retro-compatibile, si parte senza dati nuovi). Es.: €1.500 × 40% = €600; su 3 progetti attivi con pesi M/M/L (2/2/3) → €600 × 2/7, 2/7, 3/7 ≈ €171 / €171 / €257 (contro €200 ciascuno dell'equal-split).
- **Limite residuo (v1):** il riparto pesato corregge la *mis-allocazione relativa* tra progetti, ma il pool resta fisso (`compenso × progettuale_pct`) e diviso sui progetti attivi → il costo-socio per progetto **scende ancora** al crescere del portafoglio (diluizione). La chiusura di questo secondo effetto è **stadiata a v2** (roadmap): costo-socio = `sforzo × tariffa standard`, con lo scarto vs compenso a **sotto/sovra-assorbimento di struttura** (come le assenze extra dei dipendenti), il che elimina la diluizione e unifica il costo col pricing (§18). La chiave-peso scelta qui è già l'input della v2.

### 4.7 Centri di costo

**Aree funzionali**, set minimo, **non** un centro per cliente/progetto (quelli sono la commessa).
- Set proposto: **Produzione/Delivery, Commerciale/BD, Amministrazione, Direzione/Struttura.**
- `tipo`: **produttivo** (allocabile a commessa) / **struttura** (overhead).
- `mappa_ripartizione_socio`: Progettuale→Produzione, Commerciale→Commerciale, Amministrativa→Amministrazione (coerenza con §4.6).
- Consiglio: definire un **centro di costo di default per categoria** (es. SaaS→Produzione, commercialista→Amministrazione), così l'imputazione è automatica.

### 4.8 Categorie contabili gestionali (Piano dei conti)

Schema nel foglio 1; piano dei conti di partenza e struttura CE nel foglio 9.

**Campi:** codice (gerarchico, es. R01/C03/S02), nome, `categoria_padre_id` (raggruppamento per il CE), `tipo_flusso` (ricavo/costo), `natura` (**fisso/variabile** — per il BEP), `relazione_commessa` (**diretto/indiretto** — per il margine), `voce_ce` (mappatura alla voce di CE a scalare), `detraibilita_iva_pct` e `deducibilita_pct` (**solo fallback**: il dato reale arriva da FIC per fattura, §6.2), attiva.

**Due dimensioni indipendenti sui costi:** `natura` (fisso/variabile) serve al BEP; `relazione_commessa` (diretto/indiretto) costruisce il margine di commessa. Sono ortogonali.

### 4.9 Finanziamenti / Linee di credito

Bite ha del debito → si tiene questa dimensione. Il **piano di ammortamento e la PFN** stanno fuori dallo scope del modulo Tesoreria (vivono lato CE/PFN); ma le **rate di rimborso sono cassa a tutti gli effetti** ed entrano nella previsione (90gg e 12m) come scadenze passive ricorrenti. *Fuori scope ≠ fuori dalla cassa.*
**Campi:** tipo (fido / mutuo / leasing / prestito), istituto, importo_originario, rata/periodicità, debito_residuo (→ PFN), scadenza_finale.

---

## 5. I Fatti (le tabelle che persistono i dati)

Schema completo nel foglio 2.

### 5.1 `movimenti` — il libro unico

Una riga per fatto. Campi chiave:
- `data_competenza` (per il CE), `data_cassa` (per la Tesoreria; null se previsto/non regolato).
- `importo`, `segno` (entrata/uscita), `stato` (previsto / contabilizzato / regolato / riconciliato), `stato_riconc` (da riconciliare / parziale / riconciliato).
- FK: `conto_id`, `categoria_id`, `progetto_id` (**imputazione analitica primaria**), `commessa_id` (raggruppamento), `centro_costo_id`, `controparte_tipo` + `controparte_id`.
- `origine` — banca_cbi / banca_csv / prima_nota / fattura_fic / f24 / ricorrenza / manuale.
- `descrizione_grezza` (Banca, **immutabile** — la prova; invariante 1), `impronta_dedup` (hash conto+data+importo+descrizione, per l'idempotenza; invariante 3), `flag_esclusione` (nessuno / giroconto / partita di giro soci / Italfer; se valorizzato → **fuori da cassa netta e margini**; invariante 4), `categoria_suggerita` (da dizionario pattern, correggibile).
- `imponibile`, `iva_importo` (per IVA per cassa).
- `ripartizione_competenza_mesi` (default 1) — per i **costi pluri-mensili/annuali o una-tantum** da spalmare: se > 1, il CE riconosce `importo ÷ N` per N mesi in **competenza** (risconto **gestionale**), mentre la **cassa resta un'unica uscita** sulla `data_cassa`. È il gemello, lato costo, del riconoscimento lineare dei Siti (§4.5). **Non è ammortamento contabile** (quello lo tiene il commercialista): qui si ripartisce solo il costo gestionale nel tempo.
- `created_by` / `created_at` (audit).
- **Lock di competenza:** un movimento con `data_competenza` in un mese **chiuso** è immutabile; le correzioni entrano come **scrittura di rettifica** nel periodo aperto (§13.6). Il lock non blocca la cassa: la riconciliazione di `data_cassa` resta possibile anche su mesi economicamente chiusi.

### 5.2 `scadenze`

Incassi attesi e pagamenti dovuti. Campi: `tipo` (attiva / passiva / fiscale / contributiva / finanziaria), `data_attesa`, `importo`, `stato` (aperta / parziale / chiusa / scaduta), `controparte_id`, `progetto_id`, `commessa_id`, `categoria_id`, `documento_rif`, `origine` (fic / manuale / ricorrenza / f24 / progetto), `milestone` (per le rate Sito: accordo siglato / approvazione layout / messa online), `movimento_id` (valorizzato alla chiusura).

### 5.3 `ricorrenze`

Template che generano scadenze/movimenti previsti: descrizione, categoria, importo, periodicità, prossima_data, conto, attivo. Definizione separata dalla proiezione (un cambio si propaga in un punto solo).

### 5.4 Tabelle ponte

- **`progetto_commessa` (N:N)** — un progetto può stare in più commesse; porta anche `scadenze_incluse` (quali scadenze confluiscono nel consolidamento fattura della commessa).
- **`riconciliazione` (M:N movimento↔scadenza)** — cuore della Tesoreria: `movimento_id`, `scadenza_id`, `importo_attribuito` (mai > importo movimento; Σ su scadenza ≤ importo scadenza), `tipo` (**S = Saldo** chiude / **A = Acconto** parziale), reversibile, `ritardo_gg` (per incassi: data_cassa − data_attesa → puntualità cliente).
- **`fattura_commessa` (N:N)** — allocazione del valore di una fattura alle commesse: `fattura_id`, `commessa_id`, `importo_allocato`. **Invariante:** Σ allocazioni di una fattura = imponibile (no doppio conteggio).

---

## 6. Fatturazione (FIC) — Attive e Passive

FIC è sola lettura. Dettaglio nei fogli 12 (attive) e 13 (passive). **Gate di mapping (bloccante):** IVA per cassa, deducibilità/detraibilità e margini a valle dipendono da campi FIC ancora marcati "da confermare" (foglio 13). Finché il mapping non è validato (imponibile, IVA, detraibilità/deducibilità, flag SDI, centro costo, categoria), quei numeri non sono affidabili: è una milestone da chiudere prima di dar loro fiducia.

### 6.1 Fatture attive

**Da FIC (teniamo):** Data (emissione), Prox scadenza, Documento (fattura/nota di credito), Numero (progressivo, **si azzera ogni anno → chiave = Numero + anno**), Saldato (informativo), Cliente, Imponibile, IVA, Lordo.
**Scartiamo (ridondanti con anagrafica Cliente o fuori scope):** indirizzo/comune/prov/CAP/paese, P.IVA/CF, Serie (non usata), Valuta orig., Contrassegnato.

**Calcolati/gestiti da noi (ERP):**
- `importo_da_incassare` = **Lordo** (Bite è società: fattura = imponibile + IVA, **nessuna ritenuta** → Lordo = netto da incassare).
- `data_incasso_attesa` = **data fattura + DSO comportamentale cliente** (fallback DSO medio aziendale). Vincolo: il DSO va misurato **da data fattura** (coerenza). Per clienti Ri.Ba o con termini misti, usare la `Prox scadenza` come correttivo.
- `commesse[]` (link manuale N:N) — **riconciliazione fattura→commessa**: l'utente associa la fattura alle commesse del cliente allocando l'importo (Tabella F). Il Centro ricavo di FIC **non si usa**.

**Verità sull'incasso:** la **nostra riconciliazione** bancaria, non il flag "Saldato" di FIC.

### 6.2 Fatture passive

**Da FIC (teniamo):** Data, Prox scadenza, Nr. acquisto (identificativo stabile), Ft elettronica (flag SDI), Data ricezione FE, Centro costo (*da confermare se compilato*), Categoria (input per il mapping verso le categorie gestionali), Fornitore, Imponibile, IVA, Rit. acconto, Rit. prev., **Deducibilità** e **Detraibilità** (forniti da FIC per fattura → si usano questi, non i default di categoria), Descrizione (opz.).
**Scartiamo:** P.IVA/CF e blocco indirizzo (in anagrafica Fornitore), Valuta orig., Contrassegnato.

**Calcolati/gestiti da noi (ERP):** *(FIC non pusha "Lordo" per le passive)*
- `totale_documento` = Imponibile + IVA.
- `importo_da_pagare` = totale − Rit. acconto − Rit. prev. → uscita reale verso il fornitore.
- `ritenute → F24` = Rit. acconto + Rit. prev. → scadenza passiva verso erario/INPS entro il 16 + Certificazione Unica.
- `iva_credito` = IVA × Detraibilità → IVA a credito per la liquidazione.
- `data_pagamento_attesa` = Prox scadenza (± politica): **nostra leva di cassa**, posticipabile.
- `commesse[]` (link manuale N:N) → allocazione **costo vivo** alle commesse (Tabella F). Per i collaboratori vale il principio 9.

**Intersezioni (cosa alimenta cosa):**
- Imponibile → CE gestionale + marginalità (costo pieno; se diretto, costo vivo di commessa).
- IVA × Detraibilità → Fiscalità (IVA per cassa).
- **Deducibilità → solo Imposte previste, NON il CE gestionale.** Il CE gestionale è a **costo pieno**; deducibilità e detraibilità servono al solo calcolo fiscale. Confonderli "droga" il margine.
- Rit. acconto/prev. → F24 (uscita erario/INPS) + CU; riducono il pagato al fornitore.
- Ft elettronica + Data ricezione FE → meccanismo IVA per cassa (solo SDI).
- Centro costo (FIC) → Centri di costo; Categoria (FIC) → suggerisce la categoria gestionale.

**Differenza chiave vs attive:** una passiva con ritenuta genera **due uscite di cassa** (pagamento fornitore + F24 ritenuta), in date diverse: entrambe devono comparire in previsione.

---

## 7. Le due riconciliazioni (da non confondere)

Sono due step distinti, con due tabelle ponte diverse. Nell'interfaccia vanno tenuti separati.

1. **Fattura ↔ Commessa (Tabella F)** — alloca il **valore** della fattura: ricavo (attive) o costo vivo (passive) sulle commesse del cliente. Manuale, N:N. Per i clienti ricorrenti il sistema deve **proporre l'allocazione del mese precedente** da confermare. Bonus: confronto `accordo` (atteso) vs fatturato → segnala sotto/mancata fatturazione.
2. **Incasso/Pagamento bancario ↔ Fattura (Tabella E)** — registra la **cassa**: collega il movimento bancario alla fattura/scadenza. Manuale o proposto, M:N, con S/A, reversibile. È il motore della Tesoreria (§9).

Una fattura può essere allocata alle commesse ma non ancora incassata, o viceversa: i due stati sono indipendenti.

---

## 8. Marginalità e Conto Economico gestionale

Il CE gestionale **non si calcola a parte**: è il **roll-up** della marginalità (principio 4).

**Catena:** Progetto (accordo − costi diretti) → Commessa (MdC, poi − OVH a chiusura) → CE gestionale (Σ commesse + overhead non allocato).

**Struttura CE a scalare** (foglio 9A): Ricavi → **Valore della produzione** → − costi diretti (compensi collaboratori, M.O. interna allocata, costi diretti esterni) → **Margine di contribuzione** → − costi di struttura (personale struttura, affitto, SaaS, commissioni bancarie, commerciale, consulenze, spese generali) → **Margine operativo (EBIT gestionale)** → − oneri finanziari − imposte → **Risultato netto gestionale**.

Il CE gestionale è a **costo pieno**: ignora deducibilità/detraibilità (che sono fiscali).

**Overhead in normal costing:** i costi di struttura entrano nelle commesse come OVH *caricato* al coefficiente rolling (§4.5); a livello di CE la riga − costi di struttura resta però quella **reale**. La differenza tra overhead caricato e reale è la **varianza di assorbimento**, esposta come riga aziendale a sé: così il totale del CE quadra col reale, ma i margini di commessa restano comparabili e la varianza segnala l'anticipo/ritardo della struttura sulla crescita.

**Riconoscimento ricavi multi-mese:** i progetti a prezzo fisso pluri-mensili (Siti) riconoscono il ricavo di competenza in **quota lineare** sui mesi di durata; la fatturazione/incasso segue le milestone (doppia data). Le ricorrenti restano su "mese di `data_fine`" (§4.5): l'eventuale oscillazione mensile è un artefatto di rilevazione, non performance.

**Ripartizione temporale dei costi:** un costo annuale/pluri-mensile o una-tantum può essere spalmato in competenza su N mesi (`ripartizione_competenza_mesi`, §5.1), così il margine mensile non è distorto dal mese di pagamento; la cassa resta sulla data reale. È un **risconto gestionale**, non un ammortamento contabile (che resta al commercialista).

---

## 9. Tesoreria

Logica completa nel documento `Bite_Tesoreria_Brief_Sviluppo.md` e in sintesi nel foglio 11. Tre output: **posizione di cassa di oggi**, **previsione 90 giorni** (curva di tensione) e **previsione cassa 12 mesi** (solvibilità), tutte in ottica Disponibilità/Fabbisogno.

- **Conti & saldi:** saldo banca vs gestionale, sentinella → 0 a riconciliazione completa.
- **Import e/c:** upload manuale CBI/CSV → **anteprima** (nuovi vs duplicati + controllo saldo) → conferma. Dedup per impronta (idempotenza). No PSD2.
- **Riconciliazione (Tabella E):** 1:1, parziale (acconto), N:1; lato passivo simmetrico; manuale con S/A; **dissociazione** reversibile; insoluto/storno riapre la scadenza.
- **Previsione:** curva settimanale (indicatore = punto di minimo) + prospetto mensile per categoria + **consuntivo e scostamento** in tempo reale + **soglia di sicurezza** parametrica con **alert**. Correzioni: DSO sulle date, uscite certe proiettate (stipendi/contributi), **forza importo**.
- **Previsione 12 mesi (cash):** stesso motore, **orizzonte parametrico** (settimanale ≤90gg, mensile fino a 12m). Lente di *solvibilità* (i 90gg restano la lente di *tensione*; i primi 3 mesi riconciliano). I mesi lontani sommano ricorrenti + **scadenze fiscali** (`impatta_cassa_bite=true`: IVA trimestrale, F24, saldo/acconti di giugno-novembre) + ricavi del forecast **tradotti in cassa via DSO/DPO**. Rappresentazione **a bande** (certo: ricorrenti + fiscale + backlog contrattualizzato · previsto: nuovo business/spot). **Soglia di sicurezza e alert estesi al minimo 12m** (il muro di novembre visibile ad aprile). È un calcolo, non un dato archiviato. *Dipendenza:* i tributi dei mesi lontani usano la stima Fiscalità (§10) — con l'**aliquota IRPEF prudente** per la cassa (default 43% + addizionali, override per-socio opzionale, §10.4).
- **Ricorrenti:** anagrafica `ricorrenze` → genera occorrenze in avanti; one-off a mano.
- **Esclusioni:** giroconti, partite di giro soci, Italfer → fuori da saldi e margini.

---

## 10. Fiscalità

Sezione operativa. Dettaglio campo-per-campo nel **foglio 14** dell'xlsx. La Fiscalità **non è una nuova tabella di fatti**: è una **vista** su `movimenti` (per l'IVA per cassa e per il consuntivo dei versamenti) e su `scadenze` con `tipo = fiscale / contributiva` (per il calendario e la previsione). Aggiunge una sola anagrafica di supporto, `tributi` (vocabolario centralizzato dei codici tributo F24), e un **motore di stima** che genera le scadenze previste; l'importo reale (commercialista / F24 versato) **sostituisce** poi la stima.

### 10.0 Inquadramento (vincolante): Bite è una SAS → trasparenza fiscale

Bite Digital Studio è una **società in accomandita semplice**. Conseguenza diretta sul modello: **la società NON paga IRES**. Il reddito d'impresa è imputato **per trasparenza** (art. 5 TUIR) ai soci pro-quota (`quota_pct`, §4.6), **a prescindere dalla distribuzione degli utili**, e tassato in capo a ciascun socio con **IRPEF + addizionali**. Qualsiasi riferimento a "IRES" nel modello è un errore da non reintrodurre.

Cosa resta quindi **a carico della società** (esce dai conti di Bite):

1. **IVA** (regime per cassa — §10.1).
2. **Ritenute operate** come sostituto d'imposta su compensi a collaboratori/professionisti → F24 + CU + 770 (§10.2).
3. **IRAP** (l'unica imposta sui redditi dovuta *dalla società*) (§10.3).
4. **Oneri minori**: diritto annuale CCIAA, imposta di bollo su e-fatture, tasse di vidimazione/concessione (§10.5).

Cosa è formalmente **a carico dei soci** ma va comunque **previsto nel forecast**, perché di norma viene prelevato/finanziato dai conti di Bite:

5. **IRPEF + addizionali dei soci** sul reddito attribuito per trasparenza (§10.4).
6. **INPS gestione commercianti** dei soci che lavorano in azienda (accomandatario, e accomandante solo se presta attività — da verificare per i limiti di ingerenza dell'accomandante) (§10.4).

**Regola di confine cassa (campo `impatta_cassa_bite`):** ogni scadenza fiscale/contributiva porta un flag che dice se l'uscita transita dai conti di Bite. I tributi societari (1–4) hanno sempre `true`. Per i carichi soci (5–6) il flag dipende dal parametro **`bite_finanzia_tasse_soci`**: se `true` (prelievo/anticipo soci a copertura) entrano nella previsione di cassa di Bite; se `false` restano **informativi** (carico fiscale dei soci, utile al CE post-imposte figurativo) ma **fuori** dalla cassa di Bite. Default da confermare con i soci/commercialista.

**Principio 6 ribadito:** il modulo **stima** per alimentare il forecast e **registra** il dovuto; **non** rifà la liquidazione fiscale ufficiale. La verità del calcolo resta il commercialista; la stima serve solo a non avere "buchi ciechi" nella previsione 90gg/12m finché il numero ufficiale non arriva.

### 10.1 IVA per cassa (regime confermato) — liquidazione reale

A differenza delle imposte sul reddito, qui **non si stima**: il regime per cassa rende la liquidazione **reale**, derivata dai movimenti già riconciliati.

- **IVA a debito** = Σ `iva_importo` dei movimenti **di incasso** con fattura **SDI**, riconciliati, con `data_cassa` nel periodo. (Solo elettroniche: il flag `Ft elettronica` è il filtro — invariante.)
- **IVA a credito** = Σ (`iva_importo` × `detraibilità`) dei movimenti **di pagamento** con fattura SDI, riconciliati, con `data_cassa` nel periodo. Fornitori forfettari/indetraibili → 0.
- **Saldo IVA periodo** = debito − credito. Se > 0 → versamento (scadenza fiscale, F24); se < 0 → **credito riportato** al periodo successivo (non genera incasso).
- **Periodicità parametrica**, default **trimestrale per il 2026**. Scadenze di versamento parametriche (trimestrale per opzione: 16 maggio, 20 agosto, 16 novembre, 16 marzo dell'anno successivo per il 4° trimestre; **maggiorazione 1%** sui primi tre trimestri — da confermare col commercialista).
- **Acconto IVA annuale**: scadenza **27 dicembre** (metodo storico/previsionale/effettivo — parametro).
- L'IVA **non è costo né ricavo**: tocca **solo la cassa**, mai il CE gestionale né il margine (coerente con §8, costo pieno).

### 10.2 Ritenute operate → F24 (Bite sostituto d'imposta)

Dalle passive con ritenuta (§6.2): ogni pagamento di un compenso genera, oltre all'uscita verso il fornitore, una **seconda uscita** verso l'erario/INPS.

- **Criterio temporale = cassa:** la ritenuta si versa con riferimento al **mese di pagamento** del compenso. Aggregazione mensile → scadenza **F24 entro il 16 del mese successivo**.
- `Rit. acconto` → erario (`tipo = fiscale`, es. codice tributo 1040 per professionisti — da anagrafica `tributi`).
- `Rit. prev.` → INPS gestione separata, quota a carico del percipiente trattenuta da Bite (`tipo = contributiva`).
- **Adempimenti annuali collegati:** Certificazione Unica (entro 16 marzo) e modello 770 (entro 31 ottobre) — date parametriche.

### 10.3 IRAP (società) — stima interna + registrazione

Unica imposta sul reddito dovuta dalla società. Il modulo la **stima** per il forecast, poi registra il dovuto reale.

- **Base imponibile** = **Valore della Produzione Netto (VPN)**, derivato dal CE gestionale (§8) con **rettifiche IRAP parametriche**: indeducibilità dei compensi a collaboratori/lavoro autonomo e co.co., deduzione del costo dei dipendenti a tempo indeterminato, indeducibilità degli interessi passivi. Il set di rettifiche è un parametro; la base esatta la conferma il commercialista.
- **Imposta stimata** = VPN × `aliquota_irap` (parametro, default **3,9%** — aliquota base; verificare l'aliquota/maggiorazione **Emilia-Romagna** vigente).
- **Versamenti (F24):** **saldo** anno precedente + **1ª rata di acconto** a giugno (con possibile proroga a luglio + 0,40%), **2ª rata di acconto** a novembre. Misura acconto e split rate parametrici (metodo storico, default acconto 100% in 40%/60%).

### 10.4 IRPEF soci (trasparenza) e INPS — stima per il forecast

Per la SAS, "imposte sul reddito sui soci" e "contributi" sono i flussi che il §10.0 marca come carico soci ma da prevedere.

- **Reddito fiscale società** (stima) → attribuito pro-quota: `reddito_socio = reddito_fiscale × quota_pct`. Il reddito fiscale **differisce** dall'utile gestionale per le variazioni fiscali (deducibilità FIC, ammortamenti, ecc.): il modulo lo **stima**, il commercialista lo certifica.
- **IRPEF socio — due valori (prudenza opposta secondo l'uso):**
  - *Stima minima (reporting):* scaglioni IRPEF sul reddito attribuito **+ addizionali** regionale/comunale, come se fosse l'unico reddito. Ignora gli altri redditi personali → è il **carico minimo**, per KPI e reporting.
  - *Aliquota prudente (cassa):* per la **previsione di cassa** (§9) e le scadenze con `impatta_cassa_bite=true` si usa un'**aliquota marginale prudente** (il reddito Bite si somma agli altri del socio, quindi marginalmente pesa di più): parametro `aliquota_irpef_prudente`, **default 43% (scaglione massimo) + addizionali**, con **override per-socio opzionale** (`aliquota_marginale_attesa`, off di default). Sulle uscite di cassa si sovrastima, mai il contrario.
  - *Regola:* non usare mai il minimo per la cassa; i due valori restano distinti.
- **INPS gestione commercianti** dei soci lavoratori: **contributi fissi** sul minimale (parametro, 4 rate: 16 mag / 20 ago / 16 nov / 16 feb) + **contributi a percentuale** (parametro, ~24%) sul reddito eccedente il minimale fino al massimale, versati come acconti/saldo coi redditi (giugno + novembre).
- **Versamenti redditi (F24):** saldo + 1ª rata acconto a **giugno** (proroga luglio +0,40% — parametro), 2ª rata acconto a **novembre**. Riguardano IRPEF soci + addizionali + INPS variabile.
- Tutte queste scadenze nascono con `impatta_cassa_bite` governato da `bite_finanzia_tasse_soci` (§10.0).

### 10.5 Oneri minori

Diritto annuale **CCIAA** (con la 1ª rata redditi, giugno), **imposta di bollo su e-fatture** (trimestrale, solo su fatture senza IVA — marginale per Bite che opera in IVA ordinaria, ma da prevedere se emette fatture esenti/fuori campo > 77,47 €), tasse di vidimazione libri. Categoria `tributi` "altri", importi tipicamente bassi e ricorrenti → gestibili anche via `ricorrenze`.

### 10.6 Come la Fiscalità alimenta gli altri moduli

- **Tesoreria / Previsione 90gg (§9):** tutte le scadenze `fiscale`/`contributiva` con `impatta_cassa_bite = true` entrano nella curva e nel prospetto mensile come **uscite certe proiettate**. La liquidazione IVA è il caso più pesante e va proiettata trimestre per trimestre.
- **CE gestionale (§8):** l'IRAP (e, se si vuole un risultato netto post-imposte *figurativo*, l'IRPEF carico soci) alimenta la riga **− imposte** dello scalare. L'IVA **non** entra mai nel CE. Deducibilità/detraibilità restano confinate al solo calcolo fiscale (costo pieno nel CE).
- **KPI (§12):** **Saldo IVA di periodo** (debito/credito) e **Carico fiscale stimato** (somma dei tributi previsti dell'anno) come indicatori direzionali.

### 10.7 F24 come documento aggregatore (con compensazione)

I versamenti F24 sono modellati come **documento**, non come tributi sparsi: una **testata** (data versamento) e **righe per codice tributo**, letti dall'anagrafica `tributi` (già popolata coi codici — es. 1040, 3800, 6031 — da confermare col commercialista). L'F24 **netta** i debiti coi **crediti compensati** (tipicamente IVA a credito): `saldo F24 = Σ debiti − Σ crediti compensati`, ed è **quel saldo l'uscita di cassa** reale, non la somma lorda dei tributi. Flusso: la stima genera le righe previste; poi l'utente **inserisce l'F24 reale** (o ne conferma i codici tributo), che sovrascrive la stima (invariante 14). Senza la compensazione la previsione 90gg/12m sovrastimerebbe le uscite.

---

## 11. Pagine di dettaglio (viste)

### 11.1 Pagina Cliente (foglio 5)
KPI in evidenza: **Client Health Score** (media pesata: puntualità pagamenti 30% + marginalità media 25% + trend fatturato 20% + stabilità 15% + anzianità 10% — pesi confermabili; bande Verde≥70/Giallo/Rosso), **LTV** (margine lordo cumulato **storico reale**, proiezione mostrata a parte), **DSO comportamentale medio** + **DSO ultime 3 fatture**, **n. progetti attivi**, **Stabilità** (rating manuale 1-5), **Proiezione fatturato 12m** (ricorrenti: run-rate contratti attivi × fattore stabilità; spot: media 12m × fattore; fattore 5→1.0 … 1→0.25). Liste: storico commesse, preventivi/offerte (fonte da definire), fatture attive, progetti attivi (cliccabili). Blocco dati fatturazione.

### 11.2 Pagina Progetto (foglio 7)
Tre sezioni: **Panoramica** (valore progetto, data inizio, team con assegnazione inline, commesse correlate, blocco SMM se Social, **Conto economico di progetto** = roll-up della marginalità) · **Gantt/Timeline** (milestone e scadenze, agganciata alla sezione gestionale) · **Chat progetto** (scope da definire: chat interna minimale vs integrazione ClickUp, per non duplicare).

### 11.3 Commessa gestionale (foglio 10)
Già descritta in §4.5 (date, MdC, OVH).

---

## 12. KPI (foglio 3)

Una metrica, un posto: KPI operativi in Tesoreria, direzionali in dashboard.
Fatturato mensile, Incasso mensile, Margine lordo, Margine operativo, **DSO aziendale** (`dso_aziendale`; aggregato: crediti aperti ÷ fatturato × giorni — da **non** confondere con il `dso_comportamentale` per cliente di §4.1, che è comportamentale e alimenta la previsione), DPO, Burn rate, Runway, Costi fissi mensili, BEP (= costi fissi ÷ margine di contribuzione %; richiede il tag fisso/variabile), Scostamento budget, PFN (debiti finanziari − liquidità), **Saldo IVA di periodo** (IVA debito − credito del periodo per cassa, §10.1), **Carico fiscale stimato** (somma dei tributi previsti dell'anno con `impatta_cassa_bite = true`; per l'IRPEF soci usa l'aliquota prudente di cassa, non il minimo, §10), **Coefficiente OVH (rolling)** e **Varianza di assorbimento OVH** (segnale struttura-vs-delivery, §4.5).

---

## 13. Budget e Forecast

Sezione operativa. Dettaglio campo-per-campo nel **foglio 15** dell'xlsx. È una **vista derivata** (dipende dai Fatti consolidati, dalle commesse e dalla stima Fiscalità): si costruisce **per ultima** (§16). Persiste due soli input propri — la tabella **`budget`** (il piano) e le **`forecast_assunzioni`** (i parametri del motore); tutto il resto è calcolo su dati già esistenti, senza reinventare logiche.

### 13.0 Quattro concetti da non confondere

- **Budget** — il piano *ex-ante*, fissato e **congelato** una volta approvato. Per `voce_ce` × mese, su **competenza**. È il metro di paragone, non si tocca durante l'anno.
- **Actual (consuntivo)** — ciò che è successo: Σ `movimenti` per `data_competenza`, per voce/periodo. Esiste solo per i **mesi chiusi**.
- **Forecast** — l'aspettativa **aggiornata di atterraggio**: `Actual YTD (mesi chiusi) + ri-previsione dei mesi residui` guidata dai driver. **Rolling**: si ricalcola a ogni chiusura di mese.
- **Scostamento** — due tipi, da tenere separati: **Actual − Budget** (sui mesi chiusi: come sto andando) e **Forecast − Budget** (dove atterrerò vs dove volevo: la metrica direzionale).

**Distinzione critica dalla previsione di cassa (§9):** questo modulo è **economico** (`data_competenza`, voci di CE, orizzonte annuale). La previsione di Tesoreria è **di cassa** (`data_cassa`, 90gg). Stessa fonte (i `movimenti` a doppia data), domande diverse: "quanto guadagno/atterro" vs "quando ho i soldi". Non vanno mai sommate né confuse; il ponte tra le due è la **doppia data** + DSO/DPO che traslano la competenza in cassa.

### 13.1 Costruzione del budget (ibrida)

Il budget v1 si forma in tre strati, poi si congela:

1. **Baseline bottom-up** — run-rate delle **commesse ricorrenti attive** a inizio anno (Social, Gestione Web: Σ `accordo_economico` × periodicità) + **costi da `ricorrenze`** (struttura, SaaS, affitto, personale) + costo del personale da Risorse. È la parte ancorata e quasi deterministica.
2. **Layer top-down** — i **target** di crescita ricavi e di margine fissati dalla direzione, ripartiti per mese/voce come rettifica sulla baseline.
3. **Pipeline / nuovo business** — riga dedicata, **ponderata** per probabilità (asse cliente/commessa): tiene separato ciò che è sperato da ciò che è contrattualizzato.

Il risultato è **`budget` versione "approvata"**, congelata. Un re-budget infra-anno è eccezione tracciata (nuova versione); l'aggiornamento ordinario è il **forecast**, non il budget.

### 13.2 Il motore di forecast (driver-based)

Per ogni mese **non ancora chiuso** e ogni voce, il forecast proietta riusando i driver già definiti altrove (niente logica nuova):

**Ricavi**
- *Ricorrenti* — run-rate delle commesse ricorrenti attive, corretto per il **`fattore_stabilità`** cliente (già in Pagina Cliente §11.1: 5→1.0 … 1→0.25) e per il **churn** atteso. È la componente più affidabile.
- *A prezzo fisso multi-mese (Siti)* — ricavo di **competenza** in **quota lineare** sui mesi di durata; le scadenze a milestone alimentano invece la previsione di **cassa**, non l'economico (§4.4).
- *Spot / una tantum* — media storica 12m × stagionalità, **oppure** da pipeline ponderata quando nota.
- *Nuovo business* — valore pipeline × probabilità (asse cliente/commessa).

**Costi**
- *Struttura (fissi)* — da `ricorrenze`: affitto, SaaS, rate, **personale** (da Risorse, `costo_aziendale_annuo ÷ 12`). Quasi deterministici → centro di costo *struttura*. Da questa proiezione di struttura (numeratore) e dalla proiezione ricavi (denominatore) si deriva il **coefficiente OVH rolling** dei 12 mesi avanti, ricalcolato a ogni chiusura (§4.5).
- *Diretti (variabili)* — da commesse pianificate: **compensi collaboratori** previsti (`compensi[]`, §4.6) + M.O. allocata; in assenza di dettaglio, **% storica sui ricavi**. Centro *produttivo*.
- *Oneri finanziari* — rate dei Finanziamenti (§4.9).
- *Imposte* — dalla **stima del modulo Fiscalità (§10)**: IRAP + (IRPEF soci figurativa) + INPS. È il punto di aggancio col lavoro appena fatto.

**Forecast di voce** = Actual dei mesi chiusi + Σ proiezioni dei mesi aperti/futuri. **Forecast di atterraggio** = roll-up sulle voci → Fatturato, MdC, EBIT gestionale, Risultato netto attesi a fine anno.

### 13.3 Assi di analisi (tutti e tre)

- **`voce_ce` × mese** — la spina dorsale, sempre presente (struttura del CE a scalare, foglio 9).
- **Ricavi per cliente / commessa** — top-line budgettata e previsionata per capire *da dove* arriva (o manca) il fatturato.
- **Costi per centro di costo** — per responsabilizzare le aree (Produzione, Commerciale, Amministrazione, Struttura).

Implicazione sul dato: la riga `budget` ha `voce_ce_id` **obbligatorio** e `cliente_id`/`commessa_id`/`centro_costo_id` **opzionali** secondo l'asse della riga (no doppio conteggio: una riga vive su un solo asse di dettaglio).

### 13.4 Snapshot e accuratezza

Il forecast **non si archivia come input** (è calcolato). Si salva però uno **snapshot mensile** del forecast di atterraggio: serve a misurare la **forecast accuracy** (scarto tra ciò che avevo previsto e l'actual poi realizzato) e a vedere come si muove l'atterraggio mese su mese. È l'unico dato "congelato" oltre al budget. Lo snapshot si prende **alla chiusura del mese** (§13.6) ed è **versionato**: un'eventuale riapertura genera una nuova versione ma non sovrascrive l'originale, così l'accuratezza resta misurata su ciò che era stato previsto.

### 13.5 Limiti consapevoli

- **Storico giovane** (Bite è del 2024): media 12m e stagionalità sono poco robuste. Finché lo storico non matura, **pesare di più i contratti ricorrenti attivi** (deterministici) e **meno** la media storica e la stagionalità. Va parametrizzato, non lasciato implicito.
- **Disciplina di chiusura**: il forecast rolling vale solo se la chiusura mensile della competenza è puntuale. Senza, "Actual YTD" è incompleto e il forecast slitta.
- **Artefatto di rilevazione (ricorrenti a cavallo di mese)**: le ricorrenti che sfasano dal mese solare concentrano la competenza nel mese di `data_fine` (§4.5); la varianza del singolo mese netta sui mesi adiacenti — da non inseguire negli scostamenti.
- **Pipeline = stima, non cassa**: la riga nuovo business è la più volatile; tenerla ponderata e separata evita di "drogare" l'atterraggio con fatturato sperato.

### 13.6 Chiusura di periodo (lock)

La chiusura mensile è il **prerequisito** del forecast rolling (§13.2) e del coefficiente OVH (§4.5): senza un mese congelato, l'Actual YTD è mobile e la forecast accuracy non è misurabile.

- **Cosa si congela:** a chiusura, i movimenti con `data_competenza` nel mese diventano immutabili (no insert/edit/delete). Le correzioni successive entrano come **scritture di rettifica nel periodo aperto**, non modificando il mese chiuso.
- **Competenza sì, cassa no:** il lock vale sulla **competenza** (economico/CE/forecast). La **cassa resta aperta**: un movimento bancario tardivo con `data_cassa` in un mese chiuso si riconcilia comunque (la verità di cassa è la banca). Due lock distinti per le due date.
- **Finestra soft → hard:** soft close a fine mese (mese in revisione, modifiche segnalate) → **hard lock entro il 15 del mese successivo** (parametro), per far entrare fatture FIC, e/c e freelance tardivi.
- **Routine di chiusura (in sequenza):** congela competenza → **snapshot forecast** (immutabile, §13.4) → ricalcolo **coefficiente OVH rolling** + **varianza di assorbimento** → chiusura **margini di commessa** con competenza nel mese (OVH su base reale) → calcolo **Actual** → rebase del forecast.
- **Riapertura:** consentita solo a direzione, **tracciata** (audit + nuovo snapshot versionato); lo **snapshot forecast originale resta immutabile**, così la forecast accuracy si misura sempre su ciò che era stato previsto. La via ordinaria resta comunque la rettifica nel periodo aperto.
- **Permessi/audit:** `closed_by` / `closed_at`; solo ruoli amministrazione/direzione chiudono e riaprono (principio 7).

---

## 14. Logiche trasversali da non sbagliare (riepilogo)

- **Doppia data** su ogni movimento → CE (competenza) e cassa separati dalla stessa riga.
- **Margine una volta sola**: progetto → commessa → CE. Mai due motori.
- **Costo pieno nel CE gestionale**; deducibilità/detraibilità solo nel fiscale.
- **Collaboratore (principio 9):** fattura = costo; compenso/timesheet = previsione/allocazione.
- **Socio:** quota progettuale ripartita **per peso (chiave di riparto a cascata, §4.6)** sui soli progetti attivi nel periodo; admin/commerciale a struttura. Equal-split solo come caso degenere; diluizione da portafoglio chiusa in v2 (tariffa standard).
- **Costo orario dipendente** su ore nette; assenze extra = sotto-assorbimento.
- **Esclusioni** fuori da cassa e margini.

**Arrotondamento e quadratura.** Gli importi monetari sono a **2 decimali**, arrotondamento **half-up** (0,005 → 0,01). Coefficienti e aliquote si tengono a **piena precisione** internamente; l'arrotondamento avviene sul **risultato monetario**, non sul coefficiente. Nei **riparti che devono quadrare a un totale** (quota socio inv. 16, allocazioni fattura↔commessa inv. 6, riconciliazioni inv. 7, ripartizione temporale ÷N, IVA scorporo, OVH coefficiente×base, straight-line Siti ÷mesi) si arrotonda ogni quota a 2 decimali e il **resto di quadratura** (totale − Σ quote arrotondate) si assegna all'**ultima quota**, così la somma torna esatta al centesimo. Senza questa regola le invarianti di somma non reggono.

---

## 15. Invarianti (regole che non si violano mai)

1. La `descrizione_grezza` bancaria non si modifica mai.
2. I dati FIC sono sola lettura.
3. Re-importare un e/c non duplica movimenti (dedup per impronta).
4. Le esclusioni (giroconti, partite di giro soci, Italfer) restano fuori da saldi e margini.
5. In riconciliazione (E) non si attribuisce mai più dell'importo del movimento; ogni collega/scollega ricalcola gli stati a valle.
6. Σ allocazioni di una fattura (F) = imponibile della fattura.
7. Σ allocazioni di un movimento su una scadenza ≤ importo della scadenza.
8. Ogni riconciliazione è reversibile.
9. `data_fine` commessa e `data_incasso_attesa` seguono le formule esatte (§4.5, §6.1), senza eccezioni inventate.
10. Σ ripartizione socio = 100%.
11. Margine = una sola fonte (roll-up), mai ricalcolato.
12. **Bite è SAS → niente IRES.** Le imposte sul reddito sono IRAP (società) e IRPEF dei soci per trasparenza; mai introdurre IRES.
13. **IVA per cassa solo su SDI**, esigibile/detraibile al momento dell'incasso/pagamento; l'IVA non tocca mai CE né margine, solo cassa.
14. **Stima ≠ reale:** gli importi fiscali stimati alimentano il forecast ma sono sempre **sovrascrivibili** dal dovuto reale (commercialista / F24); il modulo non rifà la liquidazione ufficiale (principio 6).
15. La cassa di Bite include un tributo solo se `impatta_cassa_bite = true`; i carichi soci entrano solo se `bite_finanzia_tasse_soci = true`.
16. **Quota progettuale socio = pool × peso / Σ pesi** sui progetti attivi nel periodo; il pool resta `compenso × progettuale_pct` (nessun doppio conteggio con l'OVH admin/comm). L'equal-split è solo il caso degenere a pesi uguali; un eventuale **override % mensile** ha priorità e somma 100%.
17. **OVH in normal costing:** le commesse si caricano al **coefficiente rolling** (overhead previsto ÷ base ricavi prevista, 12m avanti), ricalcolato a ogni chiusura; lo scarto vs overhead reale è **varianza di assorbimento aziendale**, mai spalmato sulle commesse. Base = ricavi (v1), upgrade a costo-lavoro (v2). Vietato tornare alla % sul MdC.
18. **Lock di competenza:** un mese chiuso congela i movimenti per `data_competenza` (correzioni → rettifiche nel periodo aperto). Il lock non tocca la cassa (riconciliazione sempre possibile). La riapertura è tracciata e **non** sovrascrive lo snapshot forecast originale.
19. **IRPEF socio a due valori:** **minimo** progressivo (reporting) e **prudente** per la cassa (default 43% + addizionali, override per-socio opzionale). La previsione di cassa/forecast usa sempre il prudente, mai il minimo.
20. **Riconoscimento ricavi:** progetti a prezzo fisso multi-mese (Siti) → competenza in **quota lineare** sui mesi di durata, **cassa/fatturazione a milestone** (doppia data). Ricorrenti → competenza nel mese di `data_fine` (nessun pro-rata; l'oscillazione mensile è artefatto, non performance).
21. **Ripartizione temporale del costo:** un costo può essere spalmato su N mesi in competenza (`ripartizione_competenza_mesi`, default 1); la cassa resta un'unica uscita sulla `data_cassa`. È risconto **gestionale**, non ammortamento contabile.
22. **Parametri centralizzati ed effective-dated:** ogni impostazione (periodicità IVA, aliquote, soglie, default) vive nel registro `parametri` con `valido_da`; periodi chiusi e snapshot usano il valore in vigore alla loro data. Vietato l'hardcoding; i segreti (token FIC/ClickUp) restano in variabili d'ambiente, **mai** nei parametri.
23. **Arrotondamento e quadratura:** importi a 2 decimali half-up; nei riparti a totale il resto di quadratura va all'ultima quota, così Σ quote = totale al centesimo (§14). I coefficienti restano a piena precisione: si arrotonda il risultato, non il coefficiente.

---

## 16. Sequenza di sviluppo consigliata

1. **Modello dati:** Dimensioni + `movimenti` (doppia data) + `scadenze` + `ricorrenze` + tabelle ponte. Nessuna UI prima.
2. **Anagrafiche** (con riuso, tag centralizzati, attributi fisso/variabile e diretto/indiretto sulle categorie).
3. **Tesoreria:** movimenti, import e/c, riconciliazione (E), posizione di cassa. (segue il brief)
4. **Fatturazione/Prima Nota** → alimentano `movimenti`; riconciliazione fattura→commessa (F).
5. **Scadenze** (fatture + fiscali + ricorrenti) → previsione 90gg.
6. **KPI direzionali** (runway, burn, DSO/DPO).
7. **Fiscalità:** IVA per cassa, ritenute/F24.
8. **Budget/Forecast.**
9. **Conto Economico gestionale** (roll-up) e **Commessa gestionale** (MdC + OVH).
10. **Preventivatore** (§18): riusa Risorse/tariffe, OVH e regola socio; produce `accordo_economico` e budget-ore → alimenta Commessa e pipeline. Va dopo che marginalità e Risorse sono stabili.
11. **Scenario/affinamenti** per ultimi.

**Vincolo d'ordine (dipendenze dure):** il **lock di chiusura** (§13.6) precede Forecast e coefficiente OVH; la **marginalità di commessa** (OVH normal-costing, §4.5) dipende da entrambi. La **previsione di cassa 12m** (§9) si costruisce dopo Scadenze + Fiscalità + Forecast, perché i mesi lontani usano le scadenze fiscali e i ricavi tradotti in cassa via DSO/DPO. In sintesi: *chiusura → forecast/OVH → marginalità*; la cassa 12m dopo che fiscalità e forecast esistono. **Gate FIC:** validare il mapping dei campi FIC (foglio 13) prima di dare fiducia a IVA per cassa, deducibilità/detraibilità e margini — finché non è validato, quei numeri a valle non sono affidabili. **Registro Parametri (§19):** è fondativo, va costruito presto (con le anagrafiche), perché tutti i motori lo leggono.

---

## 17. Decisioni ancora aperte (da confermare prima/durante)

> Molti dei parametri elencati qui sotto **confluiscono nel registro Parametri (§19)**: restano "da confermare" nel valore, ma hanno una casa unica, datata e versionabile.

- **Riparto quota progettuale socio (§4.6) — DECISO:** riparto pesato con **chiave a cascata** (override % mensile → ore-preventivo → intensità S/M/L), flag `attivo_nel_periodo`, equal-split come caso degenere. *Parametri fissati:* scala intensità **S/M/L = 1:2:4** (≈ 4/8/16 h-socio/mese, default M), sulla stessa scala delle ore-preventivo (normalizzate a base mensile per i progetti multi-mese); **override % mensile opzionale, off di default**. *Roadmap v2 (stadiata):* costo-socio a **tariffa standard** (sforzo × tariffa, residuo a sotto/sovra-assorbimento) per chiudere la diluizione e unificare col pricing.
- **Base e coefficiente OVH (§4.5) — DECISO:** base **ricavi** (v1; upgrade a costo-lavoro diretto in v2), **coefficiente rolling forward 12m** ricalcolato a ogni chiusura, **normal costing** con varianza di assorbimento a struttura. *Da tarare:* tetto allo scostamento del coefficiente tra refresh; % OVH su **prezzo** nel preventivo, coerente col coefficiente a consuntivo.
- **Pesi** del Client Health Score. *(La fonte dei preventivi è risolta: gestione interna col Preventivatore §18.)*
- **Preventivatore (§18):** `markup` di default e base su cui si applica (solo lavoro vs costo pieno); base di allocazione **OVH** nel preventivo; uso o meno di una **tariffa figurativa** socio per la sola capacità; fonte della **`% impegnata`** per il check capacità; valori di **effort** dei template `servizio`.
- **Centro costo** e **Categoria** FIC sulle passive: confermare se compilati e definire la **tabella di mapping** FIC→categoria gestionale. **(Gate bloccante: IVA/deducibilità/detraibilità/margini non affidabili finché il mapping FIC non è validato.)**
- **Saldo di apertura** dei conti (col commercialista).
- **Tracciato bancario** Intesa/Credem (CBI vs CSV) — cambia il parser, non il meccanismo.
- **Scope Chat progetto** (interna minimale vs ClickUp).
- **Parametri:** settimane/festività standard per le ore nette, soglia di sicurezza previsione, tolleranza matching, tetto fatture per N:1.
- **Budget/Forecast (§13):** target di crescita e di margine (layer top-down); stadi e probabilità della **pipeline** (`prob_pipeline`); **peso run-rate vs storico** (alto finché lo storico 2024 è immaturo); frequenza del **re-forecast** (default mensile) e disciplina di chiusura competenza; livello dello **snapshot** da congelare (voce vs solo atterraggio).
- **Fiscalità (§10):** `bite_finanzia_tasse_soci` (se i prelievi soci per IRPEF/INPS escono dai conti Bite); aliquota/maggiorazione **IRAP Emilia-Romagna** e set di rettifiche per il VPN; **minimale e aliquota INPS** gestione commercianti (e se l'accomandante è iscritto); scaglioni IRPEF + addizionali del Comune di Parma (**DECISO**: default cassa prudente 43% + addizionali, override per-socio opzionale; il minimo resta per il reporting); periodicità IVA (confermata trimestrale 2026) e relative date/maggiorazioni; metodo e misura degli **acconti**; date delle eventuali **proroghe** di versamento; mapping dei **codici tributo** F24 (anagrafica `tributi`); rilevanza del **bollo** su e-fatture per Bite.

---

## 18. Preventivatore (esterno "a margine" + interno)

Modulo aggiunto. Logicamente **precede la Commessa** (§4.5): è l'origine ex-ante della sua economia. Dettaglio campo-per-campo nel **foglio 16** dell'xlsx. Risolve la decisione aperta §17 sulla fonte dei preventivi (gestione interna). Non introduce logiche di margine nuove: è il **gemello ex-ante** della marginalità di commessa (§4.5), letto prima invece che dopo.

### 18.1 Principio: un solo modello di costo, due letture, due modalità di prezzo

Un preventivo è una scomposizione del prezzo: `Prezzo = costi esterni diretti + costo del lavoro interno + overhead allocato + margine`. La stessa scomposizione si legge in due direzioni:

- **Vista esterna (al cliente):** dal basso in alto (**cost-up**). Stimi lavoro + esterni, applichi il markup, ottieni il prezzo. Prezzo = output.
- **Vista interna (allocazione):** dall'alto in basso (**price-down**). Prezzo dato, togli margine, esterni e OVH → resta il **budget interno** da distribuire in ore. Prezzo = input.

**Due modalità di prezzo, selezionabili per preventivo** (scelta confermata):
- **Cost-up (markup):** `Prezzo = Σ costi × (1 + markup)`. Il markup è applicabile selettivamente (solo lavoro interno oppure costo pieno).
- **Margine-down:** fissi il margine% (o il prezzo) → `margine = Prezzo − costo pieno`, oppure `Prezzo = costo pieno / (1 − margine%)`.
- **Markup ≠ margine:** il markup è sul costo (`prezzo/costo − 1`), il margine sul prezzo (`utile/prezzo`). L'interfaccia deve mostrare sempre entrambi per evitare la confusione.

### 18.2 Le righe del preventivo (composizione del costo)

Tre nature di riga, con **meccaniche di costo diverse** — è il punto da non sbagliare:

- **Riga lavoro a ore (dipendenti):** costo = `ore × costo_orario` reale (§4.6). **Consuma il budget interno B.** Il trade-off ore (§18.4) vive qui.
- **Riga socio:** costo = **quota progettuale ripartita per peso** (§4.6): `pool × (w_progetto / Σ w_attivi)`, dove il nuovo progetto entra col suo peso (ore-socio del preventivo o intensità S/M/L). A preventivo resta una **stima** su `n_progetti + 1`. **Il costo non è guidato dalle ore** del preventivo (le ore-socio servono a capacità/fattibilità §18.6 e come chiave di riparto), quindi **non consuma B**.
- **Riga costo esterno (collaboratore a fattura / fornitore / licenza):** pass-through, con `ricarico` opzionale. Per i collaboratori a fattura vale il principio 9 (il costo è la fattura, non il timesheet).
- **Overhead:** quota OVH allocata come **% sul prezzo** (coerente con la base-ricavi a consuntivo, §4.5), allineata al **coefficiente rolling** corrente. **Comprende già** la quota amministrativa/commerciale dei soci (il "40%", §4.6/§4.7): non va rimessa nel costo diretto o si conta due volte.

### 18.3 Vista interna: residuo, allocazione, trade-off

- **Budget interno** `B = Prezzo − costi esterni − costo soci (riparto pesato) − OVH − margine_target`.
- `B` si distribuisce tra le **risorse a ore**. Simulatore: fissi le ore di una, il tool mostra il massimo per le altre → `h_F ≤ (B − ore_A × r_A) / r_F`.
- **"Posso aggiungere un servizio?"** = vero se `B residuo > 0` **e** c'è **capacità residua** nelle persone giuste.
- **Limite critico da tenere presente:** il trade-off **in euro** vale **solo tra le risorse a ore** (i dipendenti). Per i **soci** "quante ore" è una domanda di **fattibilità/capacità**, non di budget: il loro costo sul progetto è la quota progettuale **pesata** a prescindere dalle ore del preventivo. Se le persone del tuo esempio (Alessandro, Federico) sono soci, la frontiera di scambio in euro non si applica a loro: il loro costo è la quota progettuale (ora **pesata**, non equa), che dipende dal portafoglio, non dalle ore del preventivo. In **v2** (tariffa standard) il costo-socio diventa `sforzo × tariffa` e rientra nella frontiera in euro.

### 18.4 Costo socio — chiarimento (regola confermata) e implicazioni

Esempio: compenso €1.500, `progettuale_pct` 60% → €900 di **pool** progettuale. In **v1** il pool si ripartisce sui progetti attivi **in proporzione al peso** (chiave a cascata §4.6): a pesi uguali torna l'equal-split (9 progetti → €100/progetto); con intensità diverse la quota segue il peso. Il restante 40% (amministrativa + commerciale, non fatturabile) → **OVH** (§4.6/§4.7).

Implicazioni sul preventivo:
- **Mis-allocazione relativa: risolta in v1.** Il riparto pesato non assume più tempo uguale su ogni progetto.
- **Diluizione da portafoglio: residua in v1, chiusa in v2.** Il pool resta fisso e diviso sui progetti attivi, quindi ogni nuovo progetto abbassa ancora la quota-socio sugli altri: a preventivo il costo-socio è una **stima** su `n_progetti + 1`, da mostrare come tale. La v2 (costo-socio = `sforzo × tariffa standard`, residuo a sotto/sovra-assorbimento) la elimina.
- **Nessun doppio conteggio:** la quota amministrativa/commerciale è già in OVH; il preventivo mette a costo diretto **solo** la quota progettuale (pesata).

### 18.5 Capacità (check leggero — scelta di partenza)

- **Capacità mensile** = `ore nette ÷ 12` (dipendenti da §4.6; soci con monte-ore parametrico, dato che non timbrano).
- `% impegnata` inserita a mano per periodo → **ore disponibili** = capacità × (1 − % impegnata). Allocazione **segnalata** se supera il disponibile.
- Niente registro forward aziendale su tutte le commesse: "chi ha tempo" resta una **stima**, non una verità. Il registro capacità completo è l'evoluzione futura (scelta esplicita di partire leggeri).

### 18.6 Catalogo servizi (incluso in forma leggera)

Entità `servizio`: template di sforzo per **`tipo` di progetto** (i 5 di §4.4: Social, Sito, Gestione Web, Produzione, Stand), con ore per ruolo e prezzo base. **Seminato con placeholder, editabile; righe libere sempre ammesse.** Dà standardizzazione e velocità senza bloccare sui dati di effort che ancora mancano; migliora con lo storico.

### 18.7 Entità da persistere

- **`preventivo`** (testata): `cliente_id`, `stato` (bozza / offerta / accettato / perso), `modalita_prezzo` (markup / margine), `prezzo`, `margine`, `markup`, `valido_fino`, `note`.
- **`preventivo_riga`**: `tipo` (lavoro / socio / esterno / overhead), `servizio_id` (opz.), `risorsa_id` / ruolo, `ore`, `tariffa`, `costo`, `ricarico`, `prezzo_riga`.
- **`servizio`** (catalogo): `nome`, `tipo_progetto`, template effort (ore per ruolo), `prezzo_base`.

Le tariffe vengono da Risorse: `costo_orario` reale per i dipendenti; per i soci il costo in **v1** è la **quota progettuale ripartita per peso** (non una tariffa oraria di costo). La **tariffa figurativa** socio resta oggi un riferimento di capacità, ma è il candidato naturale a diventare la **base di costing in v2** (e per il pricing, cfr. review §3.7).

### 18.8 Chiusura dei loop (perché regge)

- **Accettato → Commessa/Progetto:** `accordo_economico = prezzo`; le righe lavoro diventano il **budget-ore pianificato** della commessa → confronto ex-post con la marginalità reale (§4.5).
- **Offerta →** pipeline ponderata del **forecast** (§13.2, riga nuovo business).
- **Perso →** storico per il tasso di conversione (input al `prob_pipeline`).

### 18.9 Limiti consapevoli

Costo-socio ancora dipendente dal portafoglio in v1 (diluizione residua, stima a preventivo; chiusa in v2 con la tariffa standard). Template di effort credibili solo con storico (Bite è del 2024). Capacità leggera = stima finché non c'è il registro forward. La doppia modalità markup/margine aggiunge complessità d'interfaccia: va resa esplicita, non nascosta.

---

## 19. Parametri di sistema (registro di configurazione)

Tutto ciò che nel modello è "parametro" — periodicità IVA (mensile/trimestrale), regime per cassa, soglie, aliquote, default — vive in **un unico registro `parametri`**, non sparso nel codice né nelle viste. È una **Dimensione** (configurazione), letta dai motori e dalle viste; non persiste fatti. Separare la configurazione dai dati è ciò che permette di cambiare un'impostazione (es. IVA da trimestrale 2026 a mensile 2027) senza toccare il codice.

### 19.1 Principi (vincolanti)

- **Centralizzato ma raggruppato** per dominio: Fiscalità, Tesoreria/Previsione, Budget/Forecast, Marginalità/OVH, Soci/Risorse, Chiusura, Preventivatore, Clienti.
- **Validità temporale (`valido_da`):** ogni parametro porta una data di decorrenza. Non è un lusso: un mese chiuso e il forecast rolling devono usare il valore **in vigore alla loro data**, non quello di oggi (coerenza con lock §13.6 e snapshot §13.4). Aliquote e periodicità cambiano per anno (IVA, scaglioni IRPEF, addizionali, INPS, IRAP): senza decorrenza, ricalcolare un periodo passato userebbe valori sbagliati.
- **Default globale + override d'entità:** il registro tiene il **default**; l'override vive sull'entità dove ha senso (aliquota IRPEF prudente 43% globale + override per-socio; `termini_pagamento` 30 gg globale + override per-cliente; ecc.). Nessun doppio inserimento.
- **Tipizzato + validato:** enum, %, €, int, bool, vettore-12-mesi, data; regole (es. Σ = 100% dove serve).
- **Audit, niente segreti:** ogni modifica logga chi/quando; **token e chiavi (FIC, ClickUp) NON stanno qui** — restano in variabili d'ambiente (regola di sicurezza §0).

### 19.2 Schema `parametri`

`chiave`, `gruppo`, `descrizione`, `tipo`, `valore`, `valido_da`, `scope` (globale / con-override-entità), `fonte` (utente / commercialista / direzione), `nota`, audit. Dettaglio e inventario nel **foglio 17** dell'xlsx.

### 19.3 Contenuto iniziale (i "da confermare" del §17 confluiscono qui)

Per dominio, in sintesi: **Fiscalità** (periodicità IVA e date/maggiorazioni, metodo acconto IVA, aliquota IRAP + rettifiche VPN, scaglioni IRPEF + addizionali ER/Parma, IRPEF prudente cassa 43%, INPS minimale/aliquota, ritenute, acconti, proroghe, `bite_finanzia_tasse_soci`, soglia bollo); **Tesoreria/Previsione** (soglia di sicurezza, tolleranza matching, tetto N:1, orizzonte, IVA media di stima); **Budget/Forecast** (peso run-rate vs storico, stadi/prob pipeline, mappa fattore_stabilità, churn, vettore stagionalità, frequenza re-forecast); **Marginalità/OVH** (base OVH ricavi, orizzonte coefficiente, tetto scostamento); **Soci/Risorse** (scala S/M/L 1:2:4, override % mensile off, ore nette standard, monte-ore socio, ripartizione temporale default); **Chiusura** (hard lock entro il 15, finestra soft); **Preventivatore** (markup default + base, OVH % su prezzo, tariffa figurativa socio, fonte % impegnata, effort template); **Clienti** (`termini_pagamento` 30, DSO campione minimo ≥5, finestra rolling 12m).

### 19.4 Risoluzione del valore (effective-dating)

Un parametro può avere **più righe** con `valido_da` diverse. Il valore attivo per una data D è la riga con `valido_da` **massimo tra quelle ≤ D**. *Quale* data D lo risolve dipende dal parametro:

- **Parametri di periodo fiscale** (periodicità e aliquote IVA, IRAP, scaglioni IRPEF, addizionali, INPS) → si risolvono sulla **data di competenza del periodo / anno fiscale** a cui si riferiscono.
- **Parametri operativi** (soglia cassa, tolleranza matching, giorno di hard lock) → sulla **data dell'operazione / oggi**.
- **Parametri di forecast** → sulla **data del mese proiettato**.

Un **periodo chiuso o uno snapshot congela** i valori risolti a quella data (coerente con lock §13.6 e snapshot §13.4): ricalcolare non li altera. L'**override d'entità** (es. `aliquota_marginale_attesa` sul socio, `termini_pagamento` sul cliente) vince sul default globale, con la stessa logica di data.

---

## 20. Criteri di accettazione ed esempi numerici (moduli finanziari)

Il brief Tesoreria ha già §8 (casi limite) e §9 (criteri di accettazione). Qui l'equivalente per i moduli finanziari: la **definizione di "fatto"** e gli **esempi numerici** da usare come test di auto-verifica.

### 20.1 Criteri di accettazione

- **Marginalità / Commessa (§4.5):** MdC = ricavi − costi diretti (manodopera allocata + costi vivi); ricavi = Σ accordo (aperta) / Σ fatturato allocato (chiusa). OVH caricato = coefficiente rolling × ricavi commessa; margine netto = MdC − OVH caricato. Lo scarto vs overhead reale è **varianza di assorbimento aziendale**, mai sulle commesse.
- **Riparto socio (§4.6):** Σ delle quote imputate ai progetti attivi = pool (`compenso × progettuale_pct`) al centesimo; a pesi uguali coincide con l'equal-split.
- **IVA per cassa (§10.1):** il saldo somma **solo** movimenti SDI riconciliati con `data_cassa` nel periodo; debito dagli incassi, credito da (IVA × detraibilità) dei pagamenti; > 0 → F24, < 0 → credito riportato.
- **F24 (§10.7):** l'uscita di cassa = saldo netto (Σ debiti − Σ crediti compensati), non la somma lorda.
- **Lock / snapshot (§13.6):** dopo l'hard lock un movimento con `data_competenza` nel mese chiuso non è modificabile (→ rettifica nel periodo aperto); lo snapshot è preso e versionato; la riapertura crea una nuova versione senza sovrascrivere.
- **Ripartizione temporale (§5.1) / Siti (§4.5):** Σ delle quote di competenza = importo/accordo; la cassa resta un'unica uscita (temporale) o segue le milestone (Siti).
- **Parametri (§19):** dato un parametro con più `valido_da`, il valore risolto per una data è quello con `valido_da` massimo ≤ data; un periodo chiuso usa il valore congelato alla sua data.

### 20.2 Esempi numerici (output atteso)

1. **Riparto socio con resto:** pool €100 su 3 progetti a pesi uguali → **33,34 / 33,33 / 33,33** (resto 0,01 all'ultima; Σ = 100,00). Pesi M/M/L (2/2/3) su pool €600 → **171,43 / 171,43 / 257,14** (Σ = 600,00).
2. **OVH normal costing:** overhead previsto 12m 120.000 ÷ base ricavi 12m 400.000 = coefficiente **0,30**. Commessa ricavi 10.000 → OVH caricato **3.000**; MdC 4.000 → margine netto **1.000**. Nel mese overhead reale 11.000, caricato totale 10.500 → **varianza di assorbimento 500** (sotto-assorbimento, a struttura).
3. **IVA per cassa (trimestre):** debito da incassi SDI 2.200 − credito da pagamenti SDI 800 = **saldo 1.400** → F24.
4. **F24 con compensazione:** ritenute a debito 1.000 + IVA a debito 1.400 − credito IVA compensato 300 = **2.100** uscita di cassa (non 2.400 lordo).
5. **Ripartizione temporale:** costo 1.000, `ripartizione_competenza_mesi` = 12 → 83,33 × 11 + **83,37** (resto) = 1.000,00 in competenza; **una sola** uscita di cassa alla data di pagamento.
6. **Sito straight-line:** accordo 3.000, durata 3 mesi → competenza **1.000/mese**; cassa a milestone 50/25/25 → **1.500 / 750 / 750**. Competenza ≠ cassa.
7. **Competenza commessa:** commessa 15/03–14/04 → competenza interamente ad **Aprile** (nessun pro-rata).
8. **Parametri (risoluzione):** periodo di competenza in un mese 2026 → `iva_periodicita` risolve alla riga `valido_da` 2026-01-01 = **trimestrale**, anche se nel registro esiste una riga 2027 = mensile.

---

*Documento di architettura/logica. Le scelte tecniche (modello dati fisico, tipi, endpoint, librerie) sono dello sviluppo; questo documento e l'xlsx rendono la logica inequivocabile prima di scrivere codice. In caso di dubbio su un campo FIC o un endpoint, segnalare l'assunzione invece di inventarla.*
