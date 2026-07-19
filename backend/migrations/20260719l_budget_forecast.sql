-- Migration: Budget & Forecast - STRUTTURE versionate (spec v2 §13)
-- Created: 2026-07-19
-- Solo contenitori + righe. NON in questa fase: Actual, motore forecast rolling, forecast accuracy,
-- ricalcolo coefficiente OVH dal forecast (toccano i calcoli -> parte 13b). Additiva: zero impatto.
--
-- DIPENDENZE MANCANTI (NON inventate): `voci_ce`, `centri_costo`, `forecast_assunzioni` non esistono.
-- §13.3 vuole voce_ce_id OBBLIGATORIO come spina dorsale: qui si usa `voce_tipo` (enum disponibile)
-- e si predispone `voce_ce_id`/`centro_costo_id` come UUID NULLABLE SENZA FK, pronti al collegamento
-- quando quelle tabelle esisteranno.

CREATE TABLE IF NOT EXISTS budget_versioni (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anno                INTEGER NOT NULL,
    tipo                VARCHAR(20) NOT NULL,                  -- budget|forecast
    versione            INTEGER NOT NULL,                      -- budget=1; forecast 1,2,3...
    stato               VARCHAR(20) NOT NULL DEFAULT 'bozza',  -- bozza|approvato|archiviato
    periodo_riferimento DATE,                                  -- forecast: mese da cui e' ri-previsto
    -- TODO(13b, §13.4/§13.6): allo hard_lock di un periodo il forecast corrente va "fotografato"
    -- in una versione snapshot immutabile e versionata. Qui c'e' solo il gancio.
    periodo_snapshot    DATE,
    approvato_at        TIMESTAMPTZ,
    approvato_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    note                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_budget_ver_tipo  CHECK (tipo IN ('budget','forecast')),
    CONSTRAINT ck_budget_ver_stato CHECK (stato IN ('bozza','approvato','archiviato')),
    CONSTRAINT uq_budget_versioni  UNIQUE (anno, tipo, versione)
);

CREATE INDEX IF NOT EXISTS idx_budget_versioni_anno_tipo_stato ON budget_versioni(anno, tipo, stato);

CREATE TABLE IF NOT EXISTS budget_righe (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    versione_id     UUID NOT NULL REFERENCES budget_versioni(id) ON DELETE CASCADE,
    anno            INTEGER NOT NULL,
    mese            INTEGER NOT NULL,
    voce_tipo       VARCHAR(20) NOT NULL,   -- ricavo|costo_diretto|costo_struttura|altro
    voce_ce_id      UUID,                   -- §13.3 spina dorsale (FK quando esistera' voci_ce)
    categoria_id    UUID,                   -- nessuna tabella categorie generica: no FK
    cliente_id      UUID REFERENCES clienti(id) ON DELETE SET NULL,
    commessa_id     UUID REFERENCES commesse(id) ON DELETE SET NULL,
    centro_costo_id UUID,                   -- FK quando esistera' centri_costo
    importo         NUMERIC(14, 2) NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_budget_righe_mese CHECK (mese BETWEEN 1 AND 12),
    CONSTRAINT ck_budget_righe_voce CHECK (voce_tipo IN ('ricavo','costo_diretto','costo_struttura','altro')),
    -- §13.3: una riga vive su UN SOLO asse di dettaglio (no doppio conteggio).
    CONSTRAINT ck_budget_righe_un_asse CHECK (num_nonnulls(cliente_id, commessa_id, centro_costo_id) <= 1),
    -- NULLS NOT DISTINCT (PG15+): evita righe duplicate anche quando gli assi sono NULL.
    CONSTRAINT uq_budget_righe UNIQUE NULLS NOT DISTINCT (versione_id, anno, mese, voce_tipo, categoria_id, cliente_id, commessa_id, centro_costo_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_righe_versione ON budget_righe(versione_id);
CREATE INDEX IF NOT EXISTS idx_budget_righe_anno_mese ON budget_righe(anno, mese);
