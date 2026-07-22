-- Migration: Finanziamenti / linee di credito (spec v2 §4.9).
-- Le rate entrano in previsione cassa come scadenze tipo=finanziaria (motore ricorrenze riusato);
-- debito_residuo alimenta la PFN. Ammortamento contabile fuori scope (resta al commercialista).

CREATE TABLE IF NOT EXISTS finanziamenti (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ente              VARCHAR(200) NOT NULL,
    tipo              VARCHAR(20) NOT NULL DEFAULT 'prestito' CHECK (tipo IN ('fido','mutuo','leasing','prestito')),
    importo_erogato   NUMERIC(14,2) NOT NULL CHECK (importo_erogato > 0),
    data_erogazione   DATE,
    tasso_pct         NUMERIC(6,3),
    durata_mesi       INTEGER,
    rata_mensile      NUMERIC(12,2),
    data_inizio_rate  DATE,
    debito_residuo    NUMERIC(14,2),
    ricorrenza_id     UUID REFERENCES ricorrenze(id) ON DELETE SET NULL,
    attivo            BOOLEAN NOT NULL DEFAULT true,
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
