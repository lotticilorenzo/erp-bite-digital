-- Migration: coefficiente OVH rolling (v1 deterministica) + parametri tetto (spec v2 §4.5, inv. 17)
-- Created: 2026-07-19
-- Storico dei refresh del coefficiente overhead (per il tetto allo scostamento e l'audit).
-- Il coefficiente e la varianza sono SOLO calcolati/esposti: NON agganciati a calcola_margine_commessa
-- ne' al P&L (che restano identici). L'aggancio ai margini sara' una fase separata.

CREATE TABLE IF NOT EXISTS coefficienti_ovh (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    periodo_riferimento    DATE NOT NULL,           -- mese di calcolo
    overhead_previsto      NUMERIC(14, 2),          -- numeratore (12m deterministico)
    base_ricavi_prevista   NUMERIC(14, 2),          -- denominatore (run-rate ricavi 12m)
    coefficiente           NUMERIC(8, 6) NOT NULL,  -- dopo l'eventuale tetto
    coefficiente_grezzo    NUMERIC(8, 6),           -- prima del tetto
    tetto_applicato        BOOLEAN NOT NULL DEFAULT false,
    fonte                  VARCHAR(20) NOT NULL DEFAULT 'deterministico',
    note                   TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_ovh_fonte CHECK (fonte IN ('deterministico','forecast')),
    CONSTRAINT uq_ovh_periodo UNIQUE (periodo_riferimento)
);

CREATE INDEX IF NOT EXISTS idx_ovh_periodo ON coefficienti_ovh(periodo_riferimento);

-- Parametri tetto (gruppo marginalita). base_ovh e orizzonte_coefficiente_mesi gia' seedati in Fase 1b.
INSERT INTO parametri (chiave, gruppo, descrizione, tipo, valore, valido_da, scope, fonte, nota) VALUES
  ('ovh_tetto_scostamento_pct', 'marginalita', 'Tetto % scostamento coefficiente OVH tra due refresh', 'percentuale', '20',  '2026-01-01', 'globale', 'direzione', NULL),
  ('ovh_coefficiente_fallback', 'marginalita', 'Coefficiente OVH di fallback',                          'percentuale', NULL,  '2026-01-01', 'globale', 'direzione', 'Da tarare col primo storico')
ON CONFLICT (chiave, valido_da) DO NOTHING;
