-- Migration: tipo_servizio + intensita socio sui progetti (spec v2 §4.4/§4.6)
-- Created: 2026-07-19
-- ASSE DISTINTO da progetti.tipo (RETAINER/ONE_OFF = modello di FATTURAZIONE, alimenta lo split
-- ricavi del P&L LIVE): quello NON si tocca. Additiva; tipo_servizio/periodicita restano NULL sui
-- progetti esistenti (nessun default inventato). intensita_socio default 'M' (scala riparto 1:2:4).

ALTER TABLE progetti
    ADD COLUMN IF NOT EXISTS tipo_servizio        VARCHAR(30),
    ADD COLUMN IF NOT EXISTS periodicita          VARCHAR(20),
    ADD COLUMN IF NOT EXISTS referente_risorsa_id UUID REFERENCES risorse(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS intensita_socio      VARCHAR(1) NOT NULL DEFAULT 'M',
    ADD COLUMN IF NOT EXISTS dettagli_tipo        JSONB NOT NULL DEFAULT '{}';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_progetti_tipo_servizio') THEN
        ALTER TABLE progetti ADD CONSTRAINT ck_progetti_tipo_servizio
            CHECK (tipo_servizio IS NULL OR tipo_servizio IN ('social_media','creazione_sito_web','gestione_web','produzione_contenuti','stand_fieristici'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_progetti_periodicita') THEN
        ALTER TABLE progetti ADD CONSTRAINT ck_progetti_periodicita
            CHECK (periodicita IS NULL OR periodicita IN ('mensile','bimestrale','trimestrale','semestrale','annuale','spot','una_tantum'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_progetti_intensita_socio') THEN
        ALTER TABLE progetti ADD CONSTRAINT ck_progetti_intensita_socio
            CHECK (intensita_socio IN ('S','M','L'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_progetti_tipo_servizio ON progetti(tipo_servizio);
