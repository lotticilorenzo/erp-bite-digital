-- Migration: dimensione Categorie governata (spec v2 §4.8, foglio 1/9)
-- Sostituisce le stringhe libere `categoria` su costi_fissi/movimenti_cassa con una FK a un
-- piano dei conti vero (natura fisso/variabile, relazione_commessa diretto/indiretto).
-- costi_variabili NON ha un campo categoria stringa: nulla da migrare li'.

CREATE TABLE IF NOT EXISTS categorie (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codice                 VARCHAR(20) UNIQUE NOT NULL,
    nome                   VARCHAR(200) NOT NULL,
    categoria_padre_id     UUID REFERENCES categorie(id) ON DELETE SET NULL,
    tipo_flusso            VARCHAR(10) NOT NULL CHECK (tipo_flusso IN ('ricavo','costo')),
    natura                 VARCHAR(10) NOT NULL CHECK (natura IN ('fisso','variabile')),
    relazione_commessa     VARCHAR(10) NOT NULL CHECK (relazione_commessa IN ('diretto','indiretto')),
    voce_ce                VARCHAR(100),
    detraibilita_iva_pct   NUMERIC(5,2),
    deducibilita_pct       NUMERIC(5,2),
    attiva                 BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogo canonico (foglio 9B): idempotente, non sovrascrive righe gia' presenti.
INSERT INTO categorie (codice, nome, tipo_flusso, natura, relazione_commessa, voce_ce) VALUES
    ('R01','Ricavi progetti Social','ricavo','variabile','diretto','Valore della produzione'),
    ('R02','Ricavi progetti Web','ricavo','variabile','diretto','Valore della produzione'),
    ('R03','Ricavi Gestione Web','ricavo','variabile','diretto','Valore della produzione'),
    ('R04','Ricavi Produzione contenuti','ricavo','variabile','diretto','Valore della produzione'),
    ('R05','Ricavi Stand fieristici','ricavo','variabile','diretto','Valore della produzione'),
    ('R09','Altri ricavi','ricavo','variabile','indiretto','Altri ricavi'),
    ('C01','Compensi collaboratori','costo','variabile','diretto','Compensi collab. diretti'),
    ('C02','Costo M.O. interna (allocata)','costo','fisso','diretto','Costo M.O. allocata'),
    ('C03','Adv spend campagne cliente','costo','variabile','diretto','Costi diretti esterni'),
    ('C04','Licenze / asset di progetto','costo','variabile','diretto','Costi diretti esterni'),
    ('C05','Produzione esterna (stampa, troupe, stand)','costo','variabile','diretto','Costi diretti esterni'),
    ('S01','Personale di struttura (quota non allocata)','costo','fisso','indiretto','Costo personale struttura'),
    ('S02','Affitto e utenze','costo','fisso','indiretto','Affitto e utenze'),
    ('S03','Software / SaaS interni','costo','fisso','indiretto','Software/SaaS'),
    ('S04','Spese e commissioni bancarie','costo','variabile','indiretto','Commissioni bancarie'),
    ('S05','Marketing proprio Bite','costo','variabile','indiretto','Costi commerciali'),
    ('S06','Consulenze (commercialista, legale)','costo','fisso','indiretto','Consulenze'),
    ('S07','Spese generali e amministrative','costo','fisso','indiretto','Spese generali'),
    ('S08','Hardware / attrezzatura','costo','fisso','indiretto','Spese generali'),
    ('F01','Oneri finanziari (interessi)','costo','variabile','indiretto','Oneri finanziari'),
    ('F02','Imposte','costo','variabile','indiretto','Imposte'),
    -- Personale (spec: gia' nel costo orario diretto, esclusa dagli indivisibili -> diretto)
    ('C06','Personale (stipendi/RAL)','costo','fisso','diretto','Costo M.O. allocata'),
    -- Fallback generico per valori legacy non altrimenti mappabili
    ('X99','Altro (da classificare)','costo','fisso','indiretto','Spese generali')
ON CONFLICT (codice) DO NOTHING;

ALTER TABLE costi_fissi ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorie(id) ON DELETE SET NULL;
ALTER TABLE movimenti_cassa ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorie(id) ON DELETE SET NULL;

-- Migrazione dati esistenti: mappa le stringhe libere ai codici noti per nome (case-insensitive),
-- quella che matcha _PL_CATEGORIE_PERSONALE va su C06 (diretto, coerente col P&L); il resto ignoto
-- crea una riga LEGACY-<slug> dedicata (nessun dato perso, nessuna riga forzata su X99 a caso).
DO $$
DECLARE
    r RECORD;
    cat_id UUID;
    slug TEXT;
BEGIN
    FOR r IN SELECT DISTINCT categoria FROM costi_fissi WHERE categoria IS NOT NULL LOOP
        IF upper(r.categoria) IN ('STIPENDI','PERSONALE','SALARI','RAL','PAYROLL_DIPENDENTI') THEN
            SELECT id INTO cat_id FROM categorie WHERE codice = 'C06';
        ELSE
            SELECT id INTO cat_id FROM categorie WHERE lower(nome) = lower(r.categoria) LIMIT 1;
            IF cat_id IS NULL THEN
                slug := 'LEGACY-' || upper(regexp_replace(substring(r.categoria from 1 for 12), '[^A-Za-z0-9]', '', 'g'));
                INSERT INTO categorie (codice, nome, tipo_flusso, natura, relazione_commessa, voce_ce)
                VALUES (slug, r.categoria, 'costo', 'fisso', 'indiretto', 'Spese generali')
                ON CONFLICT (codice) DO NOTHING
                RETURNING id INTO cat_id;
                IF cat_id IS NULL THEN
                    SELECT id INTO cat_id FROM categorie WHERE codice = slug;
                END IF;
            END IF;
        END IF;
        UPDATE costi_fissi SET categoria_id = cat_id WHERE categoria = r.categoria AND categoria_id IS NULL;
    END LOOP;

    FOR r IN SELECT DISTINCT categoria FROM movimenti_cassa WHERE categoria IS NOT NULL LOOP
        SELECT id INTO cat_id FROM categorie WHERE lower(nome) = lower(r.categoria) LIMIT 1;
        IF cat_id IS NULL THEN
            slug := 'LEGACY-' || upper(regexp_replace(substring(r.categoria from 1 for 12), '[^A-Za-z0-9]', '', 'g'));
            SELECT id INTO cat_id FROM categorie WHERE codice = slug;
            IF cat_id IS NULL THEN
                INSERT INTO categorie (codice, nome, tipo_flusso, natura, relazione_commessa, voce_ce)
                VALUES (slug, r.categoria, 'costo', 'variabile', 'diretto', 'Costi diretti esterni')
                ON CONFLICT (codice) DO NOTHING
                RETURNING id INTO cat_id;
                IF cat_id IS NULL THEN
                    SELECT id INTO cat_id FROM categorie WHERE codice = slug;
                END IF;
            END IF;
        END IF;
        UPDATE movimenti_cassa SET categoria_id = cat_id WHERE categoria = r.categoria AND categoria_id IS NULL;
    END LOOP;
END $$;
