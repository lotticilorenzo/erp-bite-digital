-- Migration: seed parametri gruppi 'budget' e 'preventivatore' (spec v2 §19, foglio 17) - Fase H.
-- Valore concreto SOLO dove il foglio 17 lo specifica; altrove NULL + nota "da tarare"
-- (nessun numero inventato, invariante 22/14).

INSERT INTO parametri (chiave, gruppo, descrizione, tipo, valore, valido_da, scope, fonte, nota) VALUES
  ('peso_runrate_vs_storico',  'budget', 'Peso run-rate vs media storica nel forecast',  'percentuale', NULL,        '2026-01-01', 'globale', 'direzione', 'Da tarare (spec: alto finche'' lo storico 2024 e'' immaturo, §13.5)'),
  ('prob_pipeline',            'budget', 'Stadi e probabilita'' pipeline nuovo business', 'testo',      NULL,        '2026-01-01', 'globale', 'direzione', 'Da definire (stadi e % per stadio, foglio 17)'),
  ('fattore_stabilita_map',    'budget', 'Mappa rating stabilita'' -> fattore',           'testo',      '{"5":1.0,"4":0.9,"3":0.75,"2":0.5,"1":0.25}', '2026-01-01', 'globale', 'direzione', 'Foglio 5/17: 5->1.0 ... 1->0.25'),
  ('churn_atteso',             'budget', 'Churn atteso ricorrenti',                      'percentuale', NULL,        '2026-01-01', 'globale', 'direzione', 'Da definire (foglio 17)'),
  ('fattore_stagionalita',     'budget', 'Vettore stagionalita'' 12 mesi (spot)',         'testo',      NULL,        '2026-01-01', 'globale', 'direzione', 'Da definire; basso peso finche'' storico immaturo (§13.5)'),
  ('frequenza_reforecast',     'budget', 'Frequenza re-forecast',                        'enum',       'mensile',   '2026-01-01', 'globale', 'direzione', 'Default spec (foglio 17), legata alla chiusura'),
  ('markup_default',           'preventivatore', 'Markup default + base applicazione',   'percentuale', NULL,       '2026-01-01', 'globale', 'direzione', 'Da definire (solo-lavoro vs costo pieno, §18)'),
  ('ovh_preventivo_base',      'preventivatore', 'Base allocazione OVH nel preventivo',  'enum',       'pct_su_prezzo', '2026-01-01', 'globale', 'direzione', 'DECISO (§17/§18.2): % su prezzo, coerente con base-ricavi'),
  ('tariffa_figurativa_socio', 'preventivatore', 'Tariffa figurativa socio (EUR/h)',     'euro',       NULL,        '2026-01-01', 'globale', 'direzione', 'Solo capacita'' in v1; candidata base costing v2 (§18.7). Da definire'),
  ('fonte_pct_impegnata',      'preventivatore', 'Fonte % impegnata capacita''',          'enum',       'manuale',   '2026-01-01', 'globale', 'direzione', 'Default spec: manuale fino al registro forward (§18.5)'),
  ('effort_template',          'preventivatore', 'Valori effort template per tipo progetto', 'testo',  NULL,        '2026-01-01', 'globale', 'direzione', 'Placeholder: da popolare con lo storico (§18.6)')
ON CONFLICT DO NOTHING;
