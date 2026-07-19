-- Migration: rate a milestone per progetti (spec v2 §4.4/§4.5)
-- Created: 2026-07-19
-- Le rate generano scadenze (tabella scadenze, non letta da alcun calcolo) al raggiungimento della
-- milestone: solo la CASSA. Il riconoscimento lineare del ricavo a competenza NON e' qui (CE gestionale).
-- Vincolo Σ percentuali = 100% applicativo (le rate si inseriscono una alla volta), non a DB.

CREATE TABLE IF NOT EXISTS progetto_rate (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progetto_id           UUID NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
    numero                INTEGER NOT NULL,
    percentuale           NUMERIC(5, 2) NOT NULL,
    milestone             VARCHAR(30) NOT NULL,
    milestone_descrizione VARCHAR(200),
    raggiunta             BOOLEAN NOT NULL DEFAULT false,
    data_raggiungimento   DATE,
    scadenza_id           UUID REFERENCES scadenze(id) ON DELETE SET NULL,
    note                  TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_rate_percentuale CHECK (percentuale > 0 AND percentuale <= 100),
    CONSTRAINT ck_rate_milestone CHECK (milestone IN ('accordo_siglato','approvazione_layout','messa_online','altro')),
    CONSTRAINT uq_rate_progetto_numero UNIQUE (progetto_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_rate_progetto ON progetto_rate(progetto_id);
