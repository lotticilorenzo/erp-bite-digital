-- Performance indexes for high-frequency query patterns
-- All statements are idempotent (IF NOT EXISTS)

-- ── TASKS ─────────────────────────────────────────────────
-- "My tasks" and studio-OS task board queries
CREATE INDEX IF NOT EXISTS idx_tasks_assegnatario
    ON tasks(assegnatario_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assegnatario_stato
    ON tasks(assegnatario_id, stato);

-- Project and commessa task lookups
CREATE INDEX IF NOT EXISTS idx_tasks_progetto
    ON tasks(progetto_id);

CREATE INDEX IF NOT EXISTS idx_tasks_commessa
    ON tasks(commessa_id);

-- Planning / capacity: tasks due on a given day
CREATE INDEX IF NOT EXISTS idx_tasks_scadenza
    ON tasks(data_scadenza);

-- Parent-only filter for tree view
CREATE INDEX IF NOT EXISTS idx_tasks_parent
    ON tasks(parent_id) WHERE parent_id IS NULL;

-- ── COMMESSE ───────────────────────────────────────────────
-- Dashboard KPI: commesse per cliente × mese
CREATE INDEX IF NOT EXISTS idx_commesse_cliente_mese
    ON commesse(cliente_id, mese_competenza);

CREATE INDEX IF NOT EXISTS idx_commesse_stato
    ON commesse(stato);

-- ── FATTURE ───────────────────────────────────────────────
-- FIC sync: lookup by external ID
CREATE INDEX IF NOT EXISTS idx_fatture_attive_fic_id
    ON fatture_attive(fic_id);

CREATE INDEX IF NOT EXISTS idx_fatture_passive_fic_id
    ON fatture_passive(fic_id);

-- Cliente FK lookups on invoices
CREATE INDEX IF NOT EXISTS idx_fatture_attive_cliente
    ON fatture_attive(cliente_id);

CREATE INDEX IF NOT EXISTS idx_fatture_passive_fornitore
    ON fatture_passive(fornitore_id);

-- ── MOVIMENTI CASSA ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_movimenti_cassa_data_valuta
    ON movimenti_cassa(data_valuta DESC);

CREATE INDEX IF NOT EXISTS idx_movimenti_cassa_riconciliato
    ON movimenti_cassa(riconciliato) WHERE riconciliato = false;

-- ── NOTIFICHE ─────────────────────────────────────────────
-- Unread notification badge count (very frequent read)
CREATE INDEX IF NOT EXISTS idx_notifications_user_letta
    ON notifications(user_id, is_read);

-- ── AUDIT LOG ─────────────────────────────────────────────
-- Filtered audit queries by table + action
CREATE INDEX IF NOT EXISTS idx_audit_log_tabella_azione
    ON audit_log(tabella, azione);

-- ── TIMESHEET (supplemental to existing indexes) ──────────
-- Approval queue: pending timesheet by approver
CREATE INDEX IF NOT EXISTS idx_timesheet_stato_mese
    ON timesheet(stato, mese_competenza);

-- ── PROGETTO TEAM ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_progetto_team_user
    ON progetto_team(user_id);

CREATE INDEX IF NOT EXISTS idx_progetto_team_progetto
    ON progetto_team(progetto_id);
