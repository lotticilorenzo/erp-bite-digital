-- Migration: movimenti_cassa pronto per l'import e/c (spec v2 §5.1, invarianti 1/3/4) - Fase G.
-- SOLO struttura (il parser CBI/CSV resta bloccato dal tracciato bancario reale).
-- stato 4 valori: i movimenti esistenti hanno tutti data_valuta (cassa avvenuta) ->
-- riconciliato=true => 'riconciliato', altrimenti 'regolato' (semantica preservata).

ALTER TABLE movimenti_cassa ADD COLUMN IF NOT EXISTS descrizione_grezza TEXT;
ALTER TABLE movimenti_cassa ADD COLUMN IF NOT EXISTS impronta_dedup VARCHAR(64);
ALTER TABLE movimenti_cassa ADD COLUMN IF NOT EXISTS flag_esclusione BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE movimenti_cassa ADD COLUMN IF NOT EXISTS stato VARCHAR(20);

UPDATE movimenti_cassa SET stato = CASE WHEN riconciliato THEN 'riconciliato' ELSE 'regolato' END
WHERE stato IS NULL;

ALTER TABLE movimenti_cassa ALTER COLUMN stato SET DEFAULT 'regolato';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_movimenti_stato') THEN
        ALTER TABLE movimenti_cassa ADD CONSTRAINT ck_movimenti_stato
            CHECK (stato IS NULL OR stato IN ('previsto','contabilizzato','regolato','riconciliato'));
    END IF;
END $$;

-- Idempotenza import (inv.3): stessa impronta = stesso movimento, una sola volta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimenti_impronta ON movimenti_cassa (impronta_dedup)
WHERE impronta_dedup IS NOT NULL;
