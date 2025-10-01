-- Drop the existing mode check constraint if it exists
ALTER TABLE uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_mode_check;

-- Add a new check constraint that allows all current and new modes
ALTER TABLE uploaded_files ADD CONSTRAINT uploaded_files_mode_check 
CHECK (mode IN ('upload', 'tutoring', 'study', 'highlight', 'whiteboard'));