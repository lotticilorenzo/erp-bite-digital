# ERP Bite - Blueprint MVP (allineato al 26 Feb 2026)

## Decisioni confermate

- `Commesse`: stato ufficiale `APERTA -> PRONTA_CHIUSURA -> CHIUSA -> FATTURATA -> INCASSATA`.
- `Marginalita`: formula obiettivo
  - `margine_percentuale = (fatturabile - (manodopera_diretta + costi_diretti + quota_costi_indiretti)) / fatturabile * 100`
- `Quota costi indiretti`: inclusa gia nel MVP (default iniziale `30%`).
- `Timesheet`: il costo orario deve essere snapshot al momento dell'approvazione (no ricalcolo retroattivo).
- `Fatturazione`: una commessa puo generare piu fatture.
- `Fatture in Cloud`: standard scelto `OAuth2`.
- `ClickUp`: mapping per progetto su `progetti.clickup_list_id`.
- `Migrazione storica`:
  - Fatture + cash flow: da gennaio 2025.
  - Timesheet: da novembre 2025.
- `Ambienti`: staging + produzione.
- `Backup`: giornaliero.
- `Notifiche MVP`: solo in-app.

## Principi implementativi

- Single source of truth su PostgreSQL.
- Audit obbligatorio su dati economici e finanziari.
- Nessun hardcode credenziali: solo variabili ambiente.
- Operazioni di chiusura commessa/fatturazione atomiche.
- Commesse in stato bloccato modificabili solo da ADMIN.

## Modello economico MVP

- `Fatturabile progetto SOCIAL`: `fisso + (variabile / delivery_attesa) * delivery_consuntiva` (nessun cap).
- `WEB`: valore a milestone / corpo.
- `MARKETING`: ricavo Bite = solo retainer; budget campagna escluso dalla marginalita.

## Stato tecnico attuale del repository

- Backend FastAPI presente e avviabile via Docker.
- Frontend demo HTML presente con logica UI completa.
- Mancano integrazioni complete reali ClickUp/FIC e data layer frontend completo.

## Gap principali ancora da chiudere

- Rifinitura modello `commessa` per coprire in modo nativo scenari multi-progetto per stesso cliente/mese.
- Chiusura commessa end-to-end con creazione fattura FIC e rollback atomico.
- Persistenza alert settings per utente/workspace.
- Sistema notifiche in-app.
- Migrazione dati storici da Google Sheet.

