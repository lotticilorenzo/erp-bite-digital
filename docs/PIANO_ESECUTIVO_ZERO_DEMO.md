# Piano Esecutivo Zero-Demo (priorita business)

## Obiettivo

Portare ERP a uso reale senza sezioni in demo mode, con priorita:
1. Import storico operativo (sblocco utilizzo reale)
2. Backend finanziaria/fatture (sblocco meta del valore ERP)

## Ordine di esecuzione (vincolante)

1. Wave 1: Import dati storici (clienti/progetti/commesse/timesheet)
2. Wave 1 QA: Validazione KPI reali su staging
3. Wave 2: Endpoint backend mancanti finanziaria/fatture
4. Wave 2 Import: Caricamento storico finanziario (fatture/cashflow)
5. Wave 3: Chiusura frontend zero-demo + regressione completa

---

## Wave 1 - Import storico operativo (PRIORITA ASSOLUTA)

### Deliverable obbligatori

- Script import CLI con due modalita:
  - `--dry-run` (nessuna scrittura DB, solo report errori)
  - `--apply` (scrittura reale)
- Supporto input:
  - CSV (Google Sheet export)
  - XLSX (Excel)
- Report di import:
  - totale righe lette
  - righe importate
  - righe aggiornate
  - righe scartate con motivo
- Log per riga in file CSV/JSON di output.

### Entita da importare (ordine tecnico)

1. `clienti`
2. `progetti`
3. `commesse` + righe progetto
4. `timesheet`

### Regole di deduplica (minime)

- Clienti: match per `piva`, fallback `ragione_sociale`.
- Progetti: match per `(cliente_id, nome)`.
- Commesse: match per `(cliente_id, mese_competenza)`.
- Timesheet: chiave tecnica su `(user_id, data_attivita, durata_minuti, commessa_id)` con tolleranza duplicati.

### Criteri di accettazione Wave 1

- Import completo eseguibile su staging senza errori bloccanti.
- Dopo refresh UI, i dati importati restano persistiti.
- KPI core coerenti sui dati reali:
  - marginalita per commessa
  - ore consuntivate vs venduto
  - commesse chiuse/non fatturate

---

## Wave 2 - Backend finanziaria/fatture (PRIORITA 2)

### Scope API minimo da implementare

1. Fatture attive
- `GET /fatture-attive`
- `POST /fatture-attive`
- `PATCH /fatture-attive/{id}`

2. Fatture passive / costi
- `GET /fatture-passive`
- `POST /fatture-passive`
- `PATCH /fatture-passive/{id}`
- `GET /costi`
- `POST /costi`
- `PATCH /costi/{id}`

3. Movimenti finanziari / riconciliazione
- `GET /movimenti-finanziari`
- `POST /movimenti-finanziari/import-csv`
- `PATCH /movimenti-finanziari/{id}` (stato riconciliazione)

4. Report finanziari
- `GET /report/cashflow`
- `GET /report/aging-crediti`
- `GET /report/incassi`

### Note implementative

- Riutilizzare audit log su tutte le modifiche economico-finanziarie.
- Garantire storicizzazione e filtri per periodo lato server.
- Nessuna logica dipendente da filtri frontend non persistiti.

### Criteri di accettazione Wave 2

- Le sezioni finanziaria/fatture UI funzionano su API reali.
- Nessuna scrittura in sola memoria nelle sezioni finanziarie.
- Dati disponibili dopo refresh e coerenti nei report.

---

## Wave 3 - Zero demo frontend completo

### Task

- Rimuovere fallback demo nelle sezioni residue:
  - finanziaria
  - fatture attive/passive
  - costi fissi
  - cashflow
  - task (se endpoint presenti)
- Uniformare pattern API:
  - adapter per modulo
  - normalize/denormalize payload
  - error handling coerente

### Criteri di accettazione Wave 3

- Con backend connesso, nessuna mutazione avviene solo in stato locale.
- Tutte le sezioni business restano consistenti dopo hard refresh.
- Test end-to-end passati sui flussi principali.

---

## Test di accettazione finale (go/no-go)

1. Login/ruoli/permessi:
- ADMIN vede tutto
- PM non vede bilancio globale completo
- DIPENDENTE vede solo le proprie aree

2. Operativo:
- CRUD clienti/progetti/commesse/timesheet persistenti

3. Finanziario:
- fatture attive/passive persistenti
- cashflow e aging coerenti

4. Sicurezza:
- audit log presente su cambi economico-finanziari
- commesse bloccate non modificabili da non-ADMIN

---

## Messaggio pronto da inviare allo sviluppatore

> Priorita esecutiva confermata:
> 1) partire subito con import storico (clienti, progetti, commesse, timesheet) con script dry-run/apply e report errori per riga;
> 2) subito dopo implementare endpoint mancanti finanziaria/fatture (fatture attive/passive, costi, movimenti, cashflow, aging);
> 3) chiudere infine zero-demo frontend rimuovendo ogni fallback in memoria.
>
> Accettazione:
> - dati persistenti dopo refresh;
> - KPI operativi validati su dati reali;
> - sezioni finanziarie completamente API-driven;
> - regressione E2E passata.

