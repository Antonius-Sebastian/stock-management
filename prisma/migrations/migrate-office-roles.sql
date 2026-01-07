-- Step 1: Update all OFFICE users to OFFICE_PURCHASING
-- (Admin will need to manually reassign OFFICE_WAREHOUSE users)
UPDATE users
SET role = 'OFFICE_PURCHASING'
WHERE role = 'OFFICE';

-- Step 2: Verify the migration
SELECT username, role, name
FROM users
ORDER BY role, username;
