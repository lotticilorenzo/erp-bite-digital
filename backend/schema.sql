-- ============================================================
-- ERP BITE DIGITAL STUDIO
-- Schema PostgreSQL v1.2 — commessa aggregata cliente/mese
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM ──────────────────────────────────────────────────
CREATE TYPE user_role        AS ENUM ('ADMIN', 'PM', 'DIPENDENTE', 'FREELANCER');
CREATE TYPE project_type     AS ENUM ('RETAINER', 'ONE_OFF');
CREATE TYPE project_status   AS ENUM ('ATTIVO', 'CHIUSO');
CREATE TYPE commessa_status  AS ENUM ('APERTA', 'PRONTA_CHIUSURA', 'CHIUSA', 'FATTURATA', 'INCASSATA');
CREATE TYPE task_status      AS ENUM ('DA_FARE','BOZZE_IDEE','DA_CORREGGERE','IN_REVIEW','PRONTO','PROGRAMMATO','PUBBLICATO');
CREATE TYPE timesheet_status AS ENUM ('PENDING', 'APPROVATO', 'RIFIUTATO');
CREATE TYPE costo_tipo       AS ENUM ('FISSO', 'VARIABILE');
CREATE TYPE movimento_status AS ENUM ('NON_RICONCILIATO', 'RICONCILIATO', 'DA_VERIFICARE');

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome          VARCHAR(100) NOT NULL,
    cognome       VARCHAR(100) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    ruolo         user_role NOT NULL,
    costo_orario  NUMERIC(10,2),
    ore_settimanali INTEGER DEFAULT 40,
    clickup_user_id VARCHAR(50),
    bio           VARCHAR(200),
    preferences   JSONB DEFAULT '{}',
    avatar_url    VARCHAR(500),
    attivo        BOOLEAN DEFAULT TRUE,
    data_inizio   DATE,
    data_fine     DATE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENTI ───────────────────────────────────────────────
CREATE TABLE clienti (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ragione_sociale      VARCHAR(255) NOT NULL,
    piva                 VARCHAR(20),
    codice_fiscale       VARCHAR(20),
    sdi                  VARCHAR(10),
    pec                  VARCHAR(255),
    indirizzo            TEXT,
    email                VARCHAR(255),
    telefono             VARCHAR(50),
    referente            VARCHAR(100),
    note                 TEXT,
    codice_cliente       VARCHAR(10),
    numero_progressivo   INTEGER,
    paese                VARCHAR(100),
    tipologia            VARCHAR(50),
    comune               VARCHAR(100),
    cap                  VARCHAR(10),
    provincia            VARCHAR(5),
    note_indirizzo       VARCHAR(500),
    drive_files          JSONB DEFAULT '[]',
    condizioni_pagamento VARCHAR(100),
    fic_cliente_id       VARCHAR(100),
    affidabilita         VARCHAR(10) DEFAULT 'MEDIA',
    attivo               BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_clienti_fic_cliente_id_unique
    ON clienti(fic_cliente_id)
    WHERE fic_cliente_id IS NOT NULL;

-- ── PROGETTI ──────────────────────────────────────────────
CREATE TABLE progetti (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id       UUID NOT NULL REFERENCES clienti(id),
    nome             VARCHAR(255) NOT NULL,
    tipo             project_type NOT NULL,
    stato            project_status DEFAULT 'ATTIVO',
    importo_fisso    NUMERIC(10,2) DEFAULT 0,
    importo_variabile NUMERIC(10,2) DEFAULT 0,
    delivery_attesa  INTEGER DEFAULT 0,
    clickup_list_id  VARCHAR(100),
    note             TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE progetto_team (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progetto_id    UUID NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id),
    ruolo_progetto VARCHAR(100),
    UNIQUE(progetto_id, user_id)
);

-- ── COMMESSE ──────────────────────────────────────────────
-- Commessa aggregata per cliente + mese (include piu progetti)
CREATE TABLE commesse (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id          UUID NOT NULL REFERENCES clienti(id),
    mese_competenza     DATE NOT NULL,
    stato               commessa_status DEFAULT 'APERTA',
    costo_manodopera    NUMERIC(10,2) DEFAULT 0,
    costi_diretti       NUMERIC(10,2) DEFAULT 0,
    fattura_id          UUID REFERENCES fatture_attive(id),
    data_inizio         DATE,
    data_fine           DATE,
    data_chiusura       DATE,
    aggiustamenti       JSONB DEFAULT '[]',
    valore_fatturabile_override NUMERIC(10,2),
    note                TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cliente_id, mese_competenza)
);

-- Snapshot dei parametri economici per progetto dentro la commessa mensile
CREATE TABLE commessa_progetti (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commessa_id         UUID NOT NULL REFERENCES commesse(id) ON DELETE CASCADE,
    progetto_id         UUID NOT NULL REFERENCES progetti(id),
    importo_fisso       NUMERIC(10,2) NOT NULL DEFAULT 0,
    importo_variabile   NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_attesa     INTEGER NOT NULL DEFAULT 0,
    delivery_consuntiva INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(commessa_id, progetto_id)
);

-- ── COEFFICIENTE ALLOCAZIONE ──────────────────────────────
CREATE TABLE coefficienti_allocazione (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mese_competenza     DATE NOT NULL UNIQUE,
    stipendi_operativi  NUMERIC(10,2) NOT NULL,
    overhead_produttivo NUMERIC(10,2) NOT NULL,
    coefficiente        NUMERIC(8,4) GENERATED ALWAYS AS (
        CASE WHEN overhead_produttivo > 0
        THEN stipendi_operativi / overhead_produttivo
        ELSE 0 END
    ) STORED,
    note                TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── TASKS ─────────────────────────────────────────────────
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clickup_task_id VARCHAR(100) UNIQUE,
    progetto_id     UUID REFERENCES progetti(id),
    commessa_id     UUID REFERENCES commesse(id),
    assegnatario_id UUID REFERENCES users(id),
    revisore_id     UUID REFERENCES users(id),
    titolo          VARCHAR(500) NOT NULL,
    descrizione     TEXT,
    stato           task_status DEFAULT 'DA_FARE',
    data_scadenza   DATE,
    stima_minuti    INTEGER,
    clickup_synced_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TIMESHEET ─────────────────────────────────────────────
CREATE TABLE timesheet (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    task_id         UUID REFERENCES tasks(id),
    commessa_id     UUID REFERENCES commesse(id),
    data_attivita   DATE NOT NULL,
    mese_competenza DATE NOT NULL,
    servizio        VARCHAR(255),
    durata_minuti   INTEGER NOT NULL CHECK (durata_minuti > 0),
    costo_orario_snapshot NUMERIC(10,2),
    costo_lavoro    NUMERIC(10,2) DEFAULT 0,
    stato           timesheet_status DEFAULT 'PENDING',
    approvato_da    UUID REFERENCES users(id),
    approvato_at    TIMESTAMPTZ,
    note            TEXT,
    clickup_task_id VARCHAR(50),
    clickup_parent_task_id VARCHAR(50),
    task_display_name VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── COSTI ─────────────────────────────────────────────────
CREATE TABLE costi (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo            costo_tipo NOT NULL,
    descrizione     VARCHAR(255) NOT NULL,
    importo         NUMERIC(10,2) NOT NULL,
    mese_competenza DATE NOT NULL,
    categoria       VARCHAR(100),
    progetto_id     UUID REFERENCES progetti(id),
    commessa_id     UUID REFERENCES commesse(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── FATTURE ───────────────────────────────────────────────
CREATE TABLE fatture (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fic_fattura_id  VARCHAR(100) UNIQUE NOT NULL,
    cliente_id      UUID REFERENCES clienti(id),
    numero          VARCHAR(50),
    data_emissione  DATE,
    data_scadenza   DATE,
    importo_totale  NUMERIC(10,2),
    importo_incassato NUMERIC(10,2) DEFAULT 0,
    data_incasso    DATE,
    stato_fic       VARCHAR(50),
    fic_raw_data    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fattura_righe (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fattura_id  UUID NOT NULL REFERENCES fatture(id) ON DELETE CASCADE,
    commessa_id UUID REFERENCES commesse(id),
    descrizione VARCHAR(500),
    importo     NUMERIC(10,2) NOT NULL
);

-- ── FORNITORI (SYNC FIC) ─────────────────────────────────
CREATE TABLE fornitori (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fic_id          VARCHAR(100) UNIQUE NOT NULL,
    ragione_sociale VARCHAR(255) NOT NULL,
    piva            VARCHAR(20),
    codice_fiscale  VARCHAR(20),
    pec             VARCHAR(255),
    indirizzo       TEXT,
    email           VARCHAR(255),
    telefono        VARCHAR(50),
    attivo          BOOLEAN DEFAULT TRUE,
    fic_raw_data    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── FATTURE ATTIVE/PASSIVE (SYNC FIC) ────────────────────
CREATE TABLE fatture_attive (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fic_id              VARCHAR(100) UNIQUE NOT NULL,
    cliente_id          UUID REFERENCES clienti(id),
    fic_cliente_id      VARCHAR(100),
    numero              VARCHAR(50),
    data_emissione      DATE,
    data_scadenza       DATE,
    importo_totale      NUMERIC(10,2) DEFAULT 0,
    importo_pagato      NUMERIC(10,2) DEFAULT 0,
    importo_residuo     NUMERIC(10,2) DEFAULT 0,
    stato_pagamento     VARCHAR(20) DEFAULT 'ATTESA',
    data_ultimo_incasso DATE,
    valuta              VARCHAR(10),
    payments_raw        JSONB,
    fic_raw_data        JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fatture_passive (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fic_id                VARCHAR(100) UNIQUE NOT NULL,
    fornitore_id          UUID REFERENCES fornitori(id),
    fic_fornitore_id      VARCHAR(100),
    numero                VARCHAR(50),
    data_emissione        DATE,
    data_scadenza         DATE,
    importo_totale        NUMERIC(10,2) DEFAULT 0,
    importo_pagato        NUMERIC(10,2) DEFAULT 0,
    importo_residuo       NUMERIC(10,2) DEFAULT 0,
    stato_pagamento       VARCHAR(20) DEFAULT 'ATTESA',
    data_ultimo_pagamento DATE,
    valuta                VARCHAR(10),
    categoria             VARCHAR(100),
    payments_raw          JSONB,
    fic_raw_data          JSONB,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOG SYNC FIC ──────────────────────────────────────────
CREATE TABLE fic_sync_runs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at              TIMESTAMPTZ DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    imported_clienti        INTEGER NOT NULL DEFAULT 0,
    imported_fornitori      INTEGER NOT NULL DEFAULT 0,
    imported_fatture_attive INTEGER NOT NULL DEFAULT 0,
    imported_fatture_passive INTEGER NOT NULL DEFAULT 0,
    error_count             INTEGER NOT NULL DEFAULT 0,
    errors                  JSONB,
    triggered_by            UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── MOVIMENTI FINANZIARI ──────────────────────────────────
CREATE TABLE movimenti_finanziari (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_movimento DATE NOT NULL,
    descrizione    TEXT,
    importo        NUMERIC(10,2) NOT NULL,
    fattura_id     UUID REFERENCES fatture(id),
    stato          movimento_status DEFAULT 'NON_RICONCILIATO',
    fonte          VARCHAR(50) DEFAULT 'CSV_IMPORT',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOG ─────────────────────────────────────────────
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    tabella     VARCHAR(100) NOT NULL,
    record_id   UUID NOT NULL,
    azione      VARCHAR(50) NOT NULL,
    dati_prima  JSONB,
    dati_dopo   JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDICI ────────────────────────────────────────────────
CREATE INDEX idx_commesse_cliente     ON commesse(cliente_id);
CREATE INDEX idx_commesse_mese        ON commesse(mese_competenza);
CREATE INDEX idx_commesse_stato       ON commesse(stato);
CREATE INDEX idx_commessa_progetti_commessa ON commessa_progetti(commessa_id);
CREATE INDEX idx_commessa_progetti_progetto ON commessa_progetti(progetto_id);
CREATE INDEX idx_timesheet_user       ON timesheet(user_id);
CREATE INDEX idx_timesheet_commessa   ON timesheet(commessa_id);
CREATE INDEX idx_timesheet_competenza ON timesheet(mese_competenza);
CREATE INDEX idx_timesheet_stato      ON timesheet(stato);
CREATE INDEX idx_tasks_assegnatario   ON tasks(assegnatario_id);
CREATE INDEX idx_tasks_commessa       ON tasks(commessa_id);
CREATE INDEX idx_costi_competenza     ON costi(mese_competenza);
CREATE INDEX idx_audit_record         ON audit_log(tabella, record_id);
CREATE INDEX idx_fornitori_fic_id     ON fornitori(fic_id);
CREATE INDEX idx_fatture_attive_fic_id ON fatture_attive(fic_id);
CREATE INDEX idx_fatture_attive_scadenza ON fatture_attive(data_scadenza);
CREATE INDEX idx_fatture_attive_cliente ON fatture_attive(cliente_id);
CREATE INDEX idx_fatture_passive_fic_id ON fatture_passive(fic_id);
CREATE INDEX idx_fatture_passive_scadenza ON fatture_passive(data_scadenza);
CREATE INDEX idx_fatture_passive_fornitore ON fatture_passive(fornitore_id);
CREATE INDEX idx_commesse_fattura ON commesse(fattura_id);
CREATE INDEX idx_fic_sync_runs_started_at ON fic_sync_runs(started_at DESC);

-- ── TRIGGER: aggiorna costo_manodopera su approvazione ────
CREATE OR REPLACE FUNCTION aggiorna_costo_manodopera()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE commesse SET
        costo_manodopera = (
            SELECT COALESCE(SUM(t.costo_lavoro), 0)
            FROM timesheet t
            WHERE t.commessa_id = NEW.commessa_id
              AND t.stato = 'APPROVATO'
        ),
        updated_at = NOW()
    WHERE id = NEW.commessa_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_aggiorna_costo_manodopera
AFTER INSERT OR UPDATE OF stato ON timesheet
FOR EACH ROW
WHEN (NEW.commessa_id IS NOT NULL)
EXECUTE FUNCTION aggiorna_costo_manodopera();
