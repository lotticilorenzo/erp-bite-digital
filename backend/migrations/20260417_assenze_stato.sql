-- Migration: add stato + approvato_da to assenze
-- Date: 2026-04-17

ALTER TABLE assenze
  ADD COLUMN IF NOT EXISTS stato VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS approvato_da UUID REFERENCES users(id);
