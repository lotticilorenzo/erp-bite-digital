-- Migration: calcolo fiscale reale (spec v2 §10) - IRAP/IRPEF soci quantificati, F24 aggregatore

ALTER TABLE risorse ADD COLUMN IF NOT EXISTS quota_pct NUMERIC(5,2);

CREATE TABLE IF NOT EXISTS f24 (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    periodo          DATE NOT NULL,
    data_versamento  DATE NOT NULL,
    stato            VARCHAR(20) NOT NULL DEFAULT 'stimato' CHECK (stato IN ('stimato','confermato')),
    note             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS f24_righe (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    f24_id             UUID NOT NULL REFERENCES f24(id) ON DELETE CASCADE,
    tributo            VARCHAR(100) NOT NULL,
    codice_tributo     VARCHAR(10),
    importo_a_debito   NUMERIC(14,2) NOT NULL DEFAULT 0,
    importo_a_credito  NUMERIC(14,2) NOT NULL DEFAULT 0,
    note               TEXT,
    CONSTRAINT ck_f24_righe_importi_pos CHECK (importo_a_debito >= 0 AND importo_a_credito >= 0)
);
