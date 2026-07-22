-- Migration: rating_stabilita cliente (spec v2 §11.1) - valutazione churn-risk manuale 1-5.
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS rating_stabilita SMALLINT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_clienti_rating_stabilita') THEN
        ALTER TABLE clienti ADD CONSTRAINT ck_clienti_rating_stabilita
            CHECK (rating_stabilita IS NULL OR rating_stabilita BETWEEN 1 AND 5);
    END IF;
END $$;
