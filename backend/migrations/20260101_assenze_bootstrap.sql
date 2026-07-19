-- Migration: bootstrap tabella `assenze` (fix pre-esistente, non legato alla Fase 5)
-- Created: 2026-01-01 (data anteriore a 20260417_assenze_stato per ordine corretto)
-- `assenze` esisteva solo come modello ORM (create_all, disabilitato) e non veniva creata da alcuna
-- migration: su DB vergine 20260417_assenze_stato.sql (ALTER) falliva. Schema derivato dalla TABELLA
-- REALE IN PRODUZIONE (la verita'). IDEMPOTENTE: in prod la tabella esiste gia' -> CREATE IF NOT EXISTS
-- gira a vuoto. L'ALTER del 17/04 e' anch'esso idempotente (ADD COLUMN IF NOT EXISTS): nessun conflitto.

CREATE TABLE IF NOT EXISTS assenze (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_inizio  DATE NOT NULL,
    data_fine    DATE NOT NULL,
    tipo         VARCHAR(50) DEFAULT 'FERIE',
    note         TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    stato        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approvato_da UUID REFERENCES users(id)
);
