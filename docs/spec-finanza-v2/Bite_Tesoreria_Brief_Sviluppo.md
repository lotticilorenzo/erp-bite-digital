# Modulo Tesoreria — Brief di sviluppo

**Bite ERP** · documento di handoff per lo sviluppo · uso interno
Livello: **architettura e logica** (cosa e perché). Le scelte implementative (tabelle, tipi, endpoint, librerie) sono dello sviluppatore.

---

## 0. Come usare questo documento (anche con Claude)

Questo brief è scritto per essere dato in pasto a un assistente AI come contesto, oltre che letto da una persona. Indicazioni pratiche:

- Dai a Claude **questo documento + il `CLAUDE.md` del progetto** come contesto prima di iniziare un modulo, così conosce sia la logica della Tesoreria sia le convenzioni del gestionale esistente.
- Lavora **una sezione per volta** (vedi §10, sequenza). Non chiedere all'AI di costruire tutto insieme: stabilizza un pezzo, poi aggiungi.
- Le **Invarianti (§7)** e i **Criteri di accettazione (§9)** sono la parte da non far reinterpretare all'AI: usali come vincoli espliciti e come test da soddisfare.
- Dove il documento dice "da verificare" (soprattutto sui campi FIC), chiedi a Claude di **segnalare apertamente dove sta assumendo** invece di inventare nomi di campo o endpoint.
- Regola di sicurezza: **nessun token o segreto (FIC, ClickUp) va incollato in chat o committato**. Se serve, si usano variabili d'ambiente.

---

## 1. Contesto e obiettivo

La Tesoreria è un nuovo modulo di Bite ERP. Ha due output, e tutto il resto esiste per produrli:

1. **Posizione di cassa di oggi** — saldo reale dei conti, riconciliato con la banca e ripulito dai movimenti che non sono cassa operativa.
2. **Previsione di cassa a 60–90 giorni** — proiezione settimanale (curva) e mensile per categoria (prospetto), con esito *Disponibilità / Fabbisogno* e identificazione del punto di minimo.

La domanda operativa a cui il modulo deve rispondere: *a fine mese, e nelle settimane successive, Bite ha la liquidità per stipendi, contributi e freelance, o va in fabbisogno?* Oggi si risponde a sensazione; il modulo deve renderla un dato visibile in anticipo.

**Principio architetturale di fondo:** la Tesoreria è un **layer sottile sopra Fatture in Cloud (FIC)**, non un partitario contabile parallelo. FIC conosce le fatture; la banca conosce i soldi reali; la Tesoreria li cuce. Se un dato esiste già in FIC, non si ricostruisce: si legge.

---

## 2. Vincoli del progetto esistente (da rispettare)

Il modulo vive dentro Bite ERP e ne segue le convenzioni. Fare riferimento al `CLAUDE.md` del progetto per i dettagli; i vincoli rilevanti per la Tesoreria:

- **FIC è sola lettura.** Tutti i dati che provengono da Fatture in Cloud non vengono mai scritti dal gestionale. Vanno marcati chiaramente come tali nel modello.
- **Confine dati a tre provenienze**, da distinguere in modo esplicito ovunque: **FIC** (sola lettura) · **Banca** (import estratto conto) · **Tesoreria** (gestito o calcolato dal modulo).
- **Async/serializzazione:** rispettare la regola già in uso nel progetto sul caricamento esplicito delle relazioni prima della serializzazione (pattern `selectinload` prima di `model_validate`). Non bypassarla.
- **Frontend single-file:** il front è un unico file React/Babel senza build step; attenersi alla disciplina di patch già adottata nel progetto.
- **Idempotenza:** re-importare lo stesso estratto conto non deve mai duplicare movimenti.
- **Nessun segreto in chiaro** in codice o chat (token FIC/ClickUp via env).

---

## 3. Glossario (definizioni operative)

- **Conto** — un conto corrente (Intesa San Paolo, Credem). Ha due saldi confrontabili: *saldo banca* (dall'import) e *saldo gestionale* (ricostruito dai movimenti).
- **Movimento** — una riga dell'estratto conto importato. Ha una *descrizione grezza* immutabile (la prova) più informazione aggiunta dal gestionale (categoria, flag).
- **Scadenza** — un incasso atteso o un pagamento dovuto, con la sua data. Origine: fattura FIC o ricorrente interno.
- **Riconciliazione** — il collegamento dichiarato tra un movimento reale e la sua origine (una o più scadenze/fatture). Trasforma due elementi separati in un unico fatto chiuso.
- **Acconto** — pagamento parziale **a fronte di una fattura esistente** (Bite emette sempre fattura prima; non esistono acconti senza fattura). Riduce il credito residuo, la fattura resta aperta.
- **Saldo / Acconto (S/A)** — nella riconciliazione manuale: *S* chiude la fattura (saldo), *A* registra un pagamento parziale (acconto).
- **Sentinella** — la differenza tra saldo banca e saldo gestionale di un conto. Se ≠ 0, c'è qualcosa di non riconciliato o non importato.
- **DSO** — giorni medi tra scadenza e incasso effettivo di un cliente; serve a correggere le date in previsione. (Dato che arriverà con il modulo Fatture attive — vedi §10.) Dato **comportamentale per cliente** (`dso_comportamentale`), da non confondere col **DSO aziendale** aggregato (KPI di bilancio).
- **Consuntivo** — il realizzato (riconciliato) a oggi, contrapposto al *Previsto*.
- **Esclusioni di Bite** — movimenti che non sono cassa operativa e vanno tenuti fuori dai saldi: giroconti tra Intesa e Credem, partite di giro dei soci (es. SICAV in transito), pass-through Italfer.

---

## 4. Le cinque sezioni e come si parlano

Cinque concetti, con un flusso preciso tra loro. Lo sviluppatore decide come modellarli; questa è la logica che devono incarnare.

**Conti & saldi.** Anagrafica dei due conti con saldo banca e saldo gestionale affiancati. La differenza è la sentinella.

**Movimenti / estratto conto.** Le righe importate (CBI o CSV). La descrizione grezza è immutabile; categoria (suggerita da un dizionario pattern, poi correggibile a mano) e flag di esclusione sono aggiunti dal gestionale.

**Scadenzario.** La coda forward di incassi attesi e pagamenti dovuti. La maggior parte si eredita da FIC (fatture attive e passive); la Tesoreria aggiunge i ricorrenti che FIC non conosce (stipendi netti, contributi, freelance, fisse, IVA per cassa).

**Riconciliazione.** Il cuore (vedi §5). Collega il movimento alla sua origine e aggiorna gli stati a valle.

**Previsione.** Un calcolo, non un dato da archiviare (vedi §6). Dal saldo riconciliato di oggi proietta avanti fino a 90 giorni.

**Flusso d'insieme:** *FIC + Banca alimentano Scadenze e Movimenti → la Riconciliazione li collega e aggiorna lo stato delle scadenze → la Previsione legge scadenze e saldo → esito Disponibilità/Fabbisogno.*

### 4.1 Import dell'estratto conto (come entrano i movimenti)

I movimenti bancari entrano per **upload manuale del file**, non per automazione. Alla scala di Bite (due conti) l'open banking/PSD2 è costo e complessità senza ritorno; l'architettura resta però pronta ad aggiungerlo dopo come ulteriore "fonte" che produce le stesse righe normalizzate.

Flusso:

1. L'utente scarica dal remote banking il file dei movimenti (tracciato **CBI `.txt`**, o **CSV** se la banca non espone il CBI).
2. Nel modulo Tesoreria: sceglie il **conto** e carica il **file**.
3. **Anteprima prima di scrivere**: il parser legge le righe, marca quali sono **nuove** e quali **già presenti** (deduplica), e fa il **controllo saldo** (saldo di chiusura del file vs saldo atteso dal gestionale).
4. **Conferma** → i movimenti nuovi entrano come "da riconciliare"; i duplicati vengono ignorati.

Punti chiave:

- **Deduplica per impronta** (conto + data + importo + descrizione grezza): rende sicuri gli import con **periodi sovrapposti**. L'utente non deve tagliare le date con precisione — se ricarica un intervallo già importato, i doppioni sono riconosciuti e scartati.
- **Parser come strategia per formato**: un'implementazione per il CBI, una per il CSV di ciascuna banca (Intesa e Credem hanno tracciati diversi). A valle, il meccanismo di upload → anteprima → dedup → conferma è identico qualunque sia il formato.
- **Niente import da FIC**: i movimenti bancari entrano **solo** da qui. Non attivare l'eventuale riconciliazione bancaria di FIC, che si sovrapporrebbe (coerente con l'invariante "FIC è sola lettura").
- **Anteprima obbligatoria**: l'import non scrive mai a occhi chiusi. Prima mostra cosa entrerà e cosa è duplicato, e segnala se il saldo non torna.

> **Da verificare:** se Intesa e Credem espongono il tracciato CBI o solo il CSV. Cambia il parser, non il meccanismo.

---

## 5. Riconciliazione (logica completa)

### 5.1 Lato attivo (incassi) — il caso base
Collegare un incasso bancario alla sua fattura attiva FIC. Tre situazioni:

- **1:1** — l'incasso corrisponde esattamente a una fattura aperta. Riconosciuto per importo, data vicina e somiglianza di controparte/dicitura, e **proposto** all'utente, che conferma.
- **Parziale (acconto)** — l'incasso è inferiore alla fattura. Si registra l'importo pagato; resta aperto il **credito residuo**. La fattura non si chiude.
- **N:1** — un solo bonifico salda **più fatture** della stessa controparte. Il sistema cerca la combinazione di fatture aperte la cui somma dà l'importo (ricerca vincolata: stessa controparte, finestra temporale, tetto al numero di fatture). Può essere implementato in seconda battuta.

### 5.2 Lato passivo (pagamenti) — simmetrico
È lo specchio dell'attivo: un'uscita bancaria si riconcilia con una **fattura fornitore** aperta in FIC (quanto Bite deve). Stessi tre casi (1:1, parziale = acconto al fornitore, N:1 = un bonifico paga più fatture fornitore) e stesso flusso. Le uscite ricorrenti senza fattura (stipendi, contributi) sono scadenze passive con origine "ricorrente". **Non è logica nuova:** è lo stesso motore usato nell'altra direzione — cambia il segno e la fonte (fatture passive invece che attive). Conviene costruirlo simmetrico da subito.

### 5.3 Riconciliazione manuale (quando il match non scatta)
Se il sistema non propone un match (es. causale generica), l'utente deve poter **associare a mano** il movimento alla fattura giusta. Il pannello replica la logica del "saldaconto": mostra *Importo movimento*, *Pagato* (quanto si attribuisce) e *Differenza*, si sceglie la fattura e si imposta **S = Saldo** o **A = Acconto**. Nota: poiché Bite emette sempre fattura, **non esiste il caso di acconto senza fattura** — c'è sempre una fattura a cui agganciarsi.

### 5.4 Dissociazione (annullamento)
Ogni riconciliazione deve essere **reversibile**. Annullarla riporta il movimento a "da riconciliare", **riapre** la scadenza/le scadenze collegate, ricalcola i residui e aggiorna la sentinella. Vale anche per un acconto già applicato.

### 5.5 Sottoprodotto: dato di puntualità
Ogni riconciliazione di un incasso registra implicitamente *quando una fattura è stata pagata rispetto a quando scadeva*. Accumulato, è il comportamento di pagamento per cliente (input al DSO e, in futuro, a un rating). Va **catturato fin da subito** anche se il rating si costruisce dopo, altrimenti si perde lo storico.

---

## 6. Previsione di cassa (logica completa)

### 6.1 Due viste sugli stessi dati
- **Curva settimanale** — dal saldo riconciliato di oggi, somma incassi attesi e sottrae uscite previste settimana per settimana, fino a 90 giorni. L'indicatore chiave è il **punto più basso** della curva (la settimana di tensione), non il saldo finale.
- **Prospetto cash flow (mensile, per categoria)** — entrate e uscite caratteristiche raggruppate per macro-voce con drill-down sulle micro-voci, subtotali, Cash Flow Operativo (del periodo e progressivo), e saldo cassa progressivo. È la lettura strutturata; la curva è la lettura di rischio. Sono complementari (il mensile aggrega e smussa, il settimanale rivela la tensione intra-mese). Il prospetto mensile è **estendibile a 12 mesi** (orizzonte parametrico) per anticipare i cluster fiscali (giugno/novembre, IVA): stessa logica, mesi lontani alimentati da scadenze fiscali (`impatta_cassa_bite=true`) + ricavi del forecast tradotti via DSO/DPO, rappresentazione **a bande** certo/previsto, **alert esteso al minimo 12m**. La curva 90gg resta la lente di tensione, il 12m è la lente di solvibilità.

### 6.2 Consuntivo in tempo reale
Accanto al previsto del periodo in corso va mostrato il **consuntivo** (realizzato/riconciliato a oggi) e lo **scostamento**. Logica: periodi passati → consuntivo = flussi reali; periodo corrente → consuntivo che si aggiorna man mano che si riconcilia, contro il previsto pieno; periodi futuri → solo previsto. È anche il **loop previsto-vs-consuntivo** che misura l'accuratezza della previsione nel tempo.

### 6.3 Tre correzioni che rendono la previsione onesta
1. **Date corrette dal comportamento reale (DSO).** Una fattura scade il 30, ma se quel cliente paga con un certo ritardo, in previsione l'incasso va spostato di conseguenza. Senza, il forecast è ottimista e mente.
2. **Uscite certe ma non ancora emesse, proiettate.** Gli stipendi del mese prossimo non esistono come fattura in FIC ma sono certi: vanno generati in avanti.
3. **Forza importo.** L'utente deve poter sovrascrivere a mano una voce (incasso che slitta, spesa straordinaria) e vedere la curva ricalcolarsi. Strumento di decisione, non automatismo cieco.

### 6.4 IVA per cassa (derivata, non stimata a occhio)
L'IVA non è una riga inventata: è **derivata dalla cassa reale**. Ogni incasso riconciliato con fattura SDI porta una quota IVA "a debito" nel momento dell'incasso; ogni pagamento con SDI porta IVA "a credito" nel momento del pagamento. La **liquidazione periodica** = IVA a debito − IVA a credito del periodo, con scadenza alla data standard (il 16). In previsione: stima dell'IVA dagli incassi attesi (scorporo all'aliquota media), liquidazione collocata sulla data dovuta, con forza-importo per gli aggiustamenti.

> **Parametro:** la periodicità IVA è configurabile (mensile / trimestrale). Default **trimestrale per il 2026**, ma può cambiare di anno in anno: trattarla come impostazione, non come costante.

### 6.5 Soglia di sicurezza e alerting
La previsione ha una **soglia di sicurezza** parametrica (non lo zero: Bite vuole un cuscinetto minimo). Quando il minimo proiettato — o un singolo periodo — scende sotto la soglia, il sistema deve **avvisare**. L'alerting è la parte azionabile: senza notifica, l'anticipo si perde perché bisogna ricordarsi di aprire la schermata.

### 6.6 Motore dei ricorrenti
I costi ricorrenti (stipendi, contributi, freelance, fisse) vivono in una **sezione dedicata** (anagrafica ricorrenti) dove si definiscono una volta importo + cadenza + categoria; la previsione **genera le occorrenze** in avanti sull'orizzonte. In più resta possibile l'**inserimento manuale diretto** in previsione per i one-off. Motivo: separare la definizione dalla proiezione tiene la previsione pulita e verificabile, e un cambio (aumento di uno stipendio) si propaga ovunque in un punto solo.

---

## 7. Invarianti (regole che non si violano mai)

1. La **descrizione bancaria originale** non si modifica mai. Categoria e flag sono campi separati.
2. I **dati FIC sono sola lettura**: il modulo non scrive mai su ciò che proviene da FIC.
3. **Re-importare non duplica**: i movimenti già presenti vanno riconosciuti e ignorati.
4. **Esclusioni fuori dalla cassa netta**: giroconti, partite di giro soci e Italfer non entrano nei saldi né nei margini.
5. In riconciliazione, **non si attribuisce mai più dell'importo del movimento**; e ogni collega/scollega **ricalcola gli stati a valle** (movimento, scadenza, residui, sentinella) in modo coerente.
6. **Coerenza degli stati**: niente fatture "aperte" già saldate, niente movimenti "riconciliati" senza collegamenti.
7. Il **credito del cliente** è la somma delle sue fatture aperte e dei residui — non esiste credito/acconto slegato da una fattura.
8. Ogni riconciliazione è **reversibile** (dissociabile).

---

## 8. Casi limite da gestire

- **Pagamento parziale** (acconto): credito residuo aperto, fattura non chiusa.
- **Un movimento per più fatture** (N:1) e **più movimenti per una fattura** (parziali in tempi diversi): relazione molti-a-molti tra movimenti e scadenze.
- **Insoluto / storno**: un incasso che torna indietro (movimento negativo) deve poter **riaprire** una scadenza già chiusa.
- **Nota di credito** su una fattura già (parzialmente) incassata.
- **Movimento senza match automatico**: gestito dalla riconciliazione manuale (§5.3).
- **Saldo di apertura** del conto: come si inizializza il saldo gestionale. (Decisione rimandata, vedi §11 — ma il modello deve prevederlo.)
- **Forza importo** che poi si rivela sbagliato: deve essere modificabile/annullabile.

---

## 9. Criteri di accettazione (per sezione)

Da usare come definizione di "fatto" e come base per i test.

**Conti & saldi**
- Importando un estratto conto, `saldo banca` e `saldo gestionale` sono confrontabili e la sentinella mostra la differenza; a riconciliazione completa la sentinella va a zero.

**Movimenti / Import**
- L'import mostra un'**anteprima** con conteggio nuovi/duplicati e controllo saldo **prima** di scrivere; confermando, solo i nuovi entrano come "da riconciliare".
- Re-importando lo stesso file (o un periodo sovrapposto), il numero di movimenti non cambia (idempotenza/deduplica).
- La descrizione grezza non è mai alterata; un movimento flaggato come giroconto/partita di giro/Italfer non incide sulla cassa netta.

**Riconciliazione**
- I tre casi (1:1, parziale, N:1) producono lo stato corretto di movimento e scadenza, e i residui giusti.
- La manuale permette di associare un movimento a una fattura con S/A e mostra Pagato/Differenza coerenti.
- La dissociazione ripristina lo stato precedente esatto (movimento, scadenza, residui, sentinella, contatori).
- Il lato passivo si comporta in modo simmetrico all'attivo.

**Scadenzario**
- Le scadenze FIC sono in sola lettura; i ricorrenti sono generati dall'anagrafica; la data attesa effettiva riflette il DSO quando disponibile.

**Previsione**
- La curva parte dal saldo riconciliato e identifica correttamente il minimo a 90 giorni.
- Il prospetto: i subtotali e il saldo cassa progressivo quadrano; il consuntivo del periodo in corso si aggiorna al riconciliare e lo scostamento = consuntivo − previsto.
- L'IVA compare alla scadenza giusta secondo la periodicità impostata.
- Lo scostamento sotto soglia genera un alert.

---

## 10. Decisioni prese e ancora aperte

### Decise (questa sessione)
- Credito cliente = fatture aperte + residui; **nessun acconto senza fattura**, nessun partitario separato.
- **Dissociazione** di un movimento: sì, reversibilità completa.
- **Simmetria attivo/passivo**: stesso motore di riconciliazione nelle due direzioni.
- **IVA per cassa** derivata dai movimenti riconciliati con SDI; periodicità **parametrica**, default trimestrale 2026.
- **Consuntivo in tempo reale** accanto al previsto, con scostamento.
- **Alerting** su soglia di sicurezza parametrica.
- **Ricorrenti** in sezione dedicata + inserimento manuale per i one-off.
- **DSO**: predisporre il campo a livello cliente; il dato verrà fornito con il modulo Fatture attive, non si calcola adesso.

### Aperte (da confermare prima/durante)
- **Saldo di apertura** dei conti: si decide col commercialista quando il gestionale è quasi operativo.
- **Formato bancario**: verificare se Intesa e Credem espongono un tracciato CBI o solo CSV (cambia il grado di automazione dell'import; il parser va comunque progettato come strategia per-formato).
- **Mapping FIC**: validare endpoint e campi effettivi dell'API in uso (scadenze, anagrafiche, stato SDI). Segnalare dove si sta assumendo. **Gate bloccante:** finché non è validato, IVA per cassa, deducibilità/detraibilità e margini a valle non sono affidabili.
- **Parametri**: tolleranza importo nel matching, tetto fatture per N:1, soglia di sicurezza della previsione, aliquota IVA media per la stima.

---

## 11. Sequenza di sviluppo consigliata

Stabilizzare una cosa per volta:

1. **Movimenti**: import (parser per-formato) + dedup + categorizzazione + flag di esclusione.
2. **Scadenzario**: lettura FIC (sola lettura) + anagrafica ricorrenti con generazione occorrenze.
3. **Riconciliazione**: 1:1 e parziale → conferma → ricalcolo stati → dissociazione. (N:1 e lato passivo subito dopo.)
4. **Previsione**: motore curva settimanale + prospetto mensile + consuntivo + soglia/alert.
5. **IVA per cassa**: derivazione dai movimenti riconciliati + liquidazione periodica.
6. **DSO + data attesa effettiva**: quando arriva il dato dalle Fatture attive.

---

## 12. Cosa NON fare (disciplina di perimetro)

Volutamente fuori scope, perché alla scala di Bite (due conti, ~15 clienti) non cambiano una decisione: la **gestione** di leasing/finanziamenti (piano di ammortamento, oneri finanziari complessi), agenti, multi-valuta, cash pooling, workflow di disposizione bonifici (si paga da home banking), scenari multipli ottimistico/pessimistico. NB: le **rate di rimborso del debito esistente restano in previsione** come scadenze passive ricorrenti — è solo l'ammortamento/PFN a stare fuori (spec §4.9). Il "forza importo" basta. Aggiungere queste cose è complessità da mantenere senza ritorno.

---

*Documento di architettura/logica. Le scelte tecniche (modello dati, tipi, endpoint, librerie) e le decisioni aperte del §10 sono di competenza dello sviluppo; questo brief serve a rendere la logica inequivocabile prima di scrivere codice.*
