-- Migration: forecast_assunzioni (spec v2 §13.2) - driver minimi del forecast rolling.
-- tipo_servizio NULL = default globale. Nessun seed: i valori sono "da tarare" (§13.5,
-- storico giovane) e vanno inseriti consapevolmente, non inventati.

CREATE TABLE IF NOT EXISTS forecast_assunzioni (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_servizio      VARCHAR(30) UNIQUE,
    fattore_stabilita  NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (fattore_stabilita > 0 AND fattore_stabilita <= 1),
    churn_atteso_pct   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (churn_atteso_pct >= 0 AND churn_atteso_pct < 100),
    nota               TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estende il CHECK origine di budget_righe col nuovo valore 'driver_ricorrenti' (driver §13.2).
ALTER TABLE budget_righe DROP CONSTRAINT IF EXISTS ck_budget_righe_origine;
ALTER TABLE budget_righe ADD CONSTRAINT ck_budget_righe_origine
    CHECK (origine IS NULL OR origine IN ('actual','budget','forecast_precedente','manuale','driver_ricorrenti'));
