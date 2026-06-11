-- Migration: registro costi variabili per il forecasting di cassa (brief §2.5)
-- Created: 2026-06-12
-- Collaboratori a consumo (ORARIO/A_PROGETTO/UNA_TANTUM). NON e' un costo di competenza:
-- non entra in margine/P&L. Solo lo stato PREVISTO alimenta la proiezione cassa (uscite datate).

CREATE TABLE IF NOT EXISTS costi_variabili (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descrizione              TEXT NOT NULL,
    collaboratore_risorsa_id UUID REFERENCES risorse(id) ON DELETE SET NULL,
    collaboratore_nome       TEXT,
    tipo                     VARCHAR(20) NOT NULL,
    importo                  NUMERIC(12,2) NOT NULL,
    data_prevista            DATE NOT NULL,
    ricorrenza               VARCHAR(20),
    commessa_id              UUID REFERENCES commesse(id) ON DELETE SET NULL,
    progetto_id              UUID REFERENCES progetti(id) ON DELETE SET NULL,
    stato                    VARCHAR(20) NOT NULL DEFAULT 'PREVISTO',
    note                     TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_costi_variabili_importo_pos CHECK (importo > 0),
    CONSTRAINT ck_costi_variabili_tipo CHECK (tipo IN ('ORARIO','A_PROGETTO','UNA_TANTUM')),
    CONSTRAINT ck_costi_variabili_stato CHECK (stato IN ('PREVISTO','SOSTENUTO')),
    CONSTRAINT ck_costi_variabili_ricorrenza CHECK (ricorrenza IS NULL OR ricorrenza IN ('MENSILE'))
);

CREATE INDEX IF NOT EXISTS idx_costi_variabili_data_prevista ON costi_variabili(data_prevista);
CREATE INDEX IF NOT EXISTS idx_costi_variabili_stato ON costi_variabili(stato);
