# Audit Sicurezza, Ruoli, Stack e Sostenibilita

Data audit: 2026-05-01

## Executive Summary

Il progetto ha una buona base tecnica moderna (`FastAPI` + `React` + `TypeScript` + `PostgreSQL`), ma oggi la separazione dei privilegi non e ancora affidabile rispetto alla regola di business desiderata:

- `ADMIN` deve accedere a tutto.
- `DIPENDENTE` deve accedere solo a `Studio OS` e non alla parte finanziaria.

Il rischio piu alto emerso e una catena concreta di takeover account: un utente autenticato puo caricare file `SVG`, il file viene servito dallo stesso origin dell'app, il frontend conserva il JWT in `sessionStorage`, e la CSP attuale consente ancora script inline/eval. In pratica un file malevolo puo portare al furto del token di un admin.

In parallelo, il backend non applica una policy RBAC coerente e centralizzata per l'area finance: alcune route sono protette, altre no, e molte continuano a considerare `PM` e `DEVELOPER` come full-access, mentre varie route budget/regole/imputazioni accettano qualsiasi utente autenticato.

Sul piano di sostenibilita, il progetto soffre di policy distribuite in file e router diversi, ruoli legacy ancora vivi, endpoint con `payload: dict` senza schema forte, e alcune scelte di deployment che aumentano il blast radius in caso di compromissione.

## Stato Correzioni Implementate

Aggiornamento eseguito in questa fase:

- bloccato l'upload di file `.svg`;
- introdotto un guard backend centralizzato `require_finance_access` con accesso finance riservato ad `ADMIN`;
- allineate le principali route finance e il routing frontend per nascondere/negare `Fatture`, `Cassa`, `Budget`, `Analytics`, `Report` e `Fornitori` ai non-admin;
- sostituito il JWT applicativo nel websocket chat con un ticket breve dedicato e validazione dell'`Origin`;
- smesso di salvare in chiaro i token di reset password, invalidando anche quelli precedenti quando ne viene emesso uno nuovo;
- aggiunti test unitari base sulle regole RBAC e sui nuovi token scoped.

Restano comunque da completare i punti di object-level authorization su `Studio OS`, il rafforzamento del rate limiting non in-memory, e la normalizzazione dei ruoli legacy `PM` / `DEVELOPER`.

## Matrice Ruoli Raccomandata

Target minimo consigliato:

- `ADMIN`: accesso completo a finance, operations, utenti, report, Studio OS.
- `DIPENDENTE`: accesso a `Studio OS`, chat, proprio profilo, propri timesheet, documenti/wiki solo se previsti dal workflow.
- `COLLABORATORE` e `FREELANCER`: stesso perimetro di `DIPENDENTE`, con eventuali limiti ulteriori per progetto/cliente.
- `PM` e `DEVELOPER`: non devono restare ruoli "ibridi" impliciti. O diventano permessi espliciti, o vengono mappati temporaneamente ad `ADMIN` solo se davvero necessario.

Permessi consigliati a livello tecnico:

- `studio.read`
- `studio.write`
- `finance.read`
- `finance.write`
- `users.manage`
- `reports.read`
- `admin.full`

Se il vincolo di business e "solo admin vede finance", allora nessun ruolo diverso da `ADMIN` deve avere `finance.read` o `finance.write`.

## Findings Critici

### CRIT-01 - Stored XSS via upload con possibile takeover di account admin

- **Severity:** Critical
- **Location:** `backend/app/api/v1/uploads.py:15-21`, `backend/app/api/v1/uploads.py:34-96`, `backend/app/main.py:38-40`, `backend/app/main.py:73-79`, `backend/nginx.conf:94-99`, `frontend/src/hooks/useAuth.ts:13-15`, `frontend/src/lib/api.ts:10-15`
- **Evidence:** l'upload consente `.svg`; i file vengono salvati sotto `static/uploads` e restituiti come URL pubblici `/static/uploads/...`; l'app monta `/static` sullo stesso origin; la CSP consente `script-src 'self' 'unsafe-inline' 'unsafe-eval'`; il token applicativo viene conservato in `sessionStorage`.
- **Impact:** un utente autenticato puo caricare un `SVG` malevolo e farlo aprire a un admin; il file puo eseguire JavaScript nello stesso origin e leggere/esfiltrare il JWT, ottenendo accesso completo all'ERP.
- **Fix:**
  - rimuovere subito `.svg` dagli upload consentiti;
  - servire gli upload non trusted da dominio separato o solo come attachment download;
  - eliminare `unsafe-inline` e `unsafe-eval` dalla CSP appena compatibile con il frontend;
  - non conservare il bearer token in `sessionStorage` come misura strategica di medio periodo.
- **Mitigation immediata:** bloccare `SVG`, ruotare i token attivi se il sistema e gia stato usato da molti utenti, e considerare forzatura del logout.
- **False positive notes:** il rischio cala solo se `/static/uploads` non e servito come contenuto attivo sullo stesso origin, cosa che qui non risulta dal codice.

## Findings Alti

### HIGH-01 - RBAC finance incoerente con la regola "solo admin tutto / dipendente solo Studio OS"

- **Severity:** High
- **Location:** `backend/app/models/models.py:17-25`, `frontend/src/components/layout/AppSidebar.tsx:54-57`, `backend/app/api/v1/router.py:591-600`, `backend/app/api/v1/router.py:639-679`, `backend/app/api/v1/router.py:2321-2483`
- **Evidence:**
  - il modello ruoli considera `DEVELOPER` full-access e mantiene `PM` come ruolo legacy ancora operativo;
  - il frontend considera `ADMIN`, `DEVELOPER`, `PM` come ruoli con accesso completo;
  - varie route finance usano solo `Depends(get_current_user)` invece di un guard dedicato:
    - `PATCH /regole-riconciliazione/{regola_id}`
    - `DELETE /regole-riconciliazione/{regola_id}`
    - `GET/POST /movimenti-cassa/{id}/imputazioni`
    - `POST /fatture-passive/{id}/imputazioni`
    - tutte le route `/budget*` mostrate nel blocco `2321-2483`
- **Impact:** un utente autenticato non admin puo leggere e modificare dati finanziari chiamando direttamente le API, anche se il frontend cerca di limitare la navigazione.
- **Fix:**
  - introdurre dipendenze centralizzate `require_finance_access()` e `require_studio_access()`;
  - applicare `deny by default` su tutti i router finance;
  - riallineare i ruoli legacy alla policy reale;
  - aggiungere test automatici della matrice ruolo x endpoint.
- **Mitigation:** bloccare subito lato backend le route budget/regole/imputazioni per i ruoli non admin.
- **False positive notes:** la UI puo nascondere moduli, ma questo non protegge l'API.

### HIGH-02 - Studio OS espone troppa visibilita orizzontale tra utenti

- **Severity:** High
- **Location:** `backend/app/api/v1/studio.py:93-127`, `backend/app/api/v1/studio.py:200-239`
- **Evidence:**
  - i task commenti sono leggibili e scrivibili da qualsiasi utente autenticato solo conoscendo `task_id`;
  - la migrazione imposta client, project e task come `is_private=False`;
  - la gerarchia `GET /studio/hierarchy` restituisce tutti i nodi pubblici a qualunque utente autenticato.
- **Impact:** dipendenti e collaboratori possono vedere metadati operativi di clienti/progetti/task non assegnati e interagire su task fuori dal proprio perimetro.
- **Fix:**
  - ACL per progetto/cliente/team, non solo `public/private`;
  - check di membership/assignment su commenti e dettaglio task;
  - default `private` per nodi sensibili o almeno per clienti/progetti non assegnati.
- **Mitigation:** limitare temporaneamente la vista Studio OS agli oggetti assegnati o al team dell'utente.

### HIGH-03 - WebSocket chat autenticato con token in query string e senza validazione Origin

- **Severity:** High
- **Location:** `frontend/src/context/ChatContext.tsx:110-113`, `backend/app/api/v1/chat.py:306-317`
- **Evidence:** il client apre `ws://.../api/v1/chat/ws?token=...`; il server accetta la connessione e valida solo il token, senza controllo `Origin`.
- **Impact:** il token puo finire nei log di reverse proxy, tracing e monitoring; inoltre manca una difesa esplicita contro connessioni cross-origin con token rubati.
- **Fix:**
  - usare ticket WebSocket effimeri generati lato API;
  - validare `Origin` rispetto agli origin frontend consentiti;
  - ridurre la durata utile dei token usati per il bootstrap del websocket.
- **Mitigation:** sanificare i log e bloccare la stampa della query string negli stack di proxy/osservabilita.

## Findings Medi

### MED-01 - Reset password con token in chiaro nel DB e rate limit non condiviso tra worker

- **Severity:** Medium
- **Location:** `backend/app/api/v1/auth.py:27-43`, `backend/app/api/v1/auth.py:86-93`, `backend/app/api/v1/auth.py:160-180`, `backend/Dockerfile:38`
- **Evidence:** i token di reset vengono salvati in chiaro in `password_reset_tokens`; il rate limit login e in memoria di processo; il backend gira con piu worker Uvicorn.
- **Impact:** chi ottiene accesso read-only al DB puo usare token di reset ancora validi; il brute-force protection puo essere aggirato distribuendo i tentativi tra worker o dopo un restart.
- **Fix:**
  - salvare hash del reset token, non il token raw;
  - usare Redis o DB per rate limiting condiviso;
  - aggiungere pulizia/rotazione periodica dei token di reset.
- **Mitigation:** ridurre la finestra di validita dei token e monitorare richieste ripetute da IP/account.

### MED-02 - Hardening container e file statici insufficiente

- **Severity:** Medium
- **Location:** `backend/Dockerfile:30-33`, `backend/app/main.py:38-40`, `backend/nginx.conf:94-99`, `backend/docker-compose.prod.yml:42-49`
- **Evidence:** la directory `static` viene resa `777`; gli upload sono serviti come file first-party pubblici; i volumi statici sono montati direttamente nel backend.
- **Impact:** in caso di RCE, dipendenza compromessa o abuso applicativo, l'attaccante ha superfici pubbliche gia pronte da alterare e servire.
- **Fix:**
  - sostituire `777` con permessi minimi necessari;
  - separare upload non trusted da avatar/loghi trusted;
  - usare storage object dedicato o almeno directory separate con policy diverse.
- **Mitigation:** scansione antivirus opzionale e checksum/logging sui file caricati.

### MED-03 - Endpoint con `payload: dict` e aggiornamenti dinamici senza schema forte

- **Severity:** Medium
- **Location:** `backend/app/api/v1/router.py:469-489`, `backend/app/api/v1/router.py:591-600`, `backend/app/api/v1/router.py:656-679`
- **Evidence:** diversi endpoint accettano `dict` generici; `patch_movimento_cassa` applica dinamicamente ogni chiave che coincide con un attributo del modello.
- **Impact:** il codice diventa difficile da validare, testare e mettere in sicurezza; aumentano i rischi di mass assignment, side effect non previsti e regressioni di autorizzazione.
- **Fix:**
  - sostituire i `dict` con modelli Pydantic dedicati;
  - rifiutare campi extra;
  - usare allowlist per gli attributi modificabili.
- **Mitigation:** log di audit dettagliati per ogni campo cambiato fino al refactor completo.

### MED-04 - Parent ownership non verificata nella creazione documenti

- **Severity:** Medium
- **Location:** `backend/app/api/v1/documents.py:106-142`
- **Evidence:** la creazione verifica l'esistenza del parent ma non che il parent appartenga all'utente o sia condivisibile.
- **Impact:** un utente puo agganciare contenuti propri sotto cartelle altrui se conosce `parent_id`, creando confusione o iniezione di contenuti in alberi non suoi.
- **Fix:** aggiungere check di ownership o ACL sul parent prima della creazione/move.
- **Mitigation:** loggare i create/move cross-user e bloccare parent non owned per default.

## Findings Bassi

### LOW-01 - Hygiene dipendenze frontend da aggiornare

- **Severity:** Low
- **Location:** `frontend/package.json:37`, `frontend/package.json:67`, `backend/requirements.txt:1-25`
- **Evidence:** `npm audit --json` ha segnalato 3 advisory moderate su `axios`, `follow-redirects` e `postcss`; nel backend le versioni risultano ragionate, ma non e stato possibile eseguire `pip-audit` nel workspace per assenza del tool.
- **Impact:** rischio supply-chain non immediatamente critico, ma crescente nel tempo.
- **Fix:**
  - aggiornare `axios` a una release non vulnerabile;
  - rigenerare il lockfile per ricevere la fix transitiva di `follow-redirects`;
  - aggiornare `postcss` oltre la versione vulnerabile;
  - introdurre audit automatico in CI.
- **Mitigation:** usare `npm ci`, alert automatici e finestra patch mensile.

## Gap di Sostenibilita e Architettura

- Le policy autorizzative sono sparse tra `router.py`, router modulari, frontend e commenti nel model dei ruoli.
- Esistono ruoli legacy (`PM`, `FREELANCER`) ancora attivi nel codice ma gia dichiarati deprecati.
- Il file `backend/app/api/v1/router.py` concentra molte responsabilita sensibili e rende facile introdurre nuovi endpoint senza guard corretti.
- `AUTO_CREATE_MISSING_TABLES=True` in configurazione (`backend/app/core/config.py:18`) e utile in sviluppo ma non e una buona pratica di sostenibilita in produzione.
- La produzione usa ancora `env_file: .env` in compose (`backend/docker-compose.prod.yml:42-43`): meglio secret manager o variabili iniettate dall'infrastruttura.

## Piano di Bonifica Raccomandato

### Fase 0 - Urgente (oggi / 24h)

1. Rimuovere `.svg` dagli upload e servire gli upload non trusted come download, non come contenuto attivo.
2. Bloccare lato backend tutte le route finance per ruoli diversi da `ADMIN`.
3. Allineare subito budget/regole/imputazioni alla policy desiderata.
4. Sanitizzare eventuali log/proxy che oggi potrebbero conservare `?token=` del websocket.

### Fase 1 - Priorita Alta (2-5 giorni)

1. Introdurre una matrice permessi centralizzata con dependency FastAPI dedicate.
2. Scrivere test automatici per:
   - `ADMIN` accesso completo
   - `DIPENDENTE` solo Studio OS
   - `COLLABORATORE/FREELANCER` perimetro limitato
   - nessun accesso finance per ruoli studio-only
3. Hashare i password reset token e spostare il rate limit su storage condiviso.
4. Aggiungere check membership/assignment alle route Studio e commenti task.

### Fase 2 - Rafforzamento Strutturale (1-2 settimane)

1. Sostituire i ruoli legacy con permessi espliciti.
2. Ridurre o eliminare `sessionStorage` per il token applicativo.
3. Spostare upload/avatar/loghi su storage separati con policy distinte.
4. Spezzare `router.py` in router di dominio con guard comuni per evitare regressioni future.

## Conclusione

Il progetto puo essere messo in sicurezza in modo pragmatico senza riscriverlo, ma oggi i due assi piu urgenti sono:

1. chiudere la catena `upload -> XSS -> furto token`;
2. rendere il backend l'unica fonte di verita sui permessi finance vs Studio OS.

Finche questi due punti non vengono chiusi, la regola "admin vede tutto, dipendente solo Studio OS" non puo essere considerata affidabile dal punto di vista security.
