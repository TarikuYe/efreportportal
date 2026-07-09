-- Add notification_email columns to project_bonds and eot_tracker tables

-- Add notification_email column to project_bonds table
ALTER TABLE project_bonds 
ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);

-- Add notification_email column to eot_tracker table  
ALTER TABLE eot_tracker 
ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);

-- Add comment to explain the purpose
COMMENT ON COLUMN project_bonds.notification_email IS 'Email address to receive bond-related notifications';
COMMENT ON COLUMN eot_tracker.notification_email IS 'Email address to receive EOT-related notifications';