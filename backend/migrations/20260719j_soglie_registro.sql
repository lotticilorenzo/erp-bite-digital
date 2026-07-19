-- Migration: soglie hardcoded -> registro parametri (spec v2 §19, inv. 22)
-- Created: 2026-07-19
-- Valori IDENTICI alle costanti attuali nel codice -> invarianza sha256 totale. La lettura passa
-- al resolver effective-dated (get_parametro); le costanti restano come FALLBACK nel codice.
-- NON migra il DSO comportamentale (soglia campione/finestra): cambia i numeri, rimandato.

INSERT INTO parametri (chiave, gruppo, descrizione, tipo, valore, valido_da, scope, fonte, nota) VALUES
  ('soglia_uscita',        'tesoreria',   'Soglia EUR: uscite oltre questa sono significative (dashboard liquidita)', 'euro',        '500', '2026-01-01', 'globale', 'direzione', NULL),
  ('soglia_margine_pct',   'marginalita', 'Soglia % sotto la quale il margine cliente e basso',                       'percentuale', '20',  '2026-01-01', 'globale', 'direzione', NULL),
  ('soglia_alert_clienti', 'marginalita', 'N. clienti sotto soglia oltre il quale scatta l alert',                    'intero',      '2',   '2026-01-01', 'globale', 'direzione', NULL)
ON CONFLICT (chiave, valido_da) DO NOTHING;
