-- Migration: lock di competenza / chiusura periodo (spec v2 §13.6, invariante 18)
-- Created: 2026-07-19
-- Il lock vale sulla COMPETENZA (data_competenza), NON sulla cassa: un movimento bancario tardivo
-- con data_cassa in un mese chiuso deve potersi riconciliare comunque. Nessun seed: l'assenza di
-- una riga = periodo aperto. La chiusura e' un'azione MANUALE (nessuna automazione in questa fase).

CREATE TABLE IF NOT EXISTS periodi_contabili (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anno                 INTEGER NOT NULL,
    mese                 INTEGER NOT NULL,
    stato                VARCHAR(20) NOT NULL DEFAULT 'aperto',  -- aperto|soft_close|hard_lock
    soft_closed_at       TIMESTAMPTZ,
    hard_locked_at       TIMESTAMPTZ,
    closed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    riaperto_count       INTEGER NOT NULL DEFAULT 0,
    ultima_riapertura_at TIMESTAMPTZ,
    ultima_riapertura_by UUID REFERENCES users(id) ON DELETE SET NULL,
    motivo_riapertura    TEXT,
    note                 TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_periodi_mese CHECK (mese BETWEEN 1 AND 12),
    CONSTRAINT ck_periodi_stato CHECK (stato IN ('aperto','soft_close','hard_lock')),
    CONSTRAINT uq_periodi_anno_mese UNIQUE (anno, mese)
);

CREATE INDEX IF NOT EXISTS idx_periodi_anno_mese_stato ON periodi_contabili(anno, mese, stato);
