# Frontend API Sync - Stato attuale

## Implementato

- Connessione backend dal frontend `bite-erp-v3.html` con modal di login.
- Configurazione `API Base URL` persistita in `localStorage`.
- Salvataggio token JWT e utente autenticato in `localStorage`.
- Sync iniziale da API per:
  - clienti
  - progetti
  - commesse
- Modulo commesse collegato al backend:
  - creazione commessa (`POST /commesse`)
  - aggiornamento commessa (`PATCH /commesse/{id}`)
  - chiusura commessa (aggiornamento stato a `FATTURATA` via API nel modal di chiusura)
- Adapter frontend per nuovo modello commessa aggregata (`cliente+mese` + righe progetto).

## In fallback demo (non ancora allineati API)

- Timesheet completo
- Task ClickUp reali
- Fatture attive/passive complete lato backend
- Costi fissi/finanziaria completa
- CRUD completo clienti/progetti verso backend

## Note operative

- Eliminazione commessa non disponibile via API nella versione backend attuale.
- In modalità API, modifica cliente su commessa esistente bloccata lato UI.

