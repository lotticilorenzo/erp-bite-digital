# Enterprise Readiness Plan

Data: 2026-05-01

## Executive summary

Lo stack ha una base moderna e credibile per PMI e mid-market, ma per essere vendibile a strutture enterprise servono alcuni requisiti che oggi sono solo parzialmente coperti: identity federation, permission model piu preciso dei soli ruoli, audit e privacy piu governabili, baseline operativa di produzione piu esplicita e un percorso SDLC verificabile.

In questa fase il progetto ha gia compiuto passi importanti:

- separazione forte dell'area finance lato backend;
- object-level authorization piu solida su Studio OS e documenti;
- upload piu sicuri e websocket chat meno esposti;
- revoca globale delle sessioni JWT;
- export dati utente piu strutturato e meno demo.

Per un buyer enterprise, pero, il livello target non e solo "sicuro abbastanza": deve essere anche integrabile, auditabile e governabile.

## Riferimenti ufficiali usati

- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Multifactor Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- OWASP Content Security Policy Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OpenID Connect Core 1.0: https://openid.net/specs/openid-connect-core-1_0.html
- SCIM 2.0 Core Schema RFC 7643: https://datatracker.ietf.org/doc/html/rfc7643
- NIST SP 800-63 Digital Identity Guidelines: https://www.nist.gov/identity-access-management/nist-special-publication-800-63-digital-identity-guidelines
- NIST SSDF SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final
- European Commission, right to data portability: https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en

## Dove siamo oggi

### 1. Identity e accessi

Punti buoni:

- auth centralizzata con JWT;
- separazione finance gia forzata ad `ADMIN`;
- studio-only roles piu limitati lato backend;
- revoca globale dei token introdotta tramite `token_version`.

Gap enterprise:

- niente SSO enterprise via OIDC o SAML;
- niente provisioning/deprovisioning SCIM;
- niente MFA o step-up auth per azioni sensibili;
- ruoli legacy ancora presenti (`PM`, `DEVELOPER`, `FREELANCER`);
- modello ancora troppo role-based e poco permission-based.

Target enterprise:

- federazione identity con OIDC come default e SAML come opzione per tenant che la richiedono;
- provisioning utenti e gruppi via SCIM 2.0;
- MFA obbligatoria per `ADMIN` e per accesso a funzioni sensibili;
- passaggio da ruoli larghi a permessi granulari.

### 2. Authorization e segregazione dati

Punti buoni:

- finance separata dagli utenti studio-only;
- Studio OS e documenti hanno ora object-level authorization molto piu robusta.

Gap enterprise:

- la matrice permessi non e ancora dichiarata in un punto unico;
- esistono ancora endpoint e servizi con logiche legacy legate a `PM` e `DEVELOPER`;
- manca una distinzione esplicita tra permessi applicativi, permessi amministrativi e permessi di supporto tecnico.

Target enterprise:

- matrice centrale `permission -> endpoints -> UI sections -> audit scope`;
- deny-by-default su ogni area sensibile;
- policy object-level per progetto, task, timesheet, documenti, audit, HR e finance;
- ruoli business standardizzati, per esempio:
  - `ADMIN`
  - `OPERATIONS_MANAGER`
  - `TEAM_MEMBER`
  - `EXTERNAL_COLLABORATOR`
  - `READONLY_AUDITOR`

### 3. Privacy, audit e compliance

Punti buoni:

- audit log gia presente nel modello dati;
- export dati utente migliorato;
- token reset password non piu in chiaro.

Gap enterprise:

- export utente ancora orientato a singolo account, non a DSAR completo o amministrato;
- workflow cancellazione account non ancora implementato;
- audit log non ancora classificato per retention, esportazione, integrita e integrazione SIEM;
- manca una policy chiara su retention dei log, retention documentale e backup restore.

Target enterprise:

- DSAR workflow vero: export, rettifica, sospensione, cancellazione dove legalmente possibile;
- audit log con retention configurabile, filtri avanzati ed export firmato;
- separazione tra audit applicativo, security logging e operational logging;
- manuale privacy e runbook per data breach e incident handling.

### 4. Secure production baseline

Punti buoni:

- docs API gia disattivabili in produzione;
- middleware di security headers presente;
- rate limit login di base presente;
- dipendenze backend gia curate su alcune CVE note.

Gap enterprise:

- token applicativo ancora in `sessionStorage`;
- CORS e host validation vanno gestiti in modo piu rigoroso tenant per tenant;
- la baseline di produzione non include ancora secret rotation, SIEM integration, vuln scanning CI e restore drills formalizzati;
- mancano controlli di availability e disaster recovery dichiarati come RPO e RTO.

Target enterprise:

- token applicativi gestiti con approccio piu resistente all'XSS, idealmente BFF o cookie `HttpOnly` con CSRF ben progettato;
- host validation, HSTS e config prod esplicite per ambiente;
- backup cifrati, restore testati, runbook e SLO;
- CI/CD con dependency audit, migration checks, test RBAC e release evidence.

## Roadmap consigliata

### Fase 1: hardening vendibile subito

- Completare la matrice ruoli e permessi lato backend e frontend con una whitelist centrale.
- Eliminare tutti i mock residui nelle aree account, privacy e audit.
- Mettere in CI:
  - test RBAC
  - dependency audit
  - migration validation
  - build frontend
- Definire env di produzione obbligatorie: `APP_ENV`, `TRUSTED_HOSTS`, secret forti, docs disabilitate.

### Fase 2: enterprise IAM

- Aggiungere OIDC SSO per Google Workspace, Microsoft Entra ID e provider custom.
- Aggiungere MFA per admin e sensitive operations.
- Aggiungere SCIM per provisioning e deprovisioning utenti e gruppi.
- Introdurre permessi granulari come `finance.read`, `finance.write`, `studio.read`, `studio.manage`, `audit.read`, `user.manage`.

### Fase 3: compliance e governance

- DSAR completo con export esteso e workflow cancellazione controllata.
- Audit log esportabile e ingestibile da SIEM.
- Policy di retention per audit, documenti, chat e reset token.
- Evidence pack per buyer enterprise: architettura, backup, runbook, controlli IAM, test strategy.

### Fase 4: operativita enterprise

- SLO, alerting, error budget, health checks reali;
- restore drill periodici;
- segregazione ambienti dev, staging e prod;
- onboarding multi-tenant e domini custom dove richiesto dal mercato target.

## Decisione architetturale consigliata

La direzione migliore per la vendibilita enterprise e questa:

1. Nel breve: tenere l'attuale JWT header-based ma chiudere tutti i gap residui di autorizzazione e auditing.
2. Nel medio: introdurre un permission model centrale e SSO OIDC.
3. Nel medio-avanzato: portare auth web su BFF o cookie `HttpOnly` dove il prodotto richiede maggiore resistenza all'XSS.
4. Nel lungo: aggiungere SCIM, MFA forte e capability multi-tenant governate.

## Nota importante

Questa roadmap e un'inferenza progettuale costruita sullo stato attuale del repository e sui requisiti tipici richiesti da clienti enterprise, allineata ai riferimenti ufficiali sopra elencati. Non sostituisce una certificazione o una gap analysis legale o compliance formale, ma e il percorso tecnico giusto per arrivarci.
