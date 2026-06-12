-- Migration: pesi configurabili per tipo contenuto (driver quota Luca, brief §7.5)
-- Created: 2026-06-12
-- Il peso per tipo (valori dell'enum contenuto_tipo) e' usato in _build_quota_cache_mese:
-- la quota Luca ripartisce SUM(peso) invece di COUNT(*) dei contenuti.
-- NB: il "reel=1.5" del brief NON ha un valore enum corrispondente (manca REEL): nessuno slot
--     dedicato -> i reel ricadono su VIDEO (o su un futuro tipo). Non inventato qui.

CREATE TABLE IF NOT EXISTS pesi_contenuto (
    tipo       VARCHAR(30) PRIMARY KEY,
    peso       NUMERIC(4,2) NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_pesi_contenuto_peso_pos CHECK (peso > 0)
);

-- Seed idempotente dei tipi enum esistenti coi default del brief (VIDEO=3, resto=1).
INSERT INTO pesi_contenuto (tipo, peso) VALUES
    ('POST_SOCIAL', 1),
    ('COPY', 1),
    ('DESIGN', 1),
    ('VIDEO', 3),
    ('EMAIL', 1),
    ('ALTRO', 1)
ON CONFLICT (tipo) DO NOTHING;
