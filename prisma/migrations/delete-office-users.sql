-- Delete all users with OFFICE role
DELETE FROM users WHERE role = 'OFFICE';

-- Verify deletion
SELECT COUNT(*) as remaining_office_users FROM users WHERE role = 'OFFICE';
