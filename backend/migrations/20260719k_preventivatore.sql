-- Migration: preventivatore allineato a spec v2 §18 (testata modalita prezzo, righe 4 nature, catalogo)
-- Created: 2026-07-19
-- Estende preventivi/preventivo_voci esistenti (NON ricrea). "Gemello ex-ante" della marginalita
-- commessa: stessa economia (§4.5) letta prima. Additiva: non tocca il consuntivo.

ALTER TABLE preventivi
    ADD COLUMN IF NOT EXISTS modalita_prezzo VARCHAR(20),                 -- markup|margine
    ADD COLUMN IF NOT EXISTS markup_su       VARCHAR(20) DEFAULT 'costo_pieno', -- solo_lavoro|costo_pieno
    ADD COLUMN IF NOT EXISTS prezzo          NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS margine_pct     NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS markup_pct      NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS margine_target  NUMERIC(14, 2),              -- per il budget interno (§18.3)
    ADD COLUMN IF NOT EXISTS valido_fino     DATE;

ALTER TABLE preventivo_voci
    ADD COLUMN IF NOT EXISTS tipo         VARCHAR(20),   -- lavoro|socio|esterno|overhead
    ADD COLUMN IF NOT EXISTS servizio_id  UUID,
    ADD COLUMN IF NOT EXISTS risorsa_id   UUID,
    ADD COLUMN IF NOT EXISTS ruolo        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ore          NUMERIC(8, 2),
    ADD COLUMN IF NOT EXISTS tariffa      NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS costo        NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS ricarico_pct NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS prezzo_riga  NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS is_stima     BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_prev_modalita') THEN
        ALTER TABLE preventivi ADD CONSTRAINT ck_prev_modalita CHECK (modalita_prezzo IS NULL OR modalita_prezzo IN ('markup','margine'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_voci_tipo') THEN
        ALTER TABLE preventivo_voci ADD CONSTRAINT ck_voci_tipo CHECK (tipo IS NULL OR tipo IN ('lavoro','socio','esterno','overhead'));
    END IF;
END $$;

-- Catalogo servizi (§18.6, forma leggera). Righe libere sempre ammesse; questo e' solo un aiuto.
CREATE TABLE IF NOT EXISTS servizi_catalogo (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(200) NOT NULL,
    tipo_progetto   VARCHAR(30),                          -- uno dei 5 di §4.4 (o NULL)
    template_effort JSONB NOT NULL DEFAULT '{}',          -- ore-per-ruolo (placeholder finche' non tarato)
    prezzo_base     NUMERIC(14, 2),
    placeholder     BOOLEAN NOT NULL DEFAULT true,        -- true = non ancora tarato con dati reali
    attivo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_servizi_tipo CHECK (tipo_progetto IS NULL OR tipo_progetto IN ('social_media','creazione_sito_web','gestione_web','produzione_contenuti','stand_fieristici'))
);

-- Seed 5 PLACEHOLDER (uno per tipo_progetto): effort vuoto, prezzo_base NULL -> nessun dato inventato.
INSERT INTO servizi_catalogo (nome, tipo_progetto, template_effort, prezzo_base, placeholder) VALUES
  ('Social Media (placeholder)',        'social_media',        '{}', NULL, true),
  ('Creazione Sito Web (placeholder)',  'creazione_sito_web',  '{}', NULL, true),
  ('Gestione Web (placeholder)',        'gestione_web',        '{}', NULL, true),
  ('Produzione Contenuti (placeholder)','produzione_contenuti','{}', NULL, true),
  ('Stand Fieristici (placeholder)',    'stand_fieristici',    '{}', NULL, true)
ON CONFLICT DO NOTHING;
