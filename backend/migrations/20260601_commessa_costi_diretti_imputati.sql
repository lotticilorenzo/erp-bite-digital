-- Migration: costi diretti derivati dalle imputazioni di fatture passive (R3)
-- Created: 2026-06-01
--
-- Aggiunge una colonna DERIVATA separata: costi_diretti resta input manuale,
-- costi_diretti_imputati e' ricalcolato dalle fatture_passive_imputazioni.
-- Il margine usa la somma dei due. Additivo, nessuna perdita dei valori manuali.

ALTER TABLE commesse
    ADD COLUMN IF NOT EXISTS costi_diretti_imputati NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Backfill una-tantum dalla fonte autorevole (fatture_passive_imputazioni).
-- Competenza: cliente effettivo = COALESCE(imputazione.cliente_id, progetto.cliente_id),
-- mese = mese di emissione della fattura passiva. Scrive SOLO la nuova colonna.
UPDATE commesse c SET costi_diretti_imputati = COALESCE((
    SELECT SUM(i.importo)
    FROM fatture_passive_imputazioni i
    JOIN fatture_passive fp ON fp.id = i.fattura_passiva_id
    LEFT JOIN progetti p ON p.id = i.progetto_id
    WHERE COALESCE(i.cliente_id, p.cliente_id) = c.cliente_id
      AND date_trunc('month', fp.data_emissione)::date = c.mese_competenza
), 0);
