-- Step 1: Update all FACTORY users to OFFICE
UPDATE users
SET role = 'OFFICE'
WHERE role = 'FACTORY';

-- Step 2: Verify the migration
SELECT username, role, name
FROM users
WHERE role = 'OFFICE';
