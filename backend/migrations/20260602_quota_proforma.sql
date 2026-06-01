-- Migration: Quota Luca (allocazione pro-forma per output) — Prompt 4
-- Created: 2026-06-02
--
-- Config pro-forma su `risorse`: la destinataria È la risorsa che porta l'importo
-- mensile. Modificabile via CRUD risorse. Default: Luca Bottioni = 1500.00 (brief §2.6).

ALTER TABLE risorse
    ADD COLUMN IF NOT EXISTS quota_proforma_mensile NUMERIC(10,2);

-- Backfill destinatario di default (Luca Bottioni, socio reale individuato sul DB).
UPDATE risorse SET quota_proforma_mensile = 1500.00
 WHERE id = '47461520-d99f-4e84-8561-4b683b54ba4c';
