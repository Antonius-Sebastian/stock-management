-- Migration script to convert FACTORY users to OFFICE role
-- Run this BEFORE deploying the schema changes

UPDATE users
SET role = 'OFFICE'
WHERE role = 'FACTORY';

-- Verify the migration
SELECT username, role, name
FROM users
WHERE role = 'OFFICE';
