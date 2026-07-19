-- Migration: allocazione fattura attiva -> commessa (Tabella F, spec v2 §7)
-- Created: 2026-07-19
-- Simmetrica a fatture_passive_imputazioni, ma con quadratura (invariante 6): la somma delle
-- allocazioni di una fattura non puo' superare l'imponibile (importo_netto). Additiva: NON e'
-- agganciata a P&L/margine (che oggi usano commessa.valore_fatturabile_calc) -> report invariati.

CREATE TABLE IF NOT EXISTS fatture_attive_allocazioni (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fattura_attiva_id UUID NOT NULL REFERENCES fatture_attive(id) ON DELETE CASCADE,
    commessa_id       UUID NOT NULL REFERENCES commesse(id) ON DELETE CASCADE,
    importo_allocato  NUMERIC(14, 2) NOT NULL,
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_alloc_importo_pos CHECK (importo_allocato > 0),
    CONSTRAINT uq_alloc_fattura_commessa UNIQUE (fattura_attiva_id, commessa_id)
);

CREATE INDEX IF NOT EXISTS idx_alloc_fattura ON fatture_attive_allocazioni(fattura_attiva_id);
CREATE INDEX IF NOT EXISTS idx_alloc_commessa ON fatture_attive_allocazioni(commessa_id);
