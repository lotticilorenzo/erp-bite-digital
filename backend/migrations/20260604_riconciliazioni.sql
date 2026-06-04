-- Migration: riconciliazione bancaria reale M2M + pagamenti parziali (brief §2.2)
-- Created: 2026-06-04
-- Tabella ponte movimento <-> fattura. Fonte unica: importo_pagato/residuo/stato/data delle
-- fatture e il flag riconciliato dei movimenti sono DERIVATI dalla somma di queste righe.
-- Backfill idempotente dei link 1:1 esistenti (movimenti_cassa.fattura_attiva_id/passiva_id).

CREATE TABLE IF NOT EXISTS riconciliazioni (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movimento_id       UUID NOT NULL REFERENCES movimenti_cassa(id) ON DELETE CASCADE,
    fattura_attiva_id  UUID REFERENCES fatture_attive(id) ON DELETE CASCADE,
    fattura_passiva_id UUID REFERENCES fatture_passive(id) ON DELETE CASCADE,
    importo            NUMERIC(12,2) NOT NULL,
    data               DATE NOT NULL,
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_riconciliazioni_importo_pos CHECK (importo > 0),
    CONSTRAINT ck_riconciliazioni_una_fattura CHECK (num_nonnulls(fattura_attiva_id, fattura_passiva_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_riconciliazioni_movimento ON riconciliazioni(movimento_id);
CREATE INDEX IF NOT EXISTS idx_riconciliazioni_fattura_attiva ON riconciliazioni(fattura_attiva_id);
CREATE INDEX IF NOT EXISTS idx_riconciliazioni_fattura_passiva ON riconciliazioni(fattura_passiva_id);

-- Allarga stato_pagamento (era VARCHAR(20)) per ospitare 'SALDATO_FIC_DA_RICONCILIARE' (27 char, R2).
ALTER TABLE fatture_attive  ALTER COLUMN stato_pagamento TYPE VARCHAR(40);
ALTER TABLE fatture_passive ALTER COLUMN stato_pagamento TYPE VARCHAR(40);

-- Backfill link ATTIVI 1:1 (importo = min(|movimento|, totale fattura); data = data valuta movimento)
INSERT INTO riconciliazioni (movimento_id, fattura_attiva_id, importo, data)
SELECT m.id, m.fattura_attiva_id, LEAST(ABS(m.importo), fa.importo_totale), m.data_valuta
FROM movimenti_cassa m
JOIN fatture_attive fa ON fa.id = m.fattura_attiva_id
WHERE m.fattura_attiva_id IS NOT NULL
  AND LEAST(ABS(m.importo), fa.importo_totale) > 0
  AND NOT EXISTS (
      SELECT 1 FROM riconciliazioni r
      WHERE r.movimento_id = m.id AND r.fattura_attiva_id = m.fattura_attiva_id
  );

-- Backfill link PASSIVI 1:1
INSERT INTO riconciliazioni (movimento_id, fattura_passiva_id, importo, data)
SELECT m.id, m.fattura_passiva_id, LEAST(ABS(m.importo), fp.importo_totale), m.data_valuta
FROM movimenti_cassa m
JOIN fatture_passive fp ON fp.id = m.fattura_passiva_id
WHERE m.fattura_passiva_id IS NOT NULL
  AND LEAST(ABS(m.importo), fp.importo_totale) > 0
  AND NOT EXISTS (
      SELECT 1 FROM riconciliazioni r
      WHERE r.movimento_id = m.id AND r.fattura_passiva_id = m.fattura_passiva_id
  );
