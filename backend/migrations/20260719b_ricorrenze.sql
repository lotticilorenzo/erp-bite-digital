-- Migration: ricorrenze (template) che generano occorrenze in `scadenze` (spec v2 §5.3)
-- Created: 2026-07-19
-- Le ricorrenze sono SOLO template: il generatore crea righe in `scadenze` (tabella non letta da
-- alcun calcolo -> zero doppio conteggio). NON tocca costi_variabili ne' il suo aggancio alla
-- proiezione cassa. Idempotenza garantita dal UNIQUE(ricorrenza_id, data_attesa) su scadenze.

CREATE TABLE IF NOT EXISTS ricorrenze (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descrizione        TEXT NOT NULL,
    tipo_scadenza      VARCHAR(20) NOT NULL,   -- tipo delle scadenze generate
    importo            NUMERIC(14, 2) NOT NULL,
    periodicita        VARCHAR(20) NOT NULL,
    giorno_riferimento INTEGER,                -- es. 16 (F24), 27 (acconto IVA); null = giorno di data_inizio
    data_inizio        DATE NOT NULL,
    data_fine          DATE,                   -- null = indeterminata
    prossima_data      DATE,                   -- aggiornata dal generatore
    categoria_id       UUID,
    conto_id           UUID,
    controparte_tipo   VARCHAR(20),
    controparte_id     UUID,
    impatta_cassa_bite BOOLEAN NOT NULL DEFAULT true,
    attivo             BOOLEAN NOT NULL DEFAULT true,
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_ricorrenze_importo_pos CHECK (importo > 0),
    CONSTRAINT ck_ricorrenze_tipo CHECK (tipo_scadenza IN ('attiva','passiva','fiscale','contributiva','finanziaria')),
    CONSTRAINT ck_ricorrenze_periodicita CHECK (periodicita IN ('settimanale','mensile','bimestrale','trimestrale','semestrale','annuale')),
    CONSTRAINT ck_ricorrenze_giorno CHECK (giorno_riferimento IS NULL OR giorno_riferimento BETWEEN 1 AND 31),
    CONSTRAINT ck_ricorrenze_controparte_tipo CHECK (controparte_tipo IS NULL OR controparte_tipo IN ('cliente','fornitore','erario','inps','banca','altro'))
);

CREATE INDEX IF NOT EXISTS idx_ricorrenze_attivo_prossima ON ricorrenze(attivo, prossima_data);
CREATE INDEX IF NOT EXISTS idx_ricorrenze_tipo ON ricorrenze(tipo_scadenza);

-- Link occorrenza -> ricorrenza generante + chiave logica di idempotenza.
ALTER TABLE scadenze
    ADD COLUMN IF NOT EXISTS ricorrenza_id UUID REFERENCES ricorrenze(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scadenze_ricorrenza_data
    ON scadenze(ricorrenza_id, data_attesa) WHERE ricorrenza_id IS NOT NULL;
