-- Migration: registro parametri centralizzato effective-dated (spec v2 §19)
-- Created: 2026-07-19
-- Fonte unica dei parametri di configurazione (fiscalita, tesoreria, budget, marginalita,
-- soci/risorse, chiusura, preventivatore, clienti). Versionati per data: piu' righe per
-- chiave con valido_da diverse; il resolver sceglie la riga con valido_da MASSIMA <= data
-- di riferimento (spec §19.4). Le righe storiche NON si cancellano (servono a ricalcolare
-- i periodi passati). Questa fase crea SOLO il registro: i consumi hardcoded NON sono
-- ancora migrati -> zero impatto sui calcoli attuali (invariante 22).

CREATE TABLE IF NOT EXISTS parametri (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chiave       VARCHAR(100) NOT NULL,
    gruppo       VARCHAR(30) NOT NULL,
    descrizione  TEXT,
    tipo         VARCHAR(20) NOT NULL,
    valore       TEXT,               -- serializzato; `tipo` dice come interpretarlo
    valido_da    DATE NOT NULL,
    scope        VARCHAR(30) NOT NULL DEFAULT 'globale',
    fonte        VARCHAR(30),
    nota         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_parametri_chiave_valido_da UNIQUE (chiave, valido_da),
    CONSTRAINT ck_parametri_gruppo CHECK (gruppo IN ('fiscalita','tesoreria','budget','marginalita','soci_risorse','chiusura','preventivatore','clienti')),
    CONSTRAINT ck_parametri_tipo CHECK (tipo IN ('percentuale','euro','intero','booleano','enum','data','testo')),
    CONSTRAINT ck_parametri_scope CHECK (scope IN ('globale','con_override_entita')),
    CONSTRAINT ck_parametri_fonte CHECK (fonte IS NULL OR fonte IN ('utente','commercialista','direzione'))
);

CREATE INDEX IF NOT EXISTS idx_parametri_chiave_valido_da ON parametri(chiave, valido_da DESC);
CREATE INDEX IF NOT EXISTS idx_parametri_gruppo ON parametri(gruppo);

-- SEED parametri gia' NOTI dalla spec v2 §19 (valido_da 2026-01-01). Idempotente.
-- Dove la spec NON fornisce un valore: valore NULL + nota 'da confermare' (mai numeri finti).
INSERT INTO parametri (chiave, gruppo, descrizione, tipo, valore, valido_da, scope, fonte, nota) VALUES
  ('iva_periodicita',            'fiscalita',   'Periodicita liquidazione IVA',                       'enum',        'trimestrale', '2026-01-01', 'globale', 'commercialista', NULL),
  ('aliquota_irap',              'fiscalita',   'Aliquota IRAP societa',                              'percentuale', '3.9',         '2026-01-01', 'globale', 'commercialista', NULL),
  ('aliquota_irpef_prudente',    'fiscalita',   'Aliquota IRPEF prudenziale soci (trasparenza)',      'percentuale', '43',          '2026-01-01', 'globale', 'commercialista', NULL),
  ('bite_finanzia_tasse_soci',   'fiscalita',   'La societa anticipa/finanzia le imposte dei soci',   'booleano',    'false',       '2026-01-01', 'globale', 'direzione',      'Default da confermare'),
  ('soglia_sicurezza_cassa',     'tesoreria',   'Soglia minima di sicurezza cassa',                   'euro',        NULL,          '2026-01-01', 'globale', 'direzione',      'Da confermare (valore non in spec)'),
  ('tolleranza_matching',        'tesoreria',   'Tolleranza importo per matching riconciliazione',    'euro',        NULL,          '2026-01-01', 'globale', 'direzione',      'Da confermare (valore non in spec)'),
  ('tetto_fatture_n1',           'tesoreria',   'Tetto fatture cliente N+1',                          'euro',        NULL,          '2026-01-01', 'globale', 'direzione',      'Da confermare (valore non in spec)'),
  ('orizzonte_previsione_gg',    'tesoreria',   'Orizzonte previsione cassa (giorni)',                'intero',      '90',          '2026-01-01', 'globale', 'direzione',      NULL),
  ('termini_pagamento_default',  'clienti',     'Termini di pagamento default (giorni)',              'intero',      '30',          '2026-01-01', 'globale', 'direzione',      NULL),
  ('dso_campione_minimo',        'clienti',     'Numero minimo fatture per DSO comportamentale',      'intero',      '5',           '2026-01-01', 'globale', 'direzione',      NULL),
  ('dso_finestra_mesi',          'clienti',     'Finestra storica DSO (mesi)',                        'intero',      '12',          '2026-01-01', 'globale', 'direzione',      NULL),
  ('scala_intensita_S',          'soci_risorse','Peso scala intensita S',                             'intero',      '1',           '2026-01-01', 'globale', 'direzione',      NULL),
  ('scala_intensita_M',          'soci_risorse','Peso scala intensita M',                             'intero',      '2',           '2026-01-01', 'globale', 'direzione',      NULL),
  ('scala_intensita_L',          'soci_risorse','Peso scala intensita L',                             'intero',      '4',           '2026-01-01', 'globale', 'direzione',      NULL),
  ('override_mensile_attivo',    'soci_risorse','Override mensile riparto quota attivo',              'booleano',    'false',       '2026-01-01', 'globale', 'direzione',      NULL),
  ('base_ovh',                   'marginalita', 'Base di assorbimento overhead',                      'enum',        'ricavi',      '2026-01-01', 'globale', 'direzione',      NULL),
  ('orizzonte_coefficiente_mesi','marginalita', 'Finestra rolling coefficiente overhead (mesi)',      'intero',      '12',          '2026-01-01', 'globale', 'direzione',      NULL),
  ('giorno_hard_lock',           'chiusura',    'Giorno del mese hard-lock competenza',               'intero',      '15',          '2026-01-01', 'globale', 'direzione',      NULL)
ON CONFLICT (chiave, valido_da) DO NOTHING;
