-- Migration: config singleton per il memo cliente/collaboratore dedicato del P&L (brief §7.6)
-- Created: 2026-06-12
-- Una sola riga (id=1): quale cliente e' "il cliente dedicato" (Italfer), quale risorsa e' "il
-- collaboratore dedicato" (Paolo G.) e il costo mensile del collaboratore (NULL = da cedolino, esterno).
-- Inerte di default (tutto NULL): il memo non compare finche' non si configura un cliente dedicato.

CREATE TABLE IF NOT EXISTS config_pl_memo (
    id                          INTEGER PRIMARY KEY DEFAULT 1,
    cliente_dedicato_id         UUID REFERENCES clienti(id) ON DELETE SET NULL,
    collaboratore_dedicato_id   UUID REFERENCES risorse(id) ON DELETE SET NULL,
    costo_collaboratore_mensile NUMERIC(12,2),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_config_pl_memo_singleton CHECK (id = 1)
);

-- Riga singleton inerte (tutti i campi NULL).
INSERT INTO config_pl_memo (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
