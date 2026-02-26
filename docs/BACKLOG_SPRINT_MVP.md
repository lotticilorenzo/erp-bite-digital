# Backlog MVP - Sprint operativi

## Sprint 0 - Fondazioni (1 settimana)

- Hardening backend: auth, error handling, logging.
- Allineamento formula marginalita con costi indiretti.
- Snapshot costo orario in approvazione timesheet.
- Setup ambienti `staging` e `production` con `.env` separati.
- Pipeline backup giornaliero DB.

## Sprint 1 - Core gestionale (1-2 settimane)

- CRUD completi: clienti, progetti, commesse, task, timesheet.
- Regole ruoli/permessi definitive (ADMIN/PM/DIPENDENTE/FREELANCER).
- Blocchi modifica su commesse `CHIUSA/FATTURATA/INCASSATA`.
- Dashboard KPI base da dati reali backend.

## Sprint 2 - Integrazione ClickUp (1 settimana)

- Proxy backend `GET /clickup/tasks` con token da env.
- Mapping task-list per progetto (`clickup_list_id`).
- Sostituzione mock task sul frontend timesheet/progetto.
- Caching leggero e gestione errori API.

## Sprint 3 - Integrazione Fatture in Cloud (1-2 settimane)

- Implementazione OAuth2 (refresh token incluso).
- Creazione fattura da flusso chiusura commessa (step 3 modal).
- Supporto commessa -> multi-fattura tramite righe collegate.
- Sync stato fatture e gestione eccezioni atomica (rollback).

## Sprint 4 - Reporting e migrazione dati (1-2 settimane)

- Report marginalita cliente/progetto/commessa con filtri periodo.
- Import storico:
  - fatture + cash flow da `2025-01`
  - timesheet da `2025-11`
- Validazione coerenza dati migrati (totali mese vs legacy).

## Sprint 5 - Go-live controllato (1 settimana)

- UAT con team interno.
- Monitoraggio errori e performance.
- Training operativo per PM e dipendenti.
- Cutover finale produzione.

## Criteri di accettazione MVP

- Margine cliente/mese disponibile senza export manuali.
- Ore consuntivate vs venduto disponibili in dashboard/report.
- Lista commesse `CHIUSA` non fatturate disponibile in 1 click.
- Fatture scadute e cash atteso consultabili in tempo reale.

