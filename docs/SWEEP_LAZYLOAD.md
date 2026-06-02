# SWEEP — bug ricorrente "MissingGreenlet / lazy-load fuori greenlet"

> Analisi **read-only** (nessun codice modificato). Backend SQLAlchemy async, `expire_on_commit=False`
> (`db/session.py:28`). Data: 2026-06-03. Rif. `docs/AUDIT_GLOBALE.md`.

## Metodo di ricerca
1. **Trigger expire (variante a):** grep di `onupdate=func.now()` in `models.py` → quasi tutte le entità
   principali hanno `updated_at onupdate` (User, Cliente, Progetto, Commessa, Task, Timesheet, Fattura*,
   Fornitore, MovimentoCassa, CostoFisso, Preventivo, Pianificazione, BudgetMensile, WikiArticolo,
   ChatCanale/Messaggio, DocumentNode, CRMLead, TaskTemplate, …). **Nota empirica:** con asyncpg l'INSERT
   usa RETURNING → i POST popolano `created_at/updated_at` (niente expire). L'UPDATE **non** usa RETURNING
   per l'`onupdate`, ma — verificato sul campo — il solo `updated_at` espirato **raramente** causa 500
   (vedi sotto: 6 PATCH "solo scalari" tornano 200). Il 500 ricorrente reale è la **variante (b)**.
2. **Relazioni negli schemi (variante b):** grep dei campi `*Out` tipizzati come altro `*Out`/`List[*Out]`
   → mappa schema→relazione: `RisorsaOut.servizi`, `ProgettoOut.{servizi,team,cliente}`,
   `CommessaOut.{righe_progetto,cliente}`, `TaskOut.*` (già fixato), `FornitoreOut.categoria_rel`,
   `PreventivoOut.{voci,cliente}`, `PianificazioneOut.{cliente,lavorazioni}`, `BudgetMensileOut.categoria`,
   `WikiArticoloOut.categoria`, `CRMLeadOut.{stadio,attivita}`, `TimesheetOut.user`,
   `ChatCanaleOut.membri`, `ChatMessaggioRead.reazioni`, `StudioNodeOut`/`_node_to_dict` (children).
3. **Per ogni handler mutativo** (`@router.post|patch|put` in `api/v1/*.py`, ~80) ho letto il corpo per
   capire se PRIMA del return: (a) c'è `refresh`/re-fetch, (b) la query ha i `selectinload` per TUTTE le
   relazioni esposte. I service `update_*`/`_enrich`/`_hydrate` sono stati ispezionati di conseguenza.
4. **Conferma empirica** (dove esiste seed): PATCH/POST reale su un record esistente → osservato HTTP
   200/500 → **ripristino immediato del valore via SQL** (nessun dato sporco lasciato). Entità senza seed
   (preventivi, pianificazioni, budget_mensile) → classificate per sola analisi del codice.

## Pattern dominante confermato
`db.refresh(obj)` dopo il commit ricarica `updated_at` **ma NON carica le relazioni** (anzi le espira); se
lo schema `*Out` espone una relazione non eager-caricata, la serializzazione vi accede → lazy-load sync
fuori dal greenlet → **MissingGreenlet/500**. Fix collaudato: **re-fetch con `selectinload` di TUTTE le
relazioni dello schema** (come `documents._get_document_node_or_404`, `progetti.get_progetto_with_servizi`,
`risorse` re-fetch) invece di `refresh(obj)`.

## Punti a rischio

| ID | Entità | Endpoint/Service file:riga | Variante | Schema/relazione | Confermato 500? | Fix suggerito | Rischio fix |
|----|--------|-----------------------------|----------|-------------------|-----------------|---------------|-------------|
| L1 | Wiki | `router.py:2687-2710` `update_wiki_article_endpoint` (PATCH) | b | `WikiArticoloOut.categoria` (refresh non la carica) | **SÌ (500)** | dopo commit re-fetch `select(WikiArticolo).options(selectinload(WikiArticolo.categoria))` e ritornarlo (no `refresh`) | Basso |
| L2 | CRM | `router.py:2890-2912` `patch_crm_lead` (PATCH) | b | `CRMLeadOut.stadio`, `CRMLeadOut.attivita` | **SÌ (500)** | re-fetch con `selectinload(CRMLead.stadio, CRMLead.attivita)` (+ autori attività se servono) prima del return | Basso |
| L3 | Budget | `router.py:2377-2410` `upsert_budget_endpoint` (POST upsert) | b | `BudgetMensileOut.categoria` | **SÌ (500)** | re-fetch con `selectinload(BudgetMensile.categoria)` (riguarda l'UPSERT su riga esistente; il path INSERT idem) | Basso |
| L4 | Studio | `studio.py:605-656` `update_studio_node` (PATCH) | **a** (riclassificato) | NON una relazione: `_node_to_dict` legge solo colonne (`children:[]` hardcoded). `StudioNode.updated_at` (onupdate) espirata dal flush e letta da `_node_to_dict` nell'audit `dopo=` a `:652` prima del refresh | **SÌ (500)** → **RISOLTO** (FIX-LL-2) | `db.refresh(node)` subito dopo il flush (prima dell'audit) | Basso |
| L5 | Preventivi | `preventivi.py:51` POST, `:62` PATCH | b(+a) | `PreventivoOut.{voci,cliente}` | **già SAFE** — `create_/update_preventivo` (services.py:3672/3739) fanno già `return await get_preventivo()` (selectinload voci+cliente, updated_at fresco). **Validato 201/200** con record di test | nessun fix necessario | — |
| L6 | Pianificazioni | `pianificazioni.py:59/77/98` → `_hydrate` | a+b | `PianificazioneOut.{cliente,lavorazioni(+user),commessa}` | **lazy-load già SAFE** — `get_pianificazione` (pianificazione_service.py:63) fa `selectinload(cliente,commessa,lavorazioni.user)` e create/update/approve fanno `return await get_pianificazione()`. **MA POST/PATCH erano 400** per un bug SEPARATO (non lazy-load): `write_audit` non rendeva JSON-safe `UUID/Decimal` → INSERT audit_log fallito. **FIX-LL-3 ha corretto `write_audit`**. Validato 201/200 (lavorazioni.user serializzato) | (lazy-load) nessuno; audit: `_json_safe` in `write_audit` | Basso |
| L7 | CRM | `router.py:2841-2860` `create_crm_lead` (POST) | b | `CRMLeadOut.stadio/attivita` (fa `refresh(lead)` + selectinload parziale di `attivita`) | **non testato** (no cleanup) — sospetto, stesso schema di L2 | come L2: re-fetch con `selectinload(stadio, attivita)`, evitare `refresh` che le espira | Basso |
| L8 | CRM | `router.py:2953` `POST /crm/lead/{id}/attivita` (`CRMActivityOut`) | b | eventuale `CRMActivityOut.user`/autore non caricato | **non testato** | re-fetch con `selectinload` della relazione esposta | Basso |
| L9 | FiC | `fic.py:59-69` `PATCH /fatture-attive/{id}/incassa` | a | `FatturaAttivaOut` (solo `updated_at`, **nessuna** relazione) — nessun `refresh` | **non testato** (state-change invasivo) — **basso**: il fratello `PATCH /fatture-attive/{id}` (con refresh) e `PATCH /fatture-passive` tornano 200 | per coerenza `await db.refresh(fattura)` prima del return | Basso |

### Già fixato (escluso, citato per completezza)
`patch_cliente` (refresh+audit singolo), `_get_task_record`/`list_tasks` (selectinload attachments+rel),
`documents._get_document_node_or_404`+`_serialize_node` (selectinload children + re-fetch),
`patch_fornitore`/`update_cliente` (exclude_unset + refresh updated_at).

### Verificati SAFE in questo sweep (confermati 200, nessun fix)
`PATCH /costi-fissi/{id}` (200), `PATCH /movimenti-cassa/{id}` (200), `PATCH /fatture-passive/{id}` (200),
`PATCH /users/{id}` (200, `UserOut` senza relazioni), `PATCH /me` (refresh), `PATCH /crm/stadi/{id}`
(200, `CRMStageOut` senza relazioni), `PATCH /timesheet/{id}` (200), `POST /budget/categorie` (refresh,
nessuna relazione), `assenze` (refresh), `risorse` POST/PATCH (re-fetch selectinload servizi),
`risorse_servizi`, `progetti` POST/PATCH (`get_progetto_with_servizi` re-fetch), `commesse` POST/PATCH
(`_enrich_commessa`, già confermato 200 dall'audit area B), `chat` canali/messaggi (re-fetch selectinload
membri/reazioni), `timer` start/stop (audit area C 200), `studio /nodes` POST e `/nodes/move`
(re-fetch / dict in memoria deliberato).

## Riepilogo (aggiornato dopo FIX-LL-1/2/3)
- **Punti a rischio totali: 9** (L1–L9).
- **Confermati 500 e RISOLTI: 4** → L1 Wiki PATCH, L2 CRM lead PATCH, L3 Budget upsert POST (FIX-LL-1);
  L4 Studio nodes PATCH (FIX-LL-2, **riclassificato variante (a)**: updated_at espirata letta dall'audit,
  non una relazione).
- **L5, L6: già SAFE** (verificati con record di test in FIX-LL-3) — create/update delegano a `get_*` con
  selectinload completo; il fix prescritto era già implementato. Erano falsi positivi (seed vuoto).
- **L7 (CRM lead POST)** già corretto in FIX-LL-1; **L8** safe (nessuna relazione); **L9 FiC incassa**
  resta basso → **FIX-LL-4**.
- **Variante:** la (a) "solo updated_at" è quasi sempre innocua (asyncpg/RETURNING + molti PATCH scalari
  200); il 500 ricorrente reale è (b) relation-lazy. Eccezione: **L4 era (a)** (updated_at letta da un
  serializzatore prima del refresh).

### Bug SEPARATO scoperto in FIX-LL-3 (NON lazy-load) — già corretto
**`write_audit` (services.py) non rendeva JSON-safe i dict `dati_prima/dati_dopo`** (a differenza di
`audit.emit`): qualunque caller con `UUID/Decimal/date` → `TypeError: Object of type UUID is not JSON
serializable` sull'INSERT in `audit_log`. Effetto: **`POST/PATCH /pianificazioni` sempre 400**
(`create_/update_pianificazione` passano `data.model_dump()` con UUID). Fix: `write_audit` applica
`audit._json_safe` a prima/dopo (idempotente per i caller già sicuri). Validato: pianificazioni POST 201 /
PATCH 200.

## Proposta di lotti di fix (per file/entità, ordine consigliato)
1. **Lotto FIX-LL-1 — CRM + Wiki + Budget (tutti in `router.py`, confermati 500):** L1, L2, L3 (+L7, L8
   CRM nello stesso file). Pattern unico: sostituire `refresh(obj)` con re-fetch `selectinload(<relazioni
   dello schema>)`. Alto valore, rischio basso, un solo file. **Fare per primo.**
2. **Lotto FIX-LL-2 — Studio nodes (`studio.py`, confermato 500):** L4. Allineare `PATCH /nodes` al
   pattern di `POST /nodes` (re-fetch selectinload children) o dict senza relazioni.
3. **Lotto FIX-LL-3 — Preventivi + Pianificazioni — ✅ FATTO:** L5/L6 lazy-load erano **già safe**
   (validati con record di test). Unico fix reale: `write_audit` JSON-safe (sbloccava `POST/PATCH
   /pianificazioni` da 400). Vedi sopra.
4. **Lotto FIX-LL-4 — FiC incassa (`fic.py`, basso):** L9. Aggiungere `refresh(fattura)` per coerenza. — DA FARE.

> Stato: FIX-LL-1, FIX-LL-2, FIX-LL-3 completati. Resta FIX-LL-4 (L9).
