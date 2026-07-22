-- Migration: ruolo MANUTENTORE (Fase M — sistema ruoli 3 livelli)
-- Super-admin riservato: gestione utenti (creazione account, cambio ruolo) e impostazioni
-- di sistema, sopra ADMIN/DEVELOPER. Stesso pattern idempotente di DEVELOPER/COLLABORATORE
-- (20260430_operational_alignment.sql): ALTER TYPE ADD VALUE solo se non gia' presente.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'user_role'::regtype::oid
              AND enumlabel = 'MANUTENTORE'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'MANUTENTORE';
        END IF;
    END IF;
END $$;
