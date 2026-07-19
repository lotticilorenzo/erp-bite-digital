-- Migration: ritardo_gg sulle riconciliazioni (spec v2 §5.4) — dato di puntualita' cliente/fornitore
-- Created: 2026-07-19
-- ritardo_gg = (data del movimento = data_valuta) - (data_scadenza della fattura collegata).
-- Positivo = in ritardo, negativo = in anticipo, 0 = puntuale, NULL = non calcolabile (manca scadenza).
-- Additiva: aggiunge un dato, non tocca alcun calcolo esistente.

ALTER TABLE riconciliazioni ADD COLUMN IF NOT EXISTS ritardo_gg INTEGER;

-- Backfill retroattivo dai dati gia' a DB (data movimento - data_scadenza fattura).
UPDATE riconciliazioni r
SET ritardo_gg = (
    (SELECT m.data_valuta FROM movimenti_cassa m WHERE m.id = r.movimento_id)
    - COALESCE(
        (SELECT data_scadenza FROM fatture_attive  WHERE id = r.fattura_attiva_id),
        (SELECT data_scadenza FROM fatture_passive WHERE id = r.fattura_passiva_id)
      )
)
WHERE COALESCE(
    (SELECT data_scadenza FROM fatture_attive  WHERE id = r.fattura_attiva_id),
    (SELECT data_scadenza FROM fatture_passive WHERE id = r.fattura_passiva_id)
) IS NOT NULL;
