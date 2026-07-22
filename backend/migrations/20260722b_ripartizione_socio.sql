-- Migration: ripartizione socio pesata (spec v2 §4.6, invariante 16)
-- Sostituisce calcola_quota_luca (ad-hoc, per cliente/contenuti) con la cascata generica
-- pool*peso/Sigma-pesi sui progetti, per socio.

ALTER TABLE risorse ADD COLUMN IF NOT EXISTS tipologia VARCHAR(20) NOT NULL DEFAULT 'dipendente';

CREATE TABLE IF NOT EXISTS ripartizione_soci (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risorsa_id        UUID NOT NULL UNIQUE REFERENCES risorse(id) ON DELETE CASCADE,
    amministrativa_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    commerciale_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    progettuale_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_ripartizione_socio_100 CHECK (amministrativa_pct + commerciale_pct + progettuale_pct = 100)
);

CREATE TABLE IF NOT EXISTS risorsa_progetto_periodo (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risorsa_id   UUID NOT NULL REFERENCES risorse(id) ON DELETE CASCADE,
    progetto_id  UUID NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
    periodo      DATE NOT NULL,
    attivo       BOOLEAN NOT NULL DEFAULT true,
    override_pct NUMERIC(5,2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_risorsa_progetto_periodo UNIQUE (risorsa_id, progetto_id, periodo)
);

ALTER TABLE preventivo_voci ADD COLUMN IF NOT EXISTS intensita_socio VARCHAR(1);
