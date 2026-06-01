# WIP STATUS — Modifiche non committate nel working tree

> Analisi di sola ispezione (nessuna modifica, nessun commit, nessun stash).
> Stato git al momento dell'analisi: branch `main`, ultimo commit `6f520d1` (R3).
> Scopo: mettere in sicurezza il WIP pre-esistente prima del prossimo task
> ("endpoint margine come FONTE UNICA + frontend"), che riscriverà proprio le
> funzioni margine qui modificate → rischio di collisione diretta.

Totale: **23 file tracked modificati** (+341 / −374) + 1 cancellato + 2 untracked.
I file NON sono mono-tema: `router.py` e `timesheet.py` mescolano più temi nello
stesso file (vedi §Strategia).

---

## Gruppi di modifiche non committate (tema | file | stato | rischio)

| Tema | File:riga | Cosa fa | Completo? | In-scope finanza | Rischio durante task margine |
|---|---|---|---|---|---|
| **A. Refactor MARGINE** | [commesse.py:6](../backend/app/api/v1/commesse.py) (`MARGINE_CRITICAL_PCT/WARNING_PCT`), [commesse.py:45-56](../backend/app/api/v1/commesse.py) (`_enrich_commessa`), [commesse.py:129](../backend/app/api/v1/commesse.py) (`get_commessa_profitability`) | Riscrive il calcolo margine: esplicita `margine = fatturabile − manodopera − costi_diretti − costi_indiretti`; usa `costi_diretti_totali` (R3) e soglie costanti | Completo ma **dipende da R3** (`costi_diretti_totali` esiste solo da `6f520d1`) | **Sì** | **ALTO** — il prossimo task riscrive queste stesse funzioni |
| **A. Refactor MARGINE** | [timesheet.py:11](../backend/app/api/v1/timesheet.py) (import costanti), [timesheet.py:62-66](../backend/app/api/v1/timesheet.py) (`_check_margin_and_notify`) | Aggiunge `costi_indiretti` al margine di notifica, usa `costi_diretti_totali`, importa le soglie da commesse.py | Completo, dipende da R3 | Sì | ALTO (stesso motivo + import incrociato commesse↔timesheet) |
| **B. Refactor RUOLI PM→DEV/COLLAB** | [assenze.py](../backend/app/api/v1/assenze.py) (5 endpoint), [documents.py:?](../backend/app/api/v1/documents.py), [preventivi.py](../backend/app/api/v1/preventivi.py) (5 endpoint), [notification_service.py](../backend/app/services/notification_service.py), [timesheet.py:84](../backend/app/api/v1/timesheet.py) (recipient notifiche) | Sostituisce `UserRole.PM` con `DEVELOPER`/`COLLABORATORE` nei permessi + `.dict()`→`.model_dump()` | **INCOMPLETO/INCOERENTE** (vedi sotto) | No (auth/HR) | MEDIO — tocca `timesheet.py` (stesso file del tema A) → entanglement |
| **C. Cleanup AUTH/email** | [router.py:6-13](../backend/app/api/v1/router.py) (import), [router.py:147-260](../backend/app/api/v1/router.py) (corpi legacy forgot/reset) | Rimuove codice morto irraggiungibile (gli endpoint erano già `__legacy_disabled__` → 410) + import inutilizzati (`fastapi_mail`, `PIL`, `secrets`, `shutil`, `io`, `os`, `password_reset_history`, `list_users`…) | **Completo e SICURO** | No | BASSO |
| **D. Config hardening** | [router.py:837-895](../backend/app/api/v1/router.py) (ClickUp → `settings.CLICKUP_*`), [ai.py:?](../backend/app/api/v1/ai.py) (modello default `claude-3-5-sonnet`→`claude-sonnet-4-6` + warning) | Sposta costanti hardcoded in `settings`; aggiorna modello AI | Completo (se `settings` ha i campi CLICKUP_*) | No | BASSO |
| **E. Fix FINANCE** | [router.py:380](../backend/app/api/v1/router.py) (`'paid'`→`'PAGATA'`), [router.py:2124](../backend/app/api/v1/router.py) (budget variance `or_`→`and_`) | Coerenza stato pagamento riconciliazione; fix filtro costi fissi attivi nel budget | Completo | **Sì** | BASSO-MEDIO (tocca finanza, ma non il margine) |
| **F. Frontend formatEuro DRY** | [lib/utils.ts](../frontend/src/lib/utils.ts) (+`formatEuro`/`formatEuroDecimal`), [Reports.tsx](../frontend/src/pages/Reports.tsx), [Analytics.tsx](../frontend/src/pages/Analytics.tsx) (usano lo shared) | Consolida il formatter € condiviso | Completo | Sì (display) | BASSO |
| **G. Frontend CommessaDetail redesign** | [CommessaDetail.tsx](../frontend/src/pages/CommessaDetail.tsx) (+289/−~) | Redesign pagina dettaglio commessa: consuma l'endpoint `profitability` (margine, % ore budget) | Da verificare visivamente | Sì (display margine) | MEDIO — consuma valori dal backend margine (tema A) |
| **H. Frontend misc** | [useAnalytics.ts](../frontend/src/hooks/useAnalytics.ts) (`allTimesheets`), [FatturaModal.tsx](../frontend/src/components/finance/FatturaModal.tsx), [Fatture.tsx](../frontend/src/pages/Fatture.tsx), [Commesse.tsx](../frontend/src/pages/Commesse.tsx)/[Dashboard.tsx](../frontend/src/pages/Dashboard.tsx)/[Progetti.tsx](../frontend/src/pages/Progetti.tsx) (+2 cad.), [CRM.tsx](../frontend/src/pages/CRM.tsx), [Collaboratori.tsx](../frontend/src/pages/Collaboratori.tsx), [CRMStats.tsx](../frontend/src/components/crm/CRMStats.tsx), [StudioGanttView.tsx](../frontend/src/components/studio/StudioGanttView.tsx) | Ritocchi UI assortiti (nessun cambio ruoli lato FE) | Vari | Parz. | BASSO |
| **I. Cleanup/misc** | `frontend/src/components/chat/fix_chat.py` (**cancellato**) | Era uno script Python usa-e-getta (manipolava ChatInput.tsx) — rimozione corretta | Completo | No | NULLO |
| **I. Untracked** | `docs/AUDIT_FINANZA.md` (nostro, sessione audit), `.analysis/bug_report.md` (pre-esistente, 26KB, non nostro) | Artefatti di analisi | — | parz. | NULLO (non interferiscono col codice) |

### Dettaglio: perché il tema B (ruoli) è INCOMPLETO/INCOERENTE
Il refactor sostituisce `PM` solo in 5 file, ma `UserRole.PM` resta usato (e grant-ato)
in molti file NON toccati nel working tree:
- [security.py:23](../backend/app/core/security.py) (PM ancora nel set base), [risorse.py:50,76](../backend/app/api/v1/risorse.py), [risorse_servizi.py:30,51](../backend/app/api/v1/risorse_servizi.py), [users.py:131](../backend/app/api/v1/users.py), [router.py:2017](../backend/app/api/v1/router.py) (notifiche ancora `ADMIN, PM`), [services.py:2713,2735](../backend/app/services/services.py) (**approvazione timesheet** ancora `ADMIN, PM`), [pianificazione_service.py:197](../backend/app/services/pianificazione_service.py), `clienti.py` (7), `pianificazioni.py` (7), `ai.py:305`.

→ Autorizzazioni **incoerenti**: un PM perde l'accesso ad assenze/preventivi/documenti
ma mantiene risorse/HR, approvazione ore, ecc. `UserRole.PM` esiste ancora nell'enum e
nel seed. **Questo refactor non va committato così com'è**: o si completa su tutti i file,
o si tiene da parte finché non si decide il modello ruoli.

---

## Il refactor margine confligge con R1/R3? — **NO (in definizione), SÌ (come duplicazione/base manodopera)**

**Non c'è conflitto di definizione.** Il refactor margine (tema A) **usa** `costi_diretti_totali`
(la property R3) e la **stessa** formula strutturale di R1/R3
(`ricavo − manodopera − costi_diretti − costi_indiretti`, con `indiretti = manodopera × coefficiente`).
È anzi **dipendente da R3**: senza il commit `6f520d1` (property `costi_diretti_totali`) questi
file non girano. Quindi è allineato, non contraddittorio.

**Due conflitti REALI restano, rilevanti per il task "FONTE UNICA":**

1. **Duplicazione della formula margine in 4 punti.** Oggi il margine è calcolato a mano in:
   - [services.py:`get_marginalita_clienti`](../backend/app/services/services.py) (SQL, R1) — **base manodopera = `commessa.costo_manodopera` (snapshot approvati)**.
   - [services.py:`calcola_metriche_commessa`](../backend/app/services/services.py) — idem snapshot.
   - [commesse.py:`_enrich_commessa`](../backend/app/api/v1/commesse.py) (WIP) — **base manodopera = `costo_manodopera_calc` (TUTTI i timesheet, live)**.
   - [timesheet.py:`_check_margin_and_notify`](../backend/app/api/v1/timesheet.py) (WIP).
   Il task FONTE UNICA dovrà accentrarle: queste copie WIP **collideranno** (vanno rimosse/riconciliate).

2. **Base manodopera divergente.** `_enrich_commessa` (WIP) usa la manodopera di **tutti** i
   timesheet (`costo_manodopera_calc`), mentre il report R1 usa lo **snapshot approvati**
   (`commessa.costo_manodopera`). → Per la stessa commessa con ore non approvate, il margine
   della pagina dettaglio ≠ margine del report. La FONTE UNICA deve scegliere una sola base.

**Intreccio delle mie 3 righe R3 "vista live":** sono `costi_diretti = c.costi_diretti_totali`
in [commesse.py:48](../backend/app/api/v1/commesse.py) e [commesse.py:129](../backend/app/api/v1/commesse.py),
e `costi_diretti = float(c.costi_diretti_totali)` in [timesheet.py:64](../backend/app/api/v1/timesheet.py).
Stanno **dentro** i blocchi riscritti dal refactor margine (tema A): non separabili dal refactor
senza rompere il codice (la variabile `costi_diretti`/`costi_indiretti` esiste solo nella versione
riscritta). Per questo al Prompt R3 sono rimaste non committate.

---

## Strategia di separazione consigliata (proposta — NON eseguita)

Principio: i file mono-tema si committano puliti; i file multi-tema (`router.py`, `timesheet.py`)
richiedono split a livello di hunk (`git add -p`, qui non disponibile in modalità non-interattiva
→ da fare a mano dall'utente o con patch mirate).

**1. Branch/commit `finance/margine-consolidation` — DA FARE PRIMA del task FONTE UNICA**
   - `commesse.py` (tema A, intero — è mono-tema margine) + la parte margine di `timesheet.py`.
   - Razionale: il prossimo task riscrive queste funzioni; committarle ora dà una base nota e
     preserva le mie righe R3. Idealmente il task FONTE UNICA parte da qui e **dedup** verso un
     unico helper, risolvendo la base-manodopera divergente.
   - Ostacolo: `timesheet.py` contiene anche il tema B (recipient ruoli) → split hunk necessario,
     oppure si accetta di portarsi dietro quella riga e la si scorpora nel commit ruoli.

**2. Commit `chore/auth-email-cleanup` (tema C) — sicuro, standalone**
   - Solo gli hunk auth/email di `router.py`. Nessuna dipendenza, nessun rischio (endpoint reali
     in `auth.py`, usati dal frontend). Split hunk da `router.py`.

**3. Commit `fix/finance-misc` (tema E) — finanza, basso rischio**
   - Hunk di `router.py`: `'paid'`→`'PAGATA'` e budget `or_`→`and_`. Va con l'area finanza.

**4. Commit `chore/config-hardening` (tema D)**
   - Hunk ClickUp→settings di `router.py` + `ai.py`. Verificare prima che `settings` esponga
     `CLICKUP_BASE_URL`/`CLICKUP_TEAM_ID`/`CLICKUP_API_TOKEN`.

**5. Tema B (ruoli) — NON committare as-is: completare o accantonare**
   - È incompleto/incoerente (vedi sopra). Opzioni: (a) completare PM→DEV/COLLAB su TUTTI i file
     elencati + decidere il destino di `UserRole.PM` nell'enum, poi un commit unico
     `refactor/roles`; oppure (b) tenerlo da parte (branch dedicato) finché non si valida il
     modello ruoli. Da NON mischiare col task margine.

**6. Frontend**
   - `feat/format-euro-shared` (tema F): `lib/utils.ts` + `Reports.tsx` + `Analytics.tsx`. Standalone, basso rischio.
   - `feat/commessa-detail-redesign` (tema G): `CommessaDetail.tsx` — va col task frontend margine
     (consuma `profitability`); verificare dopo che il backend margine è consolidato.
   - Tema H: ritocchi minori, committabili a parte o insieme al rispettivo modulo.

**7. Untracked / cancellati**
   - `frontend/src/components/chat/fix_chat.py` (cancellato): ok rimuovere (script usa-e-getta).
   - `docs/AUDIT_FINANZA.md` (nostro): committare nei docs.
   - `.analysis/bug_report.md`: pre-esistente, decidere se versionarlo o ignorarlo (`.gitignore`).

### Priorità minima per sbloccare il task margine senza incidenti
Prima del prossimo task: **mettere in sicurezza il tema A** (commesse.py + parte margine di
timesheet.py, che contengono le righe R3) e **isolare il tema B** (ruoli) da timesheet.py, così
che il refactor margine non si trascini dietro un refactor ruoli incompleto. I temi C/D/E/F/G/H
non bloccano ma conviene committarli per ridurre il rumore nel working tree.
