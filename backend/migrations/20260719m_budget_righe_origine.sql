-- Migration: origine della riga budget/forecast (spec v2 §13)
-- Created: 2026-07-19
-- Il forecast rolling mescola ACTUAL (mesi chiusi) e PREVISIONE (mesi aperti): `origine` dice da dove
-- viene ogni numero, cosi' si sa sempre cosa e' consuntivo e cosa e' stima. Additiva, nullable.

ALTER TABLE budget_righe
    ADD COLUMN IF NOT EXISTS origine VARCHAR(24);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_budget_righe_origine') THEN
        ALTER TABLE budget_righe ADD CONSTRAINT ck_budget_righe_origine
            CHECK (origine IS NULL OR origine IN ('actual','budget','forecast_precedente','manuale'));
    END IF;
END $$;
