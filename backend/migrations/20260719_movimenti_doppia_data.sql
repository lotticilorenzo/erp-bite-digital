-- Migration: doppia data sui movimenti di cassa (spec v2 §5.1, principio 3)
-- Created: 2026-07-19
-- Ogni movimento ha data_competenza (alimenta il Conto Economico) E data_cassa (Tesoreria).
-- data_valuta resta la data cassa fisica (letta da API/FE, invariata). Migrazione ADDITIVA:
-- backfill data_competenza = data_valuta per lo storico; nessun cambio di comportamento sui
-- calcoli esistenti (la ripartizione su piu' mesi verra' usata dal CE gestionale, non ora).

ALTER TABLE movimenti_cassa
    ADD COLUMN IF NOT EXISTS data_competenza DATE,
    ADD COLUMN IF NOT EXISTS ripartizione_competenza_mesi INTEGER NOT NULL DEFAULT 1;

-- CHECK ripartizione >= 1 (idempotente)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_movimenti_ripartizione_mesi_pos') THEN
        ALTER TABLE movimenti_cassa
            ADD CONSTRAINT ck_movimenti_ripartizione_mesi_pos CHECK (ripartizione_competenza_mesi >= 1);
    END IF;
END $$;

-- Backfill: per un movimento bancario reale competenza e cassa coincidono (salvo rettifiche).
UPDATE movimenti_cassa SET data_competenza = data_valuta WHERE data_competenza IS NULL;

-- Indice per il Conto Economico gestionale (aggregazione per competenza).
CREATE INDEX IF NOT EXISTS idx_movimenti_data_competenza ON movimenti_cassa(data_competenza);
