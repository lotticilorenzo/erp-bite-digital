# BITE ERP - Project Context & Guide

## 1. PANORAMICA
Bite ERP è un sistema gestionale interno progettato per **Bite Digital Studio**. Viene utilizzato per gestire l'intero ciclo di vita delle commesse dello studio, dalla pianificazione delle risorse alla rendicontazione dei tempi (timesheet) e alla sincronizzazione con sistemi esterni come ClickUp (per i task) e Fatture in Cloud (per la fatturazione).

Il sistema aggrega i progetti in "commesse mensili" per cliente, permettendo un controllo granulare del margine operativo, dei costi della manodopera e della marginalità complessiva.

## 2. STACK ATTUALE
Il progetto è una web app "full-stack" orchestrata con Docker.

*   **Backend**: Python 3.14+, FastAPI, SQLAlchemy (Async), Uvicorn.
*   **Database**: PostgreSQL 16 (Alpine).
*   **Frontend**: Standalone HTML (Vanilla JS/React via CDN).
    *   `bite-erp-v3.html`: ERP principale.
    *   `studio-os.html`: Gestione task/progetti avanzata.
*   **Infrastructure**: Nginx (Reverse Proxy & Static Server), Docker Compose.
*   **Integrazioni**: Fatture in Cloud API v2, ClickUp API v2.

## 3. STRUTTURA CARTELLE
```text
erp-bite-digital/
├── backend/                # Cuore pulsante del sistema
│   ├── app/                # Codice sorgente FastAPI
│   │   ├── api/v1/         # Endpoint API (router.py è il file principale)
│   │   ├── core/           # Configurazioni e sicurezza
│   │   ├── db/             # Sessione database e modelli SQLAlchemy
│   │   ├── models/         # Definizioni tabelle DB
│   │   ├── schemas/        # Pydantic models (DTOs)
│   │   └── services/       # Logica di business (Sync FIC, ClickUp, ecc.)
│   ├── Dockerfile          # Build del backend
│   ├── docker-compose.yml  # Orchestrazione DB, Backend, Nginx
│   ├── nginx.conf          # Configurazione server web e proxy
│   ├── requirements.txt    # Dipendenze Python
│   └── schema.sql          # Schema PostgreSQL (Sorgente di verità)
├── bite-erp-v3.html        # Frontend ERP principale (React CDN)
├── studio-os.html          # Frontend alternativo/avanzato (React CDN)
├── start_localhost.bat     # Script di avvio rapido per Windows
└── .env                    # Variabili d'ambiente (copiare da .env.example)
```

## 4. COME AVVIARE IN LOCALE
1.  **Requisiti**: Docker Desktop installato e attivo.
2.  **Comando**:
    ```bash
    cd backend
    docker-compose up -d
    ```
3.  **Indirizzo**: Apri il browser su [http://localhost](http://localhost).
4.  **Sviluppo rapido (Windows)**: Fai doppio clic su `start_localhost.bat`.

## 5. DATABASE
PostgreSQL gestisce i dati tramite i seguenti modelli principali (vedi `schema.sql`):
*   `users`: Gestione utenti e costi orari.
*   `clienti`: Dati anagrafici e ID Fatture in Cloud.
*   `progetti`: Suddivisi in RETAINER e ONE_OFF.
*   `commesse`: L'entità centrale, aggregata per `cliente_id` e `mese_competenza`.
*   `timesheet`: Registrazione ore lavorate collegate a commesse e task.
*   `fatture_attive/passive`: Sincronizzate da Fatture in Cloud.
*   `movimenti_finanziari`: Per la riconciliazione bancaria.

## 6. API ENDPOINTS
Il router principale è in `backend/app/api/v1/router.py`. Prefisso: `/api/v1`.

*   **Auth**: `/auth/login`, `/auth/me`
*   **Clienti/Progetti**: CRUD completi per la gestione anagrafiche.
*   **Commesse**: Gestione del valore fatturabile e calcolo margini.
*   **Timesheet**: `/timesheet` (GET/POST), `/timesheet/approva` (Bulk approval).
*   **Reports**: `/dashboard/kpi` (Metriche mensili), `/report/marginalita`.
*   **Sync**: `/fic/sync` (Sincronizzazione manuale con Fatture in Cloud).
*   **Cassa**: `/movimenti-cassa` per la gestione flussi finanziari.

## 7. FRONTEND
Attualmente il frontend è servito come file statici da Nginx.
*   **React CDN**: Entrambi i file HTML scaricano React, ReactDOM e Babel dal CDN. La logica è scritta in `<script type="text/babel">`.
*   **Local Storage**: Utilizza `BITE_ERP_TOKEN` per l'auth e `BITE_ERP_API_BASE` (default `/api/v1`) per le chiamate API.
*   **Routing**: Gestito internamente tramite stato React nello stesso file.

## 8. CREDENZIALI LOCALI
*   **URL**: `http://localhost`
*   **Admin Bootstrap**:
    *   **Email**: `lorenzo@biteagency.com`
    *   **Password**: `BiteAgency-155B3984!` (definita in `.env`)
*   **Database**: `localhost:5432` (User: `bite`, Pass: `bite_secret`, DB: `bite_erp`)

## 9. MIGRATION PLAN
L'obiettivo imminente è la modernizzazione del frontend mantendo il backend attuale.
*   **Obiettivo**: Spostare la logica dai file HTML a un progetto React moderno.
*   **Stack Target**:
    *   **Framework**: Vite + React 18.
    *   **Linguaggio**: TypeScript.
    *   **Styling**: Tailwind CSS + Shadcn/ui.
    *   **Routing**: React Router.
    *   **Data Fetching**: TanStack Query (React Query).

## 10. DESIGN SYSTEM
*   **Aesthetics**: Minimalista, premium, ispirato a Linear/Vercel.
*   **Theme**: Dark Mode di default (Background `#020617`).
*   **Typography**: *Plus Jakarta Sans* e *DM Mono* per i dati tecnici.
*   **Colors**: 
    *   Accent: Purple/Violet (`#7c3aed`).
    *   Neutral: Slate/Gray scale.
*   **Interactive**: Micro-animazioni (`fadeUp`, `scaleIn`), Hover sofisticati.
## 11. PROSSIMI STEP IN ORDINE
1. Migrare frontend a Vite + React + TypeScript + Shadcn + Tailwind
2. Unificare design system tra ERP e Studio OS
3. Aggiungere tema personalizzabile (colore accent + dark/light)
4. Sistema autenticazione granulare per ruoli (ADMIN, PM, EDITOR, CLIENT)
5. Webhook system per n8n - emettere eventi ad ogni cambio stato
6. Integrare automazioni AI via Claude API
7. App desktop con Tauri
8. Performance, sicurezza, backup automatici

## 12. REGOLE PER CLAUDE CODE
- Prima di modificare qualsiasi file, leggi sempre questo CLAUDE.md
- Non toccare mai il backend senza conferma esplicita
- Ogni nuova feature va prima pianificata e approvata
- Mantieni sempre la compatibilità con Docker Compose esistente
- Il branch main è quello di produzione, usa sempre branch separati
- Testa sempre in locale prima di pushare