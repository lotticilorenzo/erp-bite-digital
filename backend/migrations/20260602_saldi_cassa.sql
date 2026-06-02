-- Migration: saldo c/c manuale per la proiezione cassa (Fase 2, Layer 3)
-- Created: 2026-06-02
-- Tabella minima: la proiezione parte dall'ultimo saldo inserito (alla sua data).
-- TODO: a regime il saldo verra' da estratto conto / riconciliazione bancaria.

CREATE TABLE IF NOT EXISTS saldi_cassa (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data       DATE NOT NULL,
    saldo      NUMERIC(14,2) NOT NULL,
    nota       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saldi_cassa_data ON saldi_cassa(data DESC);
