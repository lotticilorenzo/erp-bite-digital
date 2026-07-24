# Bite ERP - E2E Testing Suite with Playwright

Questo modulo contiene i test End-to-End per verificare il corretto funzionamento delle rotte, delle logiche di calcolo e dei flussi principali di Bite ERP.

## Requisiti

*   Docker Desktop in esecuzione (con i container del backend e del database attivi).
*   Node.js (v18+) installato sulla macchina host.

## Installazione delle Dipendenze

Se non lo hai già fatto, installa i browser di Playwright:

```bash
cd frontend
npm install
npx playwright install chromium
```

## Esecuzione dei Test

I test puntano per impostazione predefinita a `https://localhost` (gestendo correttamente l'avviso di certificato self-signed).

### Esegui tutti i test in modalità headless

```bash
npm run test:e2e
```

o direttamente:

```bash
npx playwright test
```

### Esegui i test con interfaccia grafica (UI Mode)

```bash
npx playwright test --ui
```

### Esegui un singolo test/file

```bash
npx playwright test e2e/clienti.spec.ts
```

## Struttura dei Test

*   `helpers.ts`: Contiene funzioni di utilità come il setup dei watcher per console error / network error >= 400 e la funzione di login centralizzata.
*   `auth.spec.ts`: Test di autenticazione e verifica del corretto caricamento di tutte le rotte della sidebar senza errori JS o di rete.
*   `clienti.spec.ts`: Creazione, visualizzazione dei dettagli e modifica dell'anagrafica cliente.
*   `preventivi.spec.ts`: Creazione di un preventivo con righe di diversa natura (servizio a corpo, lavoro interno, socio, esterno, overhead) e verifica della reattività del calcolo dell'economia di offerta.
*   `budget.spec.ts`: Creazione di una nuova versione di budget/forecast, compilazione delle righe mensili con salvataggio live e approvazione finale della versione.
*   `tesoreria.spec.ts`: Creazione di scadenze manuali e impostazione di ricorrenze per i flussi di cassa.
