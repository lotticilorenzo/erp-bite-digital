-- Limpiamos datos previos se necessario per evitare duplicati nei test
DELETE FROM tasks WHERE titolo IN ('Design System Upgrade', 'Layout Revision', 'API Integration', 'Database Optimization', 'Frontend Refactoring', 'Testing Coverage', 'Documentation update', 'Client presentation', 'Production Deploy');

INSERT INTO users (id, nome, cognome, email, password_hash, ruolo, ore_settimanali, attivo, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Marco', 'Rossi', 'marco@biteagency.com', 'dummy', 'DIPENDENTE', 40, true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Sofia', 'Bianchi', 'sofia@biteagency.com', 'dummy', 'DIPENDENTE', 40, true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'Luca', 'Ferrari', 'luca@biteagency.com', 'dummy', 'DIPENDENTE', 32, true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'Anna', 'Conti', 'anna@biteagency.com', 'dummy', 'DIPENDENTE', 40, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET ore_settimanali = EXCLUDED.ore_settimanali, attivo = EXCLUDED.attivo;

-- Insert Tasks with explicit UUIDs to avoid issues and handle defaults
INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Design System Upgrade', id, '11111111-1111-1111-1111-111111111111', 'PROGRAMMATO', '2026-04-07', 240, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Layout Revision', id, '11111111-1111-1111-1111-111111111111', 'DA_FARE', '2026-04-07', 210, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'API Integration', id, '22222222-2222-2222-2222-222222222222', 'PROGRAMMATO', '2026-04-07', 300, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Database Optimization', id, '22222222-2222-2222-2222-222222222222', 'DA_FARE', '2026-04-07', 240, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Frontend Refactoring', id, '33333333-3333-3333-3333-333333333333', 'DA_FARE', '2026-04-07', 240, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Testing Coverage', id, '44444444-4444-4444-4444-444444444444', 'DA_FARE', '2026-04-07', 180, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Documentation update', id, '44444444-4444-4444-4444-444444444444', 'DA_FARE', '2026-04-06', 120, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Client presentation', id, '11111111-1111-1111-1111-111111111111', 'DA_FARE', '2026-04-08', 120, NOW(), NOW() FROM progetti LIMIT 1;

INSERT INTO tasks (id, titolo, progetto_id, assegnatario_id, stato, data_scadenza, stima_minuti, created_at, updated_at)
SELECT gen_random_uuid(), 'Production Deploy', id, '22222222-2222-2222-2222-222222222222', 'DA_FARE', '2026-04-08', 60, NOW(), NOW() FROM progetti LIMIT 1;
