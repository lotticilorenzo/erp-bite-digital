-- Migration: Align task_attachments.id default with ORM model
-- Created: 2026-05-04

ALTER TABLE task_attachments
    ALTER COLUMN id SET DEFAULT uuid_generate_v4();
