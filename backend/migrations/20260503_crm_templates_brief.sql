-- Migration: Add CRM Project Templates, Milestones and Briefs
-- Created: 2026-05-03

-- 1. Progetto Templates
CREATE TABLE IF NOT EXISTS progetto_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50),
    descrizione TEXT,
    icona VARCHAR(50),
    colore VARCHAR(20),
    attivo BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progetto_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES progetto_templates(id) ON DELETE CASCADE,
    titolo VARCHAR(200) NOT NULL,
    descrizione TEXT,
    ordine INTEGER DEFAULT 0,
    stima_ore NUMERIC(8, 2) DEFAULT 0,
    categoria VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_progetto_template_tasks_template ON progetto_template_tasks(template_id);

CREATE TABLE IF NOT EXISTS progetto_template_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES progetto_templates(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    giorni_dalla_creazione INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_progetto_template_milestones_template ON progetto_template_milestones(template_id);

-- 2. Project Milestones
CREATE TABLE IF NOT EXISTS progetto_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    progetto_id UUID REFERENCES progetti(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    data_scadenza DATE,
    completata BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_progetto_milestones_progetto ON progetto_milestones(progetto_id);

-- 3. Briefs
CREATE TABLE IF NOT EXISTS briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    progetto_id UUID REFERENCES progetti(id) ON DELETE CASCADE,
    titolo VARCHAR(200) NOT NULL,
    domande_risposte JSONB DEFAULT '{}',
    stato VARCHAR(20) DEFAULT 'BOZZA',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_briefs_progetto ON briefs(progetto_id);

-- 4. Updates to Tasks
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='ordine') THEN
        ALTER TABLE tasks ADD COLUMN ordine INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='categoria') THEN
        ALTER TABLE tasks ADD COLUMN categoria VARCHAR(50);
    END IF;
END $$;
