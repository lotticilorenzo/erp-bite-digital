CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'user_role'::regtype::oid
              AND enumlabel = 'DEVELOPER'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'DEVELOPER';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'user_role'::regtype::oid
              AND enumlabel = 'COLLABORATORE'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'COLLABORATORE';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'project_status'::regtype::oid
              AND enumlabel = 'ATTESA'
        ) THEN
            ALTER TYPE project_status ADD VALUE 'ATTESA';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'project_status'::regtype::oid
              AND enumlabel = 'SFIDA'
        ) THEN
            ALTER TYPE project_status ADD VALUE 'SFIDA';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_start_day_type') THEN
        CREATE TYPE client_start_day_type AS ENUM ('STANDARD_1', 'CROSS_15');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pianificazione_status') THEN
        CREATE TYPE pianificazione_status AS ENUM ('PENDING', 'ACCEPTED', 'CONVERTED');
    END IF;
END $$;

ALTER TABLE clienti
    ADD COLUMN IF NOT EXISTS cellulare VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sito_web VARCHAR(255),
    ADD COLUMN IF NOT EXISTS settore VARCHAR(100),
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(20),
    ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS google_drive_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS start_day_type client_start_day_type,
    ADD COLUMN IF NOT EXISTS affidabilita VARCHAR(10) DEFAULT 'MEDIA';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clienti'
          AND column_name = 'start_day_type'
          AND udt_name <> 'client_start_day_type'
    ) THEN
        ALTER TABLE clienti
        ALTER COLUMN start_day_type TYPE client_start_day_type
        USING CASE
            WHEN start_day_type::text = 'CROSS_15' THEN 'CROSS_15'::client_start_day_type
            ELSE 'STANDARD_1'::client_start_day_type
        END;
    END IF;
END $$;

ALTER TABLE clienti
    ALTER COLUMN start_day_type SET DEFAULT 'STANDARD_1',
    ALTER COLUMN affidabilita SET DEFAULT 'MEDIA';

UPDATE clienti
SET start_day_type = 'STANDARD_1'
WHERE start_day_type IS NULL;

UPDATE clienti
SET affidabilita = 'MEDIA'
WHERE affidabilita IS NULL;

ALTER TABLE progetti
    ADD COLUMN IF NOT EXISTS data_inizio DATE,
    ADD COLUMN IF NOT EXISTS data_fine DATE;

ALTER TABLE progetto_team
    ADD COLUMN IF NOT EXISTS ore_previste DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS note TEXT;

UPDATE progetto_team
SET ore_previste = 0
WHERE ore_previste IS NULL;

CREATE TABLE IF NOT EXISTS pianificazioni (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clienti(id),
    budget NUMERIC(10, 2) DEFAULT 0,
    stato pianificazione_status DEFAULT 'PENDING',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pianificazione_lavorazioni (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pianificazione_id UUID NOT NULL REFERENCES pianificazioni(id) ON DELETE CASCADE,
    tipo_lavorazione VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    ore_previste NUMERIC(12, 2) DEFAULT 0,
    costo_orario_snapshot NUMERIC(10, 2) DEFAULT 0
);

ALTER TABLE commesse
    ADD COLUMN IF NOT EXISTS pianificazione_id UUID,
    ADD COLUMN IF NOT EXISTS preventivo NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ore_contratto NUMERIC(8, 2) DEFAULT 0;

UPDATE commesse
SET preventivo = 0
WHERE preventivo IS NULL;

UPDATE commesse
SET ore_contratto = 0
WHERE ore_contratto IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_commesse_pianificazione'
    ) THEN
        ALTER TABLE commesse
        ADD CONSTRAINT fk_commesse_pianificazione
        FOREIGN KEY (pianificazione_id) REFERENCES pianificazioni(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pianificazioni_cliente_id
    ON pianificazioni(cliente_id);

CREATE INDEX IF NOT EXISTS idx_pianificazione_lavorazioni_pianificazione_id
    ON pianificazione_lavorazioni(pianificazione_id);
