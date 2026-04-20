DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = 'user_role'::regtype::oid
              AND enumlabel = 'DEVELOPER'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'DEVELOPER';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = 'user_role'::regtype::oid
              AND enumlabel = 'COLLABORATORE'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'COLLABORATORE';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contenuto_status') THEN
        CREATE TYPE contenuto_status AS ENUM (
            'BOZZA',
            'IN_REVISIONE_INTERNA',
            'MODIFICHE_RICHIESTE_INTERNE',
            'APPROVATO_INTERNAMENTE',
            'INVIATO_AL_CLIENTE',
            'MODIFICHE_RICHIESTE_CLIENTE',
            'APPROVATO_CLIENTE',
            'PUBBLICATO',
            'ARCHIVIATO'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contenuto_tipo') THEN
        CREATE TYPE contenuto_tipo AS ENUM (
            'POST_SOCIAL',
            'COPY',
            'DESIGN',
            'VIDEO',
            'EMAIL',
            'ALTRO'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descrizione TEXT,
    progetto_tipo VARCHAR(20),
    attivo BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS descrizione TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS progetto_tipo VARCHAR(20);
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS attivo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE task_templates
SET attivo = TRUE
WHERE attivo IS NULL;

CREATE TABLE IF NOT EXISTS task_template_items (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    titolo VARCHAR(500) NOT NULL,
    descrizione TEXT,
    servizio VARCHAR(50),
    stima_minuti INTEGER,
    priorita VARCHAR(10) NOT NULL DEFAULT 'media',
    giorno_scadenza INTEGER,
    assegnatario_ruolo VARCHAR(30),
    ordine INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE task_template_items ADD COLUMN IF NOT EXISTS descrizione TEXT;
ALTER TABLE task_template_items ADD COLUMN IF NOT EXISTS servizio VARCHAR(50);
ALTER TABLE task_template_items ADD COLUMN IF NOT EXISTS stima_minuti INTEGER;
ALTER TABLE task_template_items ADD COLUMN IF NOT EXISTS priorita VARCHAR(10) NOT NULL DEFAULT 'media';
ALTER TABLE task_template_items ADD COLUMN IF NOT EXISTS giorno_scadenza INTEGER;
ALTER TABLE task_template_items ADD COLUMN IF NOT EXISTS assegnatario_ruolo VARCHAR(30);
ALTER TABLE task_template_items ADD COLUMN IF NOT EXISTS ordine INTEGER NOT NULL DEFAULT 0;

UPDATE task_template_items
SET priorita = 'media'
WHERE priorita IS NULL;

UPDATE task_template_items
SET ordine = 0
WHERE ordine IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_template_items_template_id
    ON task_template_items(template_id);

CREATE TABLE IF NOT EXISTS contenuti (
    id UUID PRIMARY KEY,
    titolo VARCHAR(500) NOT NULL,
    tipo contenuto_tipo NOT NULL DEFAULT 'POST_SOCIAL',
    stato contenuto_status NOT NULL DEFAULT 'BOZZA',
    commessa_id UUID REFERENCES commesse(id),
    progetto_id UUID REFERENCES progetti(id),
    assegnatario_id UUID REFERENCES users(id),
    data_consegna_prevista DATE,
    url_preview VARCHAR(1000),
    testo TEXT,
    note_revisione TEXT,
    approvato_da UUID REFERENCES users(id),
    approvato_at TIMESTAMPTZ,
    pubblicato_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contenuti_stato ON contenuti(stato);
CREATE INDEX IF NOT EXISTS idx_contenuti_commessa_id ON contenuti(commessa_id);
CREATE INDEX IF NOT EXISTS idx_contenuti_progetto_id ON contenuti(progetto_id);
CREATE INDEX IF NOT EXISTS idx_contenuti_assegnatario_id ON contenuti(assegnatario_id);
CREATE INDEX IF NOT EXISTS idx_contenuti_created_at ON contenuti(created_at);

CREATE TABLE IF NOT EXISTS contenuto_eventi (
    id UUID PRIMARY KEY,
    contenuto_id UUID NOT NULL REFERENCES contenuti(id) ON DELETE CASCADE,
    autore_id UUID REFERENCES users(id),
    stato_precedente contenuto_status,
    stato_nuovo contenuto_status NOT NULL,
    nota TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contenuto_eventi_contenuto_id
    ON contenuto_eventi(contenuto_id);
CREATE INDEX IF NOT EXISTS idx_contenuto_eventi_created_at
    ON contenuto_eventi(created_at);
