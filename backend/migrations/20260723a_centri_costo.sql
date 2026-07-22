-- Migration: Centri di costo (spec v2 §4.7) — aree funzionali, set minimo (foglio 1).
-- Additiva e idempotente. FK reale su budget_righe.centro_costo_id (prima UUID libero) e
-- centro_costo_id su costi_fissi.

CREATE TABLE IF NOT EXISTS centri_costo (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codice                   VARCHAR(20) UNIQUE NOT NULL,
    nome                     VARCHAR(200) NOT NULL,
    tipo                     VARCHAR(15) NOT NULL DEFAULT 'struttura' CHECK (tipo IN ('produttivo','struttura')),
    responsabile_risorsa_id  UUID REFERENCES risorse(id) ON DELETE SET NULL,
    attivo                   BOOLEAN NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set proposto dalla spec (§4.7): Produzione/Delivery, Commerciale/BD, Amministrazione, Direzione/Struttura.
INSERT INTO centri_costo (codice, nome, tipo) VALUES
    ('CC-PROD', 'Produzione / Delivery', 'produttivo'),
    ('CC-COMM', 'Commerciale / BD',      'struttura'),
    ('CC-AMM',  'Amministrazione',       'struttura'),
    ('CC-DIR',  'Direzione / Struttura', 'struttura')
ON CONFLICT (codice) DO NOTHING;

-- FK reale su budget_righe: gli eventuali UUID orfani (scritti quando la tabella non esisteva)
-- non riferivano nulla -> NULL (documentato; nessun dato reale perso, il valore era inerte).
UPDATE budget_righe SET centro_costo_id = NULL
WHERE centro_costo_id IS NOT NULL
  AND centro_costo_id NOT IN (SELECT id FROM centri_costo);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_righe_centro_costo') THEN
        ALTER TABLE budget_righe
            ADD CONSTRAINT fk_budget_righe_centro_costo
            FOREIGN KEY (centro_costo_id) REFERENCES centri_costo(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE costi_fissi ADD COLUMN IF NOT EXISTS centro_costo_id UUID REFERENCES centri_costo(id) ON DELETE SET NULL;
