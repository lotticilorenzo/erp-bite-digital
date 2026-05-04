-- Migration: Align task attachments, chat read-tracking and soft-delete columns
-- Created: 2026-05-04

CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    filename VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size INTEGER NOT NULL,
    content_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON task_attachments(created_at DESC);

ALTER TABLE chat_membri
    ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE clienti
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE progetti
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE commesse
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE studio_nodes
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE clienti SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE progetti SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE commesse SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE tasks SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE studio_nodes SET is_deleted = FALSE WHERE is_deleted IS NULL;
