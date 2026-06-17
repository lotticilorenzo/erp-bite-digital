-- Migration: brief D2 - tags TEXT[] e task_assegnatari M2M + backfill
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS task_assegnatari (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assegnatari_task_id ON task_assegnatari(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assegnatari_user_id ON task_assegnatari(user_id);

-- Backfill: popola task_assegnatari dall'assegnatario_id legato
INSERT INTO task_assegnatari (task_id, user_id)
SELECT id, assegnatario_id
FROM tasks
WHERE assegnatario_id IS NOT NULL
ON CONFLICT DO NOTHING;
