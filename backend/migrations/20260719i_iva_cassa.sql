-- Migration: campi SDI/detraibilita/IVA per la liquidazione IVA per cassa (spec v2 §6.2, §5.1, §10.1)
-- Created: 2026-07-19
-- I valori veri (flag SDI, detraibilita, IVA per movimento) arriveranno da FIC: qui si creano SOLO i
-- campi (NULLABLE dove il valore viene da FIC). Finche' non ci sono movimenti SDI riconciliati la
-- liquidazione IVA per cassa e' 0 (inerzia onesta, nessun fallback che stima). Additiva: non tocca i calcoli.

ALTER TABLE fatture_attive
    ADD COLUMN IF NOT EXISTS fattura_elettronica BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE fatture_passive
    ADD COLUMN IF NOT EXISTS fattura_elettronica BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS data_ricezione_fe   DATE,
    ADD COLUMN IF NOT EXISTS detraibilita_pct    NUMERIC(5, 2),   -- IVA detraibile % (da FIC, §6.2)
    ADD COLUMN IF NOT EXISTS deducibilita_pct    NUMERIC(5, 2);   -- costo deducibile %

ALTER TABLE movimenti_cassa
    ADD COLUMN IF NOT EXISTS imponibile  NUMERIC(14, 2),          -- da FIC (§5.1)
    ADD COLUMN IF NOT EXISTS iva_importo NUMERIC(14, 2);          -- IVA per cassa del movimento (da FIC)
