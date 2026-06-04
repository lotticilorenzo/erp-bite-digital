# AUDIT MODULO FINANZA — Bite ERP

> Audit di sola ispezione (nessuna modifica al codice). Obiettivo: capire cosa è
> realmente funzionante prima di migrare la finanza da Google Sheets all'ERP.
> Data audit: 2026-06-01 · Branch: `main` · DB ispezionato live via `docker exec bite_erp_db`.

**Legenda stato:** ✅ funzionante · ⚠️ parziale · ❌ rotto o assente

---

## 0. Sintesi esecutiva (leggere prima di tutto)

Tre fatti che cambiano l'interpretazione di tutto il resto:

1. **La sync Fatture in Cloud non ha MAI funzionato.** Su 1782 run registrate in
   `fic_sync_runs`, **zero** sono andate a buon fine: 1133 `SKIPPED` + 649 `ERROR`,
   tutte con errore `"FIC_API_KEY non configurata"`. `FIC_API_KEY` e `FIC_COMPANY_ID`
   sono **vuote** sia in `.env` sia nel container in esecuzione. → Tutti i dati in
   `fatture_attive` (27 righe) e `fatture_passive` (16) sono **seed/mock**, non dati reali da FiC.
2. **L'endpoint `/report/marginalita` è rotto a runtime.** La query SQL referenzia
   `ca.coefficiente`, ma `coefficiente` è una `@property` Python, **non una colonna**
   della tabella `coefficienti_allocazione`. La query fallisce con
   `column ca.coefficiente does not exist` (verificato sul DB).
3. **Non esiste import estratto conto bancario.** Nessun endpoint CSV, nessun POST
   per creare `movimenti_cassa`. I 36 movimenti presenti vengono solo da `seed_boss_data.py`.
   La riconciliazione bancaria, cuore del brief, **non ha sorgente dati**.

Il resto del modulo (CRUD fatture, regole, imputazioni, costo orario risorse) è
implementato con logica reale ed è riutilizzabile, ma poggia su queste tre fondamenta mancanti.

---

## 1. Stato per area

### 1.1 Modelli & Migrazioni

Tutte le 14 tabelle richieste **esistono nel DB** e hanno un modello SQLAlchemy in
[backend/app/models/models.py](../backend/app/models/models.py). Non c'è Alembic: le
migrazioni sono file SQL in [backend/migrations/](../backend/migrations/) tracciate in
`schema_migrations` + `schema.sql` come base.

| Tabella | Stato | Evidenza | Righe DB | Note |
|---|---|---|---|---|
| fatture_attive | ✅ modello/DB allineati | models.py:642 | 27 | Dati seed (sync FiC mai riuscita) |
| fatture_passive | ⚠️ drift minore | models.py:670 | 16 | DB ha colonne extra non nel modello: `sconto`, `metodo_pagamento`, `note_interne` |
| fattura_righe | ⚠️ vuota | models.py:588 | 0 | Tabella esiste, mai popolata; le righe non vengono importate da FiC |
| fatture_passive_imputazioni | ✅ | models.py:790 | 16 | Usata dagli endpoint imputazioni |
| movimenti_cassa | ✅ modello/DB allineati | models.py:736 | 36 | Tutti seed; nessuna via d'ingresso reale (vedi §4) |
| movimenti_cassa_imputazioni | ⚠️ vuota | models.py:805 | 0 | Endpoint esiste, mai usata in pratica |
| costi | ⚠️ vuota/inutilizzata | models.py:545 | 0 | Nessun endpoint CRUD la espone; vedi §2 |
| costi_fissi | ✅ | models.py:755 | 8 | CRUD completo |
| regole_riconciliazione | ⚠️ vuota | models.py:772 | 0 | CRUD + motore implementati ma nessuna regola creata |
| fic_sync_runs | ✅ (log) | models.py:704 | 1782 | Tutte SKIPPED/ERROR — vedi §3 |
| coefficienti_allocazione | ❌ drift critico | models.py:367 | 6 | Colonna `coefficiente` NON esiste nel DB: è solo `@property` (models.py:377). DB ha `stipendi_operativi`, `overhead_produttivo`. Rompe `/report/marginalita` (§2) |
| risorse | ⚠️ drift minore | models.py:821 | 12 | DB ha colonna extra `costo_orario_lordo` non nel modello |
| timesheet | ✅ | models.py:511 | 207 | Vedi §6 |
| timer_sessions | ✅ | models.py:493 | 3 | Vedi §6 |

**Drift colonne (modello ⟵⟶ DB):** il DB è "più avanti" del modello su `fatture_passive`
e `risorse` (colonne aggiunte via migration SQL ma non riflesse nel modello ORM). Non
causa crash (SQLAlchemy mappa solo ciò che dichiara) ma quei campi sono invisibili all'API.
Il caso `coefficienti_allocazione` è l'opposto e **rompe** una query raw (§2).

### 1.2 Endpoint backend

Endpoint finance mappati in [backend/app/api/v1/router.py](../backend/app/api/v1/router.py)
e [backend/app/api/v1/fic.py](../backend/app/api/v1/fic.py). Tutti protetti da
`require_finance_access` (solo ADMIN — security.py:179) tranne le risorse (`require_admin`).

| Endpoint | Metodi | Stato | Evidenza | Note |
|---|---|---|---|---|
| `/fatture-attive` | GET, PATCH, PATCH `/incassa`, DELETE | ✅ logica reale | fic.py:51-105 | CRUD lettura+update+incasso manuale |
| `/fatture-passive` | GET, PATCH, DELETE | ⚠️ no create | fic.py:108-143 | Nessun POST: si creano solo via sync FiC (rotta) |
| `/fic/sync` + `/fic/sync/status` | POST, GET | ❌ runtime | fic.py:30-48 | Implementato ma fallisce sempre (§3) |
| `/movimenti-cassa` | GET | ⚠️ sola lettura | router.py:314 | **Nessun POST create, nessun import CSV** |
| `/movimenti-cassa/{id}/riconcilia` | POST | ⚠️ | router.py:325 | Flippa solo il booleano `riconciliato`, non lega fatture |
| `/movimenti-cassa/{id}` (PATCH) | PATCH | ✅ logica reale | router.py:343-400 | Qui sta la vera riconciliazione manuale: lega fattura, setta `data_ultimo_incasso = data_valuta`, propaga stato commessa |
| `/costi-fissi` | GET/POST/PATCH/DELETE | ✅ CRUD completo | router.py:403-443 | |
| `/regole-riconciliazione` | GET/POST/PATCH/DELETE | ✅ CRUD completo | router.py:447-490 | |
| `/regole-riconciliazione/applica` | POST | ✅ logica reale | router.py:493 / services.py:2094 | Motore regex/contains/startswith su descrizione movimenti |
| `/regole-riconciliazione/dry-run` | POST | ✅ | router.py:502 / services.py:2140 | Preview senza commit |
| `/regole-riconciliazione/{id}/log` | GET | ⚠️ | router.py:512 / services.py:2193 | Legge `audit_log` azione `APPLICA`, che però non viene mai scritta da `applica_regole_automatiche` → log sempre vuoto |
| `/movimenti-cassa/{id}/suggest` | GET | ✅ logica reale | router.py:523 / services.py:2221 | Suggerisce regola + fatture passive per importo ±5% |
| `/fatture-passive/{id}/imputazioni` | GET/POST/DELETE | ✅ logica reale | router.py:534-597 / services.py:2273 | Split per cliente/progetto in % |
| `/movimenti-cassa/{id}/imputazioni` | GET/POST/DELETE | ✅ logica reale | router.py:560-612 / services.py:2344 | Eredita imputazioni dalla fattura passiva collegata |
| `/risorse` | GET/POST/PATCH/DELETE | ✅ CRUD + calcolo | router.py:616-659 / services.py:2446 | Calcola costo orario fully-loaded |
| `/report/marginalita` | GET | ❌ rotto | router.py:293 / services.py:887 | Crash su `ca.coefficiente` inesistente (§2) |
| `/dashboard/kpi` | GET | ✅ | router.py:174 / services.py:846 | Non usa coefficiente → funziona |
| `/budget/*` | GET/POST | ✅ | router.py:2264-2422 | Budget mensile/categorie/variance/trend/consuntivo |

### 1.3 Integrazione FiC

| Aspetto | Stato | Evidenza | Note |
|---|---|---|---|
| Sync implementata | ✅ codice / ❌ runtime | services.py:1691 | Codice completo (paginazione, upsert clienti/fornitori/attive/passive); **mai riuscita** (§3) |
| Auth | ⚠️ solo API key | services.py:1317-1329 | `FicApiClient` usa solo `FIC_API_KEY` (Bearer + X-API-KEY). **OAuth2 NON usato**: i campi `FIC_OAUTH_*`, `FIC_ACCESS_TOKEN`, `FIC_REFRESH_TOKEN` esistono in config/.env (config.py:45-50) ma il client non li legge né fa refresh token |
| Config presente | ❌ | `.env` + container | `FIC_API_KEY` e `FIC_COMPANY_ID` **vuote** (len=0) in `.env` e nel backend in esecuzione |
| Stato not_paid/paid/partial | ✅ | services.py:1244 `_payment_status` | Mappa total/paid/due_date → stato (label IT INCASSATA/PAGATA) |
| Aggiorna attive E passive | ✅ | services.py:1556 / 1628 | Entrambe gestite |
| **Data incasso da FiC vs riconciliazione** | ⚠️ **viola la spec** | services.py:1600-1601, 1683-1684 | La sync setta `data_ultimo_incasso`/`data_ultimo_pagamento` dal `paid_date` dei payments FiC (`_sum_payments` services.py:1226). La spec richiede che la data incasso venga **solo** dalla riconciliazione bancaria. Esiste anche il path corretto (riconciliazione manuale: router.py:369 `data_ultimo_incasso = mov.data_valuta`), ma le due sorgenti **coesistono e confliggono** |

### 1.4 Riconciliazione bancaria

| Aspetto | Stato | Evidenza | Note |
|---|---|---|---|
| Import CSV estratto conto | ❌ assente | (nessun match in tutto `backend/`) | Nessun `import csv`, nessun `UploadFile` per movimenti, nessun endpoint. I 36 `movimenti_cassa` vengono solo da seed_boss_data.py:1102 |
| Normalizzazione Dare/Avere o +/− | ❌ N/D | models.py:744 | `movimenti_cassa.importo` è `Numeric(12,2)` con segno + campo `tipo`; nessuna logica di parsing/normalizzazione perché non c'è import |
| Matching movimento↔fattura | ⚠️ parziale/manuale | router.py:343-400 | Funziona 1↔1 manuale (PATCH con `fattura_attiva_id`/`fattura_passiva_id`). Marca la fattura INCASSATA/PAGATA in toto |
| Pagamenti multipli in un bonifico | ❌ | router.py:364-381 | Un movimento → una sola fattura; nessun many-to-many movimento/fattura |
| Pagamenti parziali | ❌ | router.py:367-369 | Marca la fattura come INCASSATA per intero, ignora `importo` del movimento vs residuo |
| Causali non riconoscibili | ⚠️ | services.py:2221 `suggest` | Suggerimento per importo ±5% + regole; ma senza dati estratto conto è inattivo |
| Imputazioni usate dagli endpoint | ✅ (passive) / ⚠️ (cassa) | services.py:2273 / 2344 | `fatture_passive_imputazioni` popolata (16); `movimenti_cassa_imputazioni` vuota (0). **Nessuna delle due alimenta il calcolo margine commessa** (vedi §Rischi) |

### 1.5 Frontend (pagine finanza)

Tutte le pagine consumano **API reali** via hook TanStack Query in
[frontend/src/hooks/](../frontend/src/hooks/). **Nessun dato mock** trovato.

| Pagina/Componente | Stato | Endpoint usati | Evidenza |
|---|---|---|---|
| Cassa.tsx | ✅ API reale | `/movimenti-cassa` (GET/PATCH/riconcilia) | hooks/useCassa.ts:6,18,31 |
| RegoleRiconciliazione.tsx | ✅ API reale | `/regole-riconciliazione*`, `/fatture-passive` | useRegoleRiconciliazione.ts:32-81 |
| Fatture.tsx | ✅ API reale | `/fatture-attive`, `/fatture-passive` (CRUD+incassa) | useFatture.ts:7-88 |
| Fornitori.tsx | ✅ API reale | `/fornitori-full`, `/categorie-fornitori`, CRUD | pages/Fornitori.tsx:46-85 |
| components/finance/* | ✅ API reale | imputazioni POST | ImputazioneCostiDrawer.tsx:114-125 |
| components/budget/* | ✅ API reale | `/budget*` | useBudget.ts:22-107 |
| Analytics.tsx | ✅ calcolo client-side su dati reali | commesse, fatture, timesheet, costi fissi, progetti | useAnalytics.ts:39-47 (margini ricalcolati in JS, **non** via `/report/marginalita`) |
| Reports.tsx | ✅ API reale | `/fatture-attive` + commesse | pages/Reports.tsx:166 |

> Nota: poiché Analytics/Reports ricalcolano i margini **lato client**, l'endpoint
> rotto `/report/marginalita` non è attualmente invocato dal frontend → il bug è
> latente ma reale (chiunque lo chiami via API riceve 500).

### 1.6 Costo orario / ore

> **AGGIORNAMENTO 2026-06 — Architettura overhead (anti doppio conteggio).**
> `calcola_costo_orario` ora calcola il **costo DIRETTO** per ora produttiva
> (lordo+contributi+TFR ÷ ore vendibili, con saturazione 70% + scorporo ferie/festivi/malattia).
> Il vecchio **markup ×1.30 di struttura è stato RIMOSSO**: era un overhead che, se cablato
> nel costing, sarebbe stato sottratto dal margine/P&L **in aggiunta** ai costi fissi di
> struttura (3845/mese) già sottratti dal P&L → doppio conteggio. Disinnescato **prima**
> dell'attivazione dei dati reali (al momento il ×1.30 era dead code: `calcola_costo_orario`
> senza caller, `costo_orario_calcolato` NULL su tutte le risorse, snapshot timesheet = `users.costo_orario`
> piatto → doppio conteggio quantificato = €0).
> L'overhead di struttura vive ora **solo nel pricing floor** via `calcola_tasso_overhead`
> (brief §3.3): `tasso = costi_fissi_indivisibili_mensili ÷ ore_produttive_mensili_team`,
> applicato ai soli ruoli **DIPENDENTE** (freelancer esclusi, tariffe già fully-loaded).
> Il P&L (`calcola_pl_gestionale`) e `calcola_tasso_overhead` condividono la stessa
> classificazione costi fissi (`costi_fissi_indivisibili_mese`) → i fissi sono contati una volta sola.

| Aspetto | Stato | Evidenza | Note |
|---|---|---|---|
| Logica costo orario DIRETTO | ✅ esiste (su `risorse`) | `calcola_costo_orario` (services.py) | Costo diretto: contributi + TFR + saturazione 70% + scorporo ferie/festivi/malattia. **Nessun overhead** (rimosso ×1.30). Distingue DIPENDENTE/FONDATORE/FREELANCER. Salvato in `risorse.costo_orario_calcolato` |
| Tasso overhead struttura (§3.3) | ✅ nuovo | `calcola_tasso_overhead` (services.py) | `costi_fissi_indivisibili ÷ ore_produttive_team`; usato dal pricing floor per i dipendenti, esposto separato nel breakdown. NON entra in margine/P&L |
| **Costo usato per il margine commessa** | ❌ disallineato | services.py:817-828 | `approva_timesheet` calcola `costo_lavoro` da **`users.costo_orario`** (campo piatto), NON dal fully-loaded di `risorse`. I due sistemi sono scollegati |
| Timesheet registra persona/cliente/progetto/ore/attività | ✅ | models.py:511-533 | `user_id` (persona), `commessa_id`→cliente, `task_id`→progetto, `durata_minuti` (ore), `servizio`/`task_display_name` (attività), `data_attivita` |
| timer_sessions | ✅ | models.py:493 | `task_id`, `user_id`, `started_at`/`stopped_at`, `durata_minuti`, `salvato_timesheet` |

---

## 2. Cosa è già pronto e riutilizzabile per il brief

- **Anagrafica risorse + costo orario fully-loaded**: `calcola_costo_orario`
  (services.py:2400) è già conforme alla spec "fully loaded" (lordo+contributi+TFR+overhead).
  Manca solo collegarlo al costing del timesheet.
- **CRUD fatture attive/passive** completo lato API e frontend (fic.py, useFatture.ts).
- **Motore regole di riconciliazione** (contains/startswith/regex) con `applica`,
  `dry-run` e `suggest` per importo (services.py:2094-2269). Pronto, manca solo l'input dati.
- **Sistema imputazioni** cliente/progetto in % su fatture passive e movimenti, con
  ereditarietà movimento←fattura (services.py:2344). Solido, ma scollegato dal margine (§Rischi).
- **Costi fissi** CRUD completo (router.py:403) + **Budget** mensile/variance/trend (router.py:2264).
- **Frontend finance** interamente su API reali, design già pronto (Cassa, Fatture,
  Fornitori, Regole, Budget, Analytics, Reports).
- **Scheletro sync FiC**: paginazione, upsert, gestione stati pagamento — codice valido,
  serve solo configurare le credenziali e decidere la sorgente della data incasso.
- **Coefficiente di allocazione costi indiretti** già modellato come
  `stipendi_operativi / overhead_produttivo` per mese (6 mesi già popolati).

---

## 3. Cosa manca del tutto (logica nuova da costruire)

1. **Import estratto conto bancario (CSV)** — inesistente. È il prerequisito #1 del
   brief: serve endpoint upload + parser + normalizzazione segno (Dare/Avere → ±) +
   creazione `movimenti_cassa`. Oggi non c'è alcun modo di far entrare un movimento reale.
2. **Riconciliazione molti-a-molti e parziale** — oggi è 1 movimento ↔ 1 fattura,
   tutto-o-niente. Servono: pagamenti multipli in un bonifico, pagamenti parziali
   (residuo), split. Richiede tabella di legame movimento↔fattura con importo.
3. **Data incasso esclusivamente da riconciliazione** — va rimossa la scrittura di
   `data_ultimo_incasso`/`data_ultimo_pagamento` dalla sync FiC (services.py:1600,1683)
   e resa unica sorgente la riconciliazione bancaria.
4. **Collegamento costo fully-loaded → timesheet → margine commessa** — far sì che
   `approva_timesheet` usi il costo orario di `risorse` (non `users.costo_orario`) e
   che `commessa.costo_manodopera`/`costi_diretti` vengano ricalcolati e persistiti.
5. **Propagazione imputazioni → margine** — far confluire `fatture_passive_imputazioni`
   / `movimenti_cassa_imputazioni` in `commessa.costi_diretti` (oggi le imputazioni si
   salvano ma non incidono su nessun KPI).
6. **Configurazione/attivazione FiC** — popolare credenziali e (se serve OAuth2)
   implementare l'effettivo uso di `FIC_ACCESS_TOKEN`/refresh, oggi ignorati.

---

## 4. Rischi / dati che si propagano se non sistemati prima

| # | Rischio | Dove | Impatto |
|---|---|---|---|
| R1 | **`/report/marginalita` va in 500**: `ca.coefficiente` non è una colonna (è `@property`). Verificato: `ERROR: column ca.coefficiente does not exist` | services.py:912,917,923 vs models.py:377 | Qualunque consumer dell'endpoint margine fallisce. La query va riscritta come `stipendi_operativi / NULLIF(overhead_produttivo,0)` |
| R2 | **Doppia sorgente per la data incasso**: sync FiC (paid_date) + riconciliazione (data_valuta) | services.py:1600/1683 e router.py:369 | Margini di cassa/incassato falsati e non riproducibili. Viola la spec ("solo da riconciliazione") |
| R3 | **Imputazioni non alimentano il margine**: `costi_diretti` su commessa è solo input manuale/seed, non deriva dalle imputazioni | services.py:79; assegnato solo a services.py:612,661 e seed | Si imputano costi che non compaiono in nessun KPI → falso senso di completezza |
| R4 | **Due definizioni di costo orario divergenti**: fully-loaded su `risorse` vs piatto su `users.costo_orario` | services.py:817-828 vs 2400 | Il costo manodopera nei margini NON è fully-loaded; sottostima i costi |
| R5 | **`commessa.costo_manodopera` stantio**: `approva_timesheet` non lo ricalcola/persiste; la marginalità SQL legge il valore stored | approva_timesheet services.py:822-839; lettura services.py:910 | Margini calcolati su manodopera non aggiornata dopo approvazione ore |
| R6 | **Dati fatture/movimenti sono seed, non reali**: sync FiC mai riuscita (0/1782), nessun import bancario | fic_sync_runs (tutte SKIPPED/ERROR); seed_boss_data.py | Ogni analisi finanziaria attuale è su dati fittizi. Da non scambiare per "funzionante in produzione" |
| R7 | **Log applicazione regole sempre vuoto**: l'endpoint legge `audit_log` azione `APPLICA` che `applica_regole_automatiche` non scrive mai | services.py:2193 vs 2094-2137 | Nessuna tracciabilità di cosa è stato auto-riconciliato |
| R8 | **Drift modello↔DB**: colonne nel DB non mappate (`fatture_passive.sconto/metodo_pagamento/note_interne`, `risorse.costo_orario_lordo`) | models.py:670/821 vs `information_schema` | Campi invisibili all'API; rischio di confusione su quale colonna è "verità" (es. `costo_orario_lordo` vs `costo_orario_calcolato`) |

---

### Metodo & comandi di verifica usati
- Tabelle/colonne reali: `docker exec -i bite_erp_db psql -U bite -d bite_erp -c "\dt"` e query su `information_schema.columns`.
- Stato sync: `SELECT status, count(*) FROM fic_sync_runs GROUP BY status` → 1133 SKIPPED + 649 ERROR, 0 successi.
- Bug margine confermato: `SELECT ca.coefficiente FROM coefficienti_allocazione ca LIMIT 1` → errore colonna inesistente.
- Config FiC: `printenv FIC_API_KEY` nel container e `.env` → entrambe lunghezza 0.
- Codice: ispezione di `backend/app/{api/v1,services,models}` e `frontend/src/{pages,hooks,components}`.
