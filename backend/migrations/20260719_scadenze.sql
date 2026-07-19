-- Migration: tabella scadenze unificata (spec v2 §5.2)
-- Created: 2026-07-19
-- Fonte unica per le scadenze attive/passive/fiscali/contributive/finanziarie. Questa fase crea
-- SOLO struttura + CRUD: la tabella NON viene popolata dalle fatture e NON e' collegata a
-- proiezione cassa / scadenzario fiscale / dashboard (anti doppio conteggio). I calcoli attuali
-- restano identici al byte; la migrazione dei consumi sara' una fase separata, una fonte alla volta.

CREATE TABLE IF NOT EXISTS scadenze (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo               VARCHAR(20) NOT NULL,
    data_attesa        DATE NOT NULL,
    importo            NUMERIC(14, 2) NOT NULL,
    stato              VARCHAR(20) NOT NULL DEFAULT 'aperta',
    importo_incassato  NUMERIC(14, 2) NOT NULL DEFAULT 0,
    importo_residuo    NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- mantenuto dal service = importo - incassato
    controparte_tipo   VARCHAR(20),                        -- cliente|fornitore|erario|inps|banca|altro
    controparte_id     UUID,                               -- polimorfico: nessuna FK singola
    progetto_id        UUID REFERENCES progetti(id) ON DELETE SET NULL,
    commessa_id        UUID REFERENCES commesse(id) ON DELETE SET NULL,
    categoria_id       UUID,                               -- nessuna tabella categorie generica: no FK
    documento_rif      VARCHAR(200),                       -- numero fattura, codice tributo, ecc.
    origine            VARCHAR(20) NOT NULL,               -- fic|manuale|ricorrenza|f24|progetto
    milestone          VARCHAR(100),                       -- rate Sito: accordo_siglato|approvazione_layout|messa_online
    fattura_attiva_id  UUID REFERENCES fatture_attive(id) ON DELETE SET NULL,
    fattura_passiva_id UUID REFERENCES fatture_passive(id) ON DELETE SET NULL,
    impatta_cassa_bite BOOLEAN NOT NULL DEFAULT true,      -- spec §10.0 (carichi soci fuori cassa Bite)
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_scadenze_importo_pos CHECK (importo > 0),
    CONSTRAINT ck_scadenze_tipo CHECK (tipo IN ('attiva','passiva','fiscale','contributiva','finanziaria')),
    CONSTRAINT ck_scadenze_stato CHECK (stato IN ('aperta','parziale','chiusa','scaduta')),
    CONSTRAINT ck_scadenze_controparte_tipo CHECK (controparte_tipo IS NULL OR controparte_tipo IN ('cliente','fornitore','erario','inps','banca','altro')),
    CONSTRAINT ck_scadenze_origine CHECK (origine IN ('fic','manuale','ricorrenza','f24','progetto'))
);

CREATE INDEX IF NOT EXISTS idx_scadenze_data_attesa ON scadenze(data_attesa);
CREATE INDEX IF NOT EXISTS idx_scadenze_stato ON scadenze(stato);
CREATE INDEX IF NOT EXISTS idx_scadenze_tipo ON scadenze(tipo);
CREATE INDEX IF NOT EXISTS idx_scadenze_controparte ON scadenze(controparte_tipo, controparte_id);
